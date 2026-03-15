#!/usr/bin/env bash
set -e

echo "Running Alembic migrations..."
cd src
alembic upgrade head

if [ "${MOCK_USER_SEED_ENABLED:-false}" = "true" ]; then
  echo "Running mock user seed..."
  python -m scripts.seed_mock_users
fi

echo "Starting the application..."
exec uvicorn main:app \
  --host "${API_HOST:-0.0.0.0}" \
  --port "${API_PORT:-8080}" \
  --proxy-headers \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
