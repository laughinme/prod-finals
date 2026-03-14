# ML Service

Internal FastAPI service for:

- recommendations (`/v1/recommendations`)
- explanations (`/v1/explanations/compatibility`)
- feedback ingestion (`/v1/interactions/*`)
- health (`/v1/health`)

## Infrastructure (like backend)

- Poetry project file: `ml/pyproject.toml`
- Fly config: `ml/fly.toml`
- Docker image with Poetry install: `ml/Dockerfile`
- Runtime entrypoint: `ml/entry.sh`

Fly deploy example:

```bash
cd ml
fly launch --copy-config --no-deploy
fly deploy
```

## Run locally

```bash
docker compose up -d ml-service
```

Service URL: `http://localhost:8081`  
Auth header: `X-Service-Token: dev-ml-token`

## Train model on deploy/startup

At container startup, training can be enabled with:

- `ML_TRAIN_ON_START=true`
- `ML_TRAIN_DATA_URL=https://.../train.csv`

The startup script downloads dataset from URL and writes model artifact:

- data path: `ML_TRAIN_DATA_PATH` (default `/app/ml/data/train.csv`)
- artifact path: `ML_MODEL_ARTIFACT_PATH` (default `/app/ml/artifacts/model.json`)

In production compose, training-on-start is enabled by default.
