#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATASET_URL="https://storage.yandexcloud.net/olympic-prod-data/Dating/Data_0.zip"
MODEL_S3_KEY="ml-models/model-v3.json"
ARCHIVE_MEMBER="transaction_600_new.csv"
COLLECTION="user_profiles"
SEED_LIMIT=600
RECOMMENDATION_LIMIT=300
SCAN_TOP_PAIRS=2000

RUN_TRAIN=true
RUN_SEED=true
RUN_SYNC=true
RUN_PAIR_CHECK=true
CONFIRMED=false

usage() {
  cat <<'EOF'
Usage:
  bash deploy/reset_reload_users.sh --yes [options]

What it does:
  1) Starts required services
  2) Deletes Qdrant user collection
  3) Truncates user-related Postgres tables
  4) Trains ML and reloads ml-service (optional)
  5) Seeds mock dataset users (optional)
  6) Syncs Postgres users into Qdrant profiles (optional)
  7) Runs health checks and finds a reciprocal closest pair

Options:
  --yes                         Required confirmation for destructive reset
  --dataset-url URL             Dataset/zip URL for training
  --model-s3-key KEY            S3 key for uploaded model artifact
  --archive-member PATH         Member name in zip archive
  --collection NAME             Qdrant collection name (default: user_profiles)
  --seed-limit N                Number of dataset users to seed (default: 600)
  --recommendation-limit N      Limit used in reciprocal pair check (default: 300)
  --scan-top-pairs N            Number of closest pairs to scan (default: 2000)
  --skip-train                  Skip training phase
  --skip-seed                   Skip dataset seeding phase
  --skip-sync                   Skip profile sync phase
  --skip-pair-check             Skip reciprocal pair check
  -h, --help                    Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      CONFIRMED=true
      shift
      ;;
    --dataset-url)
      DATASET_URL="$2"
      shift 2
      ;;
    --model-s3-key)
      MODEL_S3_KEY="$2"
      shift 2
      ;;
    --archive-member)
      ARCHIVE_MEMBER="$2"
      shift 2
      ;;
    --collection)
      COLLECTION="$2"
      shift 2
      ;;
    --seed-limit)
      SEED_LIMIT="$2"
      shift 2
      ;;
    --recommendation-limit)
      RECOMMENDATION_LIMIT="$2"
      shift 2
      ;;
    --scan-top-pairs)
      SCAN_TOP_PAIRS="$2"
      shift 2
      ;;
    --skip-train)
      RUN_TRAIN=false
      shift
      ;;
    --skip-seed)
      RUN_SEED=false
      shift
      ;;
    --skip-sync)
      RUN_SYNC=false
      shift
      ;;
    --skip-pair-check)
      RUN_PAIR_CHECK=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$CONFIRMED" != "true" ]]; then
  echo "Refusing to run destructive reset without --yes." >&2
  usage
  exit 1
fi

if [[ ! -f "deploy/.env" ]]; then
  echo "deploy/.env is missing." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose --env-file deploy/.env -f docker-compose.prod.yml)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose --env-file deploy/.env -f docker-compose.prod.yml)
else
  echo "Docker Compose is missing on this host." >&2
  exit 1
fi

dc() {
  "${compose_cmd[@]}" "$@"
}

echo "[1/8] Starting services..."
dc up -d db qdrant backend ml-service minio

echo "[2/8] Deleting Qdrant collection '${COLLECTION}'..."
dc exec -T backend python - "$COLLECTION" <<'PY'
import sys
import httpx

collection = sys.argv[1]
url = f"http://qdrant:6333/collections/{collection}?timeout=60"
with httpx.Client(timeout=60) as client:
    response = client.delete(url)
    if response.status_code not in (200, 404):
        response.raise_for_status()
    print(f"qdrant_delete_status={response.status_code}")
PY

echo "[3/8] Truncating Postgres user data..."
dc exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d chupapis <<'SQL'
TRUNCATE TABLE
  recommendation_items,
  recommendation_batches,
  interaction_events,
  onboarding_quiz_answers,
  matches,
  pair_states,
  conversations,
  messages,
  blocks,
  reports,
  audit_log,
  outbox_events,
  analytics_daily_funnel,
  match_notifications,
  message_notifications,
  like_notifications,
  user_roles,
  users
