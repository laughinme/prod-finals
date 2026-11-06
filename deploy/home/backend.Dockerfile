# Backend image for the home server. Same as backend/Dockerfile, plus httpx: the code imports it at runtime
# (main.py, outbox dispatcher, ML sync) but pyproject.toml lists it only in the dev group, so
# `poetry install --only main` leaves it out and the container fails with ModuleNotFoundError.
# Build context is backend/ (docker build -f deploy/home/backend.Dockerfile backend).
FROM python:3.13.7-slim

WORKDIR /app

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN pip install --no-cache-dir "poetry==2.3.2"

COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root \
    && pip install --no-cache-dir "httpx>=0.28.1,<0.29.0"

COPY src ./src
COPY entry.sh .

ENV PYTHONPATH=/app/src

RUN chmod +x entry.sh

EXPOSE 8080

ENTRYPOINT ["./entry.sh"]
