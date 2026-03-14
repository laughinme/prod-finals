# Deployment

This repository now contains a simple single-VM deployment path for Spirit/GitLab.

## What Spirit/GitLab does here

- Spirit stores repository-level and team-level CI/CD variables.
- GitLab injects those variables into pipeline jobs.
- The deploy job copies files to the target VM and runs `docker compose` there.
- Variables are not written into your application `.env` automatically. The pipeline does that explicitly.
- The backend now reads `deploy/.env` directly through Compose `env_file`, so production settings live in one place instead of a long YAML variable map.

## Why there is a separate production compose file

`docker-compose.yml` is still development-oriented and hardcodes local defaults like `APP_STAGE=dev`, local database URLs, and local MinIO credentials.

`docker-compose.prod.yml` uses `deploy/.env` as the single source of truth for backend settings and only keeps small service-specific mappings for infrastructure containers.

## Variables to create in Spirit

Create these in the repository CI variables section for this project.

### Regular variables

- `DEPLOY_HOST`: target VM IP or DNS name.
- `DEPLOY_PORT`: SSH port. Default is `22`.
- `DEPLOY_USER`: Linux user used for SSH.
- `DEPLOY_PATH`: optional deploy directory on VM, default `/opt/chupapis`.
- `DEPLOY_SSH_KNOWN_HOSTS`: optional `known_hosts` line for strict SSH host verification.

### File-type variables

- `DEPLOY_SSH_PRIVATE_KEY_FILE`: private SSH key used by CI to connect to the VM.
- `PROD_ENV_FILE`: contents of the production env file. Start from `deploy/.env.example`.

Set `Environment scope` to `production` for production-only secrets, because the deploy job uses:

```yaml
environment:
  name: production
```

If you leave scope as `*`, the variable is available to all jobs.

## How the files map to your current local setup

- `backend/.env` -> `PROD_ENV_FILE`
- `JWT_SECRET` now lives inside that env file, so отдельные JWT key files больше не нужны.
- `JWT_ALGO` should now be one of `HS256`, `HS384`, `HS512`. If `RS256` is left in the prod env, auth requests will fail when the app tries to issue JWTs with a shared secret.

`backend/secrets/db.txt` is still not used by the application code right now, so it does not need to be deployed unless you start reading it in code later.

## First VM bootstrap

You already have a VM now, so the next step is to bootstrap it for Docker-based deploys.

Minimal setup on the VM:

```bash
sudo apt update
sudo apt install -y docker.io rsync
sudo apt install -y docker-compose-v2 || sudo apt install -y docker-compose
sudo usermod -aG docker "$USER"
sudo mkdir -p /opt/chupapis
sudo chown -R "$USER":"$USER" /opt/chupapis
```

Then reconnect so the docker group is applied.

## Deploy flow

1. Push to `master`.
2. Open the GitLab pipeline.
3. Run the manual job `deploy:production`.
4. The job syncs the repo to the VM.
5. The job uploads `deploy/.env`.
6. The job runs `bash deploy/remote-deploy.sh` on the VM and waits until services are healthy.
7. During `ml-service` startup, training runs automatically when `ML_TRAIN_ON_START=true` and dataset is downloaded from `ML_TRAIN_DATA_URL`.

## Notes

- Frontend is built inside the nginx image during deployment.
- Keep `VITE_API_BASE_URL=` empty in production if frontend and backend are served from one domain through nginx.
- Backend migrations run automatically from `backend/entry.sh` when the backend container starts.
- ML model training can run automatically during deploy via `ml/entry.sh` + `ML_TRAIN_DATA_URL`.
- A plain `502 Bad Gateway` on `/api/*` usually means nginx is up but the `backend` container never became healthy or exited during startup.

## Quick debugging on the VM

Connect with the SSH command from Spirit, then run:

```bash
cd /opt/chupapis
docker compose --env-file deploy/.env -f docker-compose.prod.yml ps
docker compose --env-file deploy/.env -f docker-compose.prod.yml logs -f backend
docker compose --env-file deploy/.env -f docker-compose.prod.yml logs -f nginx
docker compose --env-file deploy/.env -f docker-compose.prod.yml exec backend sh
```

What to look for first:

- `DATABASE_URL` or `REDIS_URL` pointing to `localhost` instead of `db` / `redis`.
- Short or missing `JWT_SECRET`.
- `JWT_ALGO=RS256` left over after switching to shared-secret JWT signing.
- Alembic migration errors from `backend/entry.sh`.
