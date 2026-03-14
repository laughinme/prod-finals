#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deploy/manual-train-ml.sh <dataset_url_or_zip_url> [model_s3_key] [archive_member]" >&2
  echo "Usage: bash deploy/manual-train-ml.sh <dataset_url> [model_s3_key]" >&2
  exit 1
fi

dataset_url="$1"
model_s3_key="${2:-}"
archive_member="${3:-}"

if [[ ! -f "deploy/.env" ]]; then
  echo "deploy/.env is missing. Upload production env first." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose --env-file deploy/.env -f docker-compose.prod.yml)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose --env-file deploy/.env -f docker-compose.prod.yml)
else
  echo "Docker Compose is missing on VM." >&2
  exit 1
fi

echo "Using compose command: ${compose_cmd[*]}"

"${compose_cmd[@]}" up -d --remove-orphans minio
"${compose_cmd[@]}" up --abort-on-container-exit --exit-code-from minio-init minio-init

run_args=(
  --rm
  -e "ML_TRAIN_DATA_URL=${dataset_url}"
  -e "ML_TRAIN_REQUIRED=true"
  -e "ML_MODEL_UPLOAD_REQUIRED=true"
)

if [[ -n "$model_s3_key" ]]; then
  run_args+=(-e "ML_MODEL_S3_KEY=${model_s3_key}")
fi

if [[ -n "$archive_member" ]]; then
  run_args+=(-e "ML_TRAIN_ARCHIVE_MEMBER=${archive_member}")
fi

"${compose_cmd[@]}" run "${run_args[@]}" ml-service python -m ml.scripts.train_model

echo "Restarting ml-service to reload artifact from volume..."
"${compose_cmd[@]}" up -d --force-recreate ml-service
"${compose_cmd[@]}" ps ml-service

echo "Manual training finished."
