#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
  echo "Docker Compose is missing. Install docker-compose-plugin or docker-compose." >&2
  exit 1
fi

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

print_diagnostics() {
  "${compose_cmd[@]}" ps || true
  echo
  "${compose_cmd[@]}" logs --tail=200 ml-service backend nginx db redis minio minio-init || true
}

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

if ! "${compose_cmd[@]}" up -d --build --remove-orphans --wait --wait-timeout 150 backend nginx; then
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

if is_truthy "$(read_env_value ML_TRAIN_ON_START)"; then
  if [[ -z "$(read_env_value ML_TRAIN_DATA_URL)" ]]; then
    echo "ML_TRAIN_ON_START=true but ML_TRAIN_DATA_URL is empty in deploy/.env" >&2
    exit 1
  fi
fi

if ! "${compose_cmd[@]}" up -d --build --remove-orphans --wait --wait-timeout 150; then
  echo "Deployment failed. Printing compose diagnostics..." >&2
  print_diagnostics
  exit 1
fi

"${compose_cmd[@]}" ps
