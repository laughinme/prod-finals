#!/usr/bin/env bash
set -euo pipefail

if [[ "${ML_TRAIN_ON_START:-false}" == "true" ]]; then
  echo "ML_TRAIN_ON_START=true -> running training pipeline"
  python -m ml.scripts.train_model
fi

echo "Starting ML service..."
exec uvicorn ml.main:app \
  --host "${API_HOST:-0.0.0.0}" \
  --port "${API_PORT:-8080}"