RESTART IDENTITY CASCADE;
SQL

if [[ "$RUN_TRAIN" == "true" ]]; then
  echo "[4/8] Training ML model and reloading ml-service..."
  bash deploy/manual-train-ml.sh "$DATASET_URL" "$MODEL_S3_KEY" "$ARCHIVE_MEMBER"
else
  echo "[4/8] Skipped ML training."
fi

if [[ "$RUN_SEED" == "true" ]]; then
  echo "[5/8] Seeding dataset users into Postgres..."
  dc exec -T backend sh -lc "
    export MOCK_USER_SEED_ENABLED=true
    export MOCK_USER_SEED_LIMIT=${SEED_LIMIT}
    python -m scripts.seed_mock_users
  "
else
  echo "[5/8] Skipped user seeding."
fi

if [[ "$RUN_SYNC" == "true" ]]; then
  echo "[6/8] Syncing Postgres users to Qdrant..."
  dc exec -T backend python -m scripts.sync_ml_profiles \
    --collection "$COLLECTION" \
    --delete-orphans \
    --upsert-existing
else
  echo "[6/8] Skipped profile sync."
fi

echo "[7/8] Running consistency checks..."
dc ps
dc exec -T db psql -U postgres -d chupapis -c "
select
  count(*) as total_users,
  count(*) filter (where is_dataset_user) as dataset_users,
  count(*) filter (where service_user_id is not null) as with_ml_id,
  count(*) filter (where avatar_key is not null) as with_avatar
from users;
"
dc exec -T backend python - "$COLLECTION" <<'PY'
import datetime as dt
import os
import sys
from uuid import uuid4

import httpx

collection = sys.argv[1]
token = os.environ.get("ML_SERVICE_TOKEN", "change-me-ml-token")

with httpx.Client(timeout=30) as client:
    collection_resp = client.get(f"http://qdrant:6333/collections/{collection}")
    collection_resp.raise_for_status()
    result = collection_resp.json().get("result") or {}
    points_count = int(result.get("points_count") or 0)
    print(f"qdrant_points={points_count}")
    if points_count <= 0:
        raise SystemExit("Qdrant collection has no points")

    scroll_resp = client.post(
        f"http://qdrant:6333/collections/{collection}/points/scroll",
        json={"limit": 1, "with_payload": True},
    )
    scroll_resp.raise_for_status()
    scroll_data = scroll_resp.json()
    points = (scroll_data.get("result") or {}).get("points") or []
    if not points:
        raise SystemExit("Qdrant scroll returned no points")

    request_user_id = (points[0].get("payload") or {}).get("party_rk")
    if not request_user_id:
        raise SystemExit("party_rk is missing in first Qdrant point")

    payload = {
        "trace_id": str(uuid4()),
        "request_user_id": request_user_id,
        "limit": 5,
        "strategy": "balanced",
        "context": {
            "request_ts": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "client": "script",
            "decision_policy": "daily_batch",
        },
    }
    ml_resp = client.post(
        "http://ml-service:8080/v1/recommendations",
        headers={"X-Service-Token": token},
        json=payload,
    )
    print(f"ml_status={ml_resp.status_code}")
    if ml_resp.status_code != 200:
        print(ml_resp.text[:500])
        raise SystemExit("ML recommendations smoke check failed")
    ml_body = ml_resp.json()
    print(f"ml_decision_mode={ml_body.get('decision_mode')}")
    print(f"ml_candidates={len(ml_body.get('candidates') or [])}")
PY

if [[ "$RUN_PAIR_CHECK" == "true" ]]; then
  echo "[8/8] Finding a reciprocal closest pair..."
  dc exec -T backend python -m scripts.find_closest_qdrant_pair \
    --collection "$COLLECTION" \
    --limit "$RECOMMENDATION_LIMIT" \
    --scan-top-pairs "$SCAN_TOP_PAIRS"
else
  echo "[8/8] Skipped reciprocal pair check."
fi

echo "Reset and reload completed."
