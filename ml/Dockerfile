FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN pip install --no-cache-dir "poetry==2.3.2"

COPY ml/pyproject.toml /app/pyproject.toml
RUN poetry install --only main --no-root

COPY ml /app/ml
RUN chmod +x /app/ml/entry.sh

EXPOSE 8080

ENTRYPOINT ["/app/ml/entry.sh"]
