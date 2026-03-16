# T-Match

Дейтинг-платформа с персональными рекомендациями на основе анкеты, поведенческих сигналов и агрегированных транзакционных категорий.

## Быстрые ссылки

- Прод-фронтенд: <https://team-26-prod-5df88b.pages.prodcontest.ru>
- Backend Swagger UI: <https://team-26-prod-5df88b.pages.prodcontest.ru/api/docs>
- Backend OpenAPI: <https://team-26-prod-5df88b.pages.prodcontest.ru/api/openapi.json>
- Репозиторий frontend: <https://gitlab.prodcontest.com/team-26/chupapis/-/tree/master/frontend>
- Репозиторий backend: <https://gitlab.prodcontest.com/team-26/chupapis/-/tree/master/backend>
- Репозиторий ML: <https://gitlab.prodcontest.com/team-26/chupapis/-/tree/master/ml>
- ML Swagger: <https://team-26-prod-5df88b.pages.prodcontest.ru/ml/docs>
- ML Swagger (локально): <http://localhost:8081/docs>
- ML OpenAPI (локально): <http://localhost:8081/openapi.json>
- ML API спецификация в репо: [`docs/internal-ml-api.yaml`](docs/internal-ml-api.yaml)
- Публичный API контракт (backend): [`docs/public-api-final.yaml`](docs/public-api-final.yaml)
- Демо юзер login: mock-user-0003@example.com Password: DemoPass123!
- Демо админ login: admin@example.com Password: DemoPass123!

## E2E пользовательский путь

1. Онбординг + обязательные поля профиля + фото.
2. Получение персональной ленты.
3. Действия в ленте (like/pass/hide), открытие объяснений.
4. При взаимном like создается match и conversation.
5. Доступны block/report из пользовательского потока.
6. Все ключевые события пишутся в audit/outbox.

## Архитектура

- `frontend` — React + Vite.
- `backend` — FastAPI, Postgres, Redis, бизнес-правила контактов/безопасности.
- `ml` — FastAPI ML-сервис, ранжирование и explanations, Catboost.
- `qdrant` — векторное хранилище user profiles.
- `minio` — хранение медиа.
- `centrifugo` — realtime канал для событий.
- `caddy` (prod) / `nginx` (dev) — внешний reverse proxy.

## Как работает выдача рекомендаций

1. Backend строит пул кандидатов с фильтрами безопасности и совместимости.
2. Backend отправляет запрос в ML (`/v1/recommendations`).
3. ML возвращает кандидатов, score, reason signals и category components.
4. Backend сохраняет daily batch (`recommendation_batches`, `recommendation_items`).
5. Front получает карточки через `/api/v1/feed`.
6. На свайп backend пишет interaction и outbox-событие `ml.interactions.swipe`, затем воркер доставляет в ML (`/v1/interactions/swipe`).

## Безопасность и anti-abuse

- Чат доступен только после match.
- После pass/block действует исключение из повторного показа (с учетом cooldown-правила).
- Block/report встроены в основной пользовательский поток.
- Ведется аудит ключевых действий (`audit_log` + outbox).

## Локальный запуск

```bash
docker compose up -d
```

После запуска:

- frontend: <http://localhost>
- backend: <http://localhost:8080/api/docs>
- ml-service: <http://localhost:8081/docs>
- qdrant: <http://localhost:6333/dashboard>

## Прод деплой

Основной сценарий деплоя описан в [`deploy/README.md`](deploy/README.md).  
Ручное обучение модели и загрузка артефакта:

```bash
bash deploy/manual-train-ml.sh "<dataset_url_or_zip_url>"
```

## Материалы для секции ML

- EDA: [`ml/EDA.md`](ml/EDA.md)
- Пайплайн обучения: [`ml/scripts/train_model.py`](ml/scripts/train_model.py), [`deploy/manual-train-ml.sh`](deploy/manual-train-ml.sh)
- Код рантайма ML: [`ml/service/runtime.py`](ml/service/runtime.py)
- Контракт ML API: [`docs/internal-ml-api.yaml`](docs/internal-ml-api.yaml)

### Бэкенд

- README: <https://gitlab.prodcontest.com/team-26/chupapis/-/blob/master/README.md>
- Swagger/OpenAPI:  
  <https://team-26-prod-5df88b.pages.prodcontest.ru/api/docs>  
  <https://team-26-prod-5df88b.pages.prodcontest.ru/api/openapi.json>

### Фронтенд

- Деплой: <https://team-26-prod-5df88b.pages.prodcontest.ru>
- Код: <https://gitlab.prodcontest.com/team-26/chupapis/-/tree/master/frontend>
- Тестовые логины/пароль: см. раздел выше.
- APK/IPA: не применимо (web-приложение).

### ML

- EDA: <https://gitlab.prodcontest.com/team-26/chupapis/-/blob/master/ml/EDA.md>
- Пайплайн обучения: <https://gitlab.prodcontest.com/team-26/chupapis/-/blob/master/ml/scripts/train_model.py>
- ML код: <https://gitlab.prodcontest.com/team-26/chupapis/-/tree/master/ml>
- Swagger ML (локально/внутренне):  
  <http://localhost:8081/docs>  
  `http://ml-service:8080/docs`
