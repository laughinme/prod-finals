#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

compose_cmd=(
  docker compose
  --env-file deploy/.env
  -f docker-compose.prod.yml
)

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
  "${compose_cmd[@]}" logs --tail=200 backend nginx db redis minio minio-init || true
}

if ! "${compose_cmd[@]}" up -d --build --remove-orphans --wait --wait-timeout 150; then
  echo "Deployment failed. Printing compose diagnostics..." >&2
  print_diagnostics
  exit 1
fi

"${compose_cmd[@]}" ps
