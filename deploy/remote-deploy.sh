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
  "${compose_cmd[@]}" logs --tail=200 ml-service backend nginx db redis minio minio-init || true
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

if is_truthy "$(read_env_value ML_TRAIN_ON_START)"; then
  if [[ -z "$(read_env_value ML_TRAIN_DATA_URL)" ]]; then
    echo "ML_TRAIN_ON_START=true but ML_TRAIN_DATA_URL is empty in deploy/.env" >&2
    exit 1
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

if "${compose_cmd[@]}" up --help 2>/dev/null | grep -q -- '--wait'; then
  if ! "${compose_cmd[@]}" up -d --build --remove-orphans --wait --wait-timeout 180 ml-service backend nginx; then
    echo "Failed to start application services." >&2
    print_diagnostics
    exit 1
  fi
else
  if ! "${compose_cmd[@]}" up -d --build --remove-orphans ml-service backend nginx; then
    echo "Failed to start application services." >&2
    print_diagnostics
    exit 1
  fi
  if ! wait_for_backend_health 180; then
    echo "Backend did not become healthy after startup." >&2
    print_diagnostics
    exit 1
  fi
fi

"${compose_cmd[@]}" ps
