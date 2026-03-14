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

## Production training flow (manual)

Training is disabled in deploy pipeline and disabled on service startup by default:

- `ML_TRAIN_ON_START=false`
- `ML_TRAIN_REQUIRED=false`

Recommended flow:

1. Deploy app (ML service starts in inference mode).
2. SSH to VM.
3. Run manual training script:

```bash
cd /opt/chupapis
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.csv"
```

ZIP URL is supported too:

```bash
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.zip"
```

Optional second argument sets exact model key in S3:

```bash
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.csv" "ml-models/manual-v1.json"
```

Optional third argument selects CSV path inside ZIP (when archive contains multiple CSV files):

```bash
bash deploy/manual-train-ml.sh \
  "https://example.com/path/to/train.zip" \
  "ml-models/manual-v2.json" \
  "datasets/train.csv"
```

What script does:

- starts MinIO and bucket init
- downloads dataset from URL
- trains model (`python -m ml.scripts.train_model`)
- writes artifact to `/app/ml/artifacts/model.json` (docker volume)
- uploads artifact to S3/MinIO
- restarts `ml-service` to load fresh artifact

Upload config for `train_model.py`:

- primary vars: `ML_MODEL_S3_*`
- fallback vars: `STORAGE_*` (`STORAGE_ENDPOINT_INTERNAL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PRIVATE_BUCKET`, `STORAGE_REGION`)
