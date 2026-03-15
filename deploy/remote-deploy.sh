#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "docker-compose.prod.yml"
  "deploy/.env"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Required file is missing: $file" >&2
    exit 1
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on VM. Install docker.io first." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose_cmd=(
    docker compose
    --env-file deploy/.env
    -f docker-compose.prod.yml
  )
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(
    docker-compose
    --env-file deploy/.env
    -f docker-compose.prod.yml
  )
else
  echo "Docker Compose is missing. Install docker-compose-v2 or docker-compose." >&2
  exit 1
fi

echo "Using compose command: ${compose_cmd[*]}"
"${compose_cmd[@]}" version || true

read_env_value() {
  local name="$1"
  local line
  line="$(grep -E "^${name}=" deploy/.env | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  local value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  echo "$value"
}

is_truthy() {
  local value
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

print_diagnostics() {
  "${compose_cmd[@]}" ps || true
  echo
  echo "----- ml-service logs -----"
  "${compose_cmd[@]}" logs --tail=200 ml-service || true
  echo
  echo "----- backend logs -----"
  "${compose_cmd[@]}" logs --tail=120 backend || true
  echo
  echo "----- caddy logs -----"
  "${compose_cmd[@]}" logs --tail=120 caddy || true
  echo
  echo "----- centrifugo logs -----"
  "${compose_cmd[@]}" logs --tail=120 centrifugo || true
  echo
  echo "----- infra logs -----"
  "${compose_cmd[@]}" logs --tail=120 db redis minio minio-init centrifugo || true
}

wait_for_backend_health() {
  local timeout_sec="$1"
  local deadline
  local container_id
  local status
  local health

  deadline=$((SECONDS + timeout_sec))
  while (( SECONDS < deadline )); do
    container_id="$("${compose_cmd[@]}" ps -q backend 2>/dev/null || true)"
    if [[ -z "$container_id" ]]; then
      sleep 2
      continue
    fi

    status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"

    if [[ "$status" == "running" && "$health" == "healthy" ]]; then
      return 0
    fi
    if [[ "$status" == "exited" || "$status" == "dead" || "$health" == "unhealthy" ]]; then
      echo "Backend container is not healthy (status=$status, health=$health)." >&2
      return 1
    fi
    sleep 2
  done

  echo "Backend health check timeout after ${timeout_sec}s." >&2
  return 1
}

wait_for_service_running() {
  local service_name="$1"
  local timeout_sec="$2"
  local deadline
  local container_id
  local status

  deadline=$((SECONDS + timeout_sec))
  while (( SECONDS < deadline )); do
    container_id="$("${compose_cmd[@]}" ps -q "$service_name" 2>/dev/null || true)"
    if [[ -z "$container_id" ]]; then
      sleep 2
      continue
    fi
    status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
    if [[ "$status" == "running" ]]; then
      return 0
    fi
    if [[ "$status" == "exited" || "$status" == "dead" ]]; then
      echo "Service $service_name is not running (status=$status)." >&2
      return 1
    fi
    sleep 2
  done

  echo "Service $service_name did not become running after ${timeout_sec}s." >&2
  return 1
}

run_ml_profile_sync() {
  local collection
  local batch_size
  local qdrant_url
  local default_categories
  local delete_orphans
  local upsert_existing
  local direct_upsert_fallback
  local sync_args=()

  collection="$(read_env_value ML_SYNC_COLLECTION)"
  batch_size="$(read_env_value ML_SYNC_BATCH_SIZE)"
  qdrant_url="$(read_env_value ML_SYNC_QDRANT_URL)"
  default_categories="$(read_env_value ML_SYNC_DEFAULT_CATEGORIES)"
  delete_orphans="$(read_env_value ML_SYNC_DELETE_ORPHANS)"
  upsert_existing="$(read_env_value ML_SYNC_UPSERT_EXISTING)"
  direct_upsert_fallback="$(read_env_value ML_SYNC_DIRECT_UPSERT_FALLBACK)"

  if [[ -z "$collection" ]]; then
    collection="user_profiles"
  fi
  if [[ -z "$batch_size" ]]; then
    batch_size="200"
  fi
  if [[ -z "$delete_orphans" ]]; then
    delete_orphans="true"
  fi
  if [[ -z "$upsert_existing" ]]; then
    upsert_existing="false"
  fi
  if [[ -z "$direct_upsert_fallback" ]]; then
    direct_upsert_fallback="true"
  fi

  sync_args+=(python -m scripts.sync_ml_profiles)
  sync_args+=(--collection "$collection")
  sync_args+=(--batch-size "$batch_size")

  if [[ -n "$qdrant_url" ]]; then
    sync_args+=(--qdrant-url "$qdrant_url")
  fi
  if [[ -n "$default_categories" ]]; then
    sync_args+=(--default-categories "$default_categories")
  fi
  if is_truthy "$delete_orphans"; then
    sync_args+=(--delete-orphans)
  fi
  if is_truthy "$upsert_existing"; then
    sync_args+=(--upsert-existing)
  fi
  if ! is_truthy "$direct_upsert_fallback"; then
    sync_args+=(--no-direct-upsert-fallback)
  fi

  echo "Running ML profile sync..."
  "${compose_cmd[@]}" exec -T backend "${sync_args[@]}"
}

if is_truthy "$(read_env_value ML_TRAIN_ON_START)"; then
  if [[ -z "$(read_env_value ML_TRAIN_DATA_URL)" ]]; then
    if is_truthy "$(read_env_value ML_TRAIN_REQUIRED)"; then
      echo "ML_TRAIN_ON_START=true and ML_TRAIN_REQUIRED=true but ML_TRAIN_DATA_URL is empty in deploy/.env" >&2
      exit 1
    fi
    echo "WARNING: ML_TRAIN_ON_START=true but ML_TRAIN_DATA_URL is empty. Training will be skipped." >&2
  fi
fi

if ! "${compose_cmd[@]}" up -d --remove-orphans db redis minio; then
  echo "Failed to start infrastructure services." >&2
  print_diagnostics
  exit 1
fi

if ! "${compose_cmd[@]}" up --abort-on-container-exit --exit-code-from minio-init minio-init; then
  echo "MinIO bucket initialization failed." >&2
  print_diagnostics
  exit 1
fi

if ! "${compose_cmd[@]}" up -d --build --remove-orphans ml-service centrifugo backend caddy; then
  echo "Failed to start application services." >&2
  print_diagnostics
  exit 1
fi

if ! wait_for_backend_health 180; then
  echo "Backend did not become healthy after startup." >&2
  print_diagnostics
  exit 1
fi

if ! wait_for_service_running caddy 60; then
  echo "Caddy did not start correctly." >&2
  print_diagnostics
  exit 1
fi

if ! wait_for_service_running centrifugo 60; then
  echo "Centrifugo did not start correctly." >&2
  print_diagnostics
  exit 1
fi

if ! wait_for_service_running ml-service 120; then
  echo "ml-service did not start correctly." >&2
  print_diagnostics
  exit 1
fi

sync_on_deploy="$(read_env_value ML_SYNC_ON_DEPLOY)"
if [[ -z "$sync_on_deploy" ]]; then
  sync_on_deploy="true"
fi

if is_truthy "$sync_on_deploy"; then
  if ! run_ml_profile_sync; then
    echo "ML profile sync failed." >&2
    print_diagnostics
    exit 1
  fi
else
  echo "ML profile sync disabled (ML_SYNC_ON_DEPLOY=false)."
fi

"${compose_cmd[@]}" ps || true
