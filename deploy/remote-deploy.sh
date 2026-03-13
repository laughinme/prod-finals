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

docker compose \
  --env-file deploy/.env \
  -f docker-compose.prod.yml \
  up -d --build --remove-orphans

docker compose \
  --env-file deploy/.env \
  -f docker-compose.prod.yml \
  ps
