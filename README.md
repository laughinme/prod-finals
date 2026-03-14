# Fullstack monolith application template

The app requires postgres and redis launched locally to start. I prefer keeping it all as docker containers.

You can start postgresql via docker command:
```
docker run -d --name template-pg \
-e POSTGRES_USER=postgres \
-e POSTGRES_PASSWORD=secret \
-e POSTGRES_DB=template-pg \
-p 5432:5432 \
-v template_pg_data:/var/lib/postgresql/data \
postgres:17
```

Redis can also be started the same way:

```docker run -d --name redis -p 6379:6379 redis:latest```

Next step in running preexisting migrations to create database tables and seed data in them. It can be done using alembic:

```alembic upgrade head```

After these steps you can run the app locally with uvicorn:

```uvicorn main:app --host 0.0.0.0 --port 8080 --log-level debug --reload```

## Demo seed

Backend can bootstrap demo dating profiles for frontend development.

Set:

```DEV_SEED_ENABLED=true```

When enabled outside prod, startup seeds demo users with completed onboarding and approved avatars.

Demo password for all seeded users:

```DemoPass123!```

Demo logins by email:

- `anna.demo@example.com`
- `maria.demo@example.com`
- `dima.demo@example.com`
- `kirill.demo@example.com`
- `olga.demo@example.com`
- `ivan.demo@example.com`
- `alisa.demo@example.com`
- `roman.demo@example.com`
- `admin.demo@example.com`

Demo aliases for `POST /api/v1/auth/demo-login`:

- `anna`
- `maria`
- `dima`
- `kirill`
- `olga`
- `ivan`
- `alisa`
- `roman`
- `admin_demo`

`demo-login` is intended for demo/dev flows and is disabled in `prod`.

## API notes

Success payloads for dating/frontend routes are aligned to `docs/public-api-final.yaml`.

One intentional wire-level deviation remains:

- error responses still use the template `problem+json` envelope with `request_id`, not the final YAML `ErrorResponse` shape.

---
