# ML EDA

This document contains reproducible exploratory checks for the matchmaking dataset and serving layer.

## Data source

- Transactions CSV in pipeline input (`party_rk`, `category_nm`, `real_transaction_dttm`)
- Loader: `ml/learn/prepare_data.py`
- Training entrypoint: `ml/scripts/train_model.py`

## Quick dataset checks

Run inside repository root:

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

## Serving layer checks (Postgres vs Qdrant sync)

```bash
dc='docker compose --env-file deploy/.env -f docker-compose.prod.yml'

$dc exec -T db psql -U postgres -d chupapis -c \
"select count(*) as users_total, count(*) filter (where is_dataset_user) as dataset_users from users;"

curl -sS http://127.0.0.1:6333/collections/user_profiles | jq '.result.points_count'
```

Expected: `points_count` in Qdrant is close to `users_total` in Postgres after `scripts.sync_ml_profiles`.

## Recommendation quality sanity checks

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

## Privacy checks for explanations

The explanation text should only contain aggregated signals and category-level labels:

- No raw transactions
- No merchant names
- No amounts/timestamps

The enforcement path is in:

- `backend/src/service/matchmaking/ml_facade.py`
- `ml/service/runtime.py`
