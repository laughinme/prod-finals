# ML EDA

Этот документ содержит воспроизводимые exploratory-проверки для датасета мэтчинга и serving-слоя.

## Источник данных

- CSV транзакций во входе пайплайна (`party_rk`, `category_nm`, `real_transaction_dttm`)
- Загрузчик: `ml/learn/prepare_data.py`
- Точка входа обучения: `ml/scripts/train_model.py`

## Быстрые проверки датасета

Запуск из корня репозитория:

```bash
python - <<'PY'
from collections import Counter
from ml.learn.prepare_data import load_transactions_csv

tx = load_transactions_csv("transaction_600_new.csv")
users = {t.user_id for t in tx}
cats = Counter(t.category for t in tx)
print("transactions:", len(tx))
print("users:", len(users))
print("categories:", len(cats))
print("top_categories:", cats.most_common(15))
PY
```

## Проверки serving-слоя (синхрон Postgres и Qdrant)

```bash
dc='docker compose --env-file deploy/.env -f docker-compose.prod.yml'

$dc exec -T db psql -U postgres -d chupapis -c \
"select count(*) as users_total, count(*) filter (where is_dataset_user) as dataset_users from users;"

curl -sS http://127.0.0.1:6333/collections/user_profiles | jq '.result.points_count'
```

Ожидание: `points_count` в Qdrant близок к `users_total` в Postgres после `scripts.sync_ml_profiles`.

## Санити-проверки качества рекомендаций

```bash
dc='docker compose --env-file deploy/.env -f docker-compose.prod.yml'

$dc exec -T db psql -U postgres -d chupapis -c "
select decision_mode, count(*)
from recommendation_batches
where created_at > now() - interval '24 hours'
group by 1
order by 1;"

$dc exec -T db psql -U postgres -d chupapis -c "
select coalesce(ri.category_breakdown->0->>'label','<none>') as top_category, count(*) as cards
from recommendation_items ri
join recommendation_batches rb on rb.id = ri.batch_id
where rb.created_at > now() - interval '24 hours'
group by 1
order by cards desc
limit 20;"
```

## Privacy-проверки для explanations

Текст объяснений должен содержать только агрегированные сигналы и метки уровня категорий:

- Без сырых транзакций
- Без названий мерчантов
- Без сумм и таймстемпов

Путь enforcement в коде:

- `backend/src/service/matchmaking/ml_facade.py`
- `ml/service/runtime.py`
