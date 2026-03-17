# ML сервис

Внутренний FastAPI-сервис для:

- рекомендаций (`/v1/recommendations`)
- объяснений (`/v1/explanations/compatibility`)
- приёма фидбэка (`/v1/interactions/*`)
- health-check (`/v1/health`)

## Инфраструктура (как у backend)

- Poetry-проект: `ml/pyproject.toml`
- Конфиг Fly: `ml/fly.toml`
- Docker-образ с установкой через Poetry: `ml/Dockerfile`
- Runtime entrypoint: `ml/entry.sh`

Пример деплоя во Fly:

```bash
cd ml
fly launch --copy-config --no-deploy
fly deploy
```

## Локальный запуск

```bash
docker compose up -d ml-service
```

URL сервиса: `http://localhost:8081`  
Заголовок авторизации: `X-Service-Token: dev-ml-token`

## Продовый флоу обучения (вручную)

Обучение отключено в deploy-пайплайне и по умолчанию не запускается при старте сервиса:

- `ML_TRAIN_ON_START=false`
- `ML_TRAIN_REQUIRED=false`

Рекомендуемый порядок:

1. Деплой приложения (ML-сервис стартует в режиме инференса).
2. Подключение к VM по SSH.
3. Запуск скрипта ручного обучения:

```bash
cd /opt/chupapis
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.csv"
```

Поддерживается и ZIP URL:

```bash
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.zip"
```

Опциональный второй аргумент задаёт точный ключ модели в S3:

```bash
bash deploy/manual-train-ml.sh "https://example.com/path/to/train.csv" "ml-models/manual-v1.json"
```

Опциональный третий аргумент задаёт путь до CSV внутри ZIP (когда в архиве несколько CSV):

```bash
bash deploy/manual-train-ml.sh \
  "https://example.com/path/to/train.zip" \
  "ml-models/manual-v2.json" \
  "datasets/train.csv"
```

Что делает скрипт:

- поднимает MinIO и инициализацию bucket
- скачивает датасет по URL
- обучает модель (`python -m ml.scripts.train_model`)
- пишет артефакт в `/app/ml/artifacts/model.json` (docker volume)
- загружает артефакт в S3/MinIO
- перезапускает `ml-service`, чтобы подхватить свежий артефакт

Конфиг загрузки для `train_model.py`:

- основные переменные: `ML_MODEL_S3_*`
- fallback-переменные: `STORAGE_*` (`STORAGE_ENDPOINT_INTERNAL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PRIVATE_BUCKET`, `STORAGE_REGION`)
