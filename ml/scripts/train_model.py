from __future__ import annotations

import os
from pathlib import Path
import urllib.request

import boto3
from botocore.config import Config

from ml.learn.model import artifact_to_json_bytes, train_profile_model
from ml.learn.prepare_data import load_transactions_csv


def _as_bool(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _download_file(url: str, destination: Path, timeout_sec: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=timeout_sec) as response:  # noqa: S310
        payload = response.read()
    destination.write_bytes(payload)


def _first_env_value(*names: str) -> str:
    for name in names:
        raw = os.getenv(name)
        if raw is None:
            continue
        value = raw.strip()
        if value:
            return value
    return ""


def _normalize_endpoint_url(raw_endpoint: str, secure: bool) -> str:
    endpoint = raw_endpoint.strip()
    if not endpoint:
        return ""
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    scheme = "https" if secure else "http"
    return f"{scheme}://{endpoint}"


def _resolve_upload_config(
    *,
    model_version: str,
    artifact_path: Path,
) -> tuple[str, str, str, str, str, str] | None:
    upload_required = _as_bool(os.getenv("ML_MODEL_UPLOAD_REQUIRED"), default=False)

    region = _first_env_value("ML_MODEL_S3_REGION", "STORAGE_REGION")
    if not region:
        region = "us-east-1"

    access_key = _first_env_value("ML_MODEL_S3_ACCESS_KEY", "STORAGE_ACCESS_KEY")
    secret_key = _first_env_value("ML_MODEL_S3_SECRET_KEY", "STORAGE_SECRET_KEY")
    bucket = _first_env_value("ML_MODEL_S3_BUCKET", "STORAGE_PRIVATE_BUCKET")

    raw_endpoint = _first_env_value("ML_MODEL_S3_ENDPOINT", "STORAGE_ENDPOINT_INTERNAL")
    secure_env = os.getenv("ML_MODEL_S3_SECURE")
    secure = _as_bool(secure_env, default=True) if secure_env is not None else not raw_endpoint.startswith("http://")
    endpoint_url = _normalize_endpoint_url(raw_endpoint, secure=secure)

    explicit_key = _first_env_value("ML_MODEL_S3_KEY")
    prefix = os.getenv("ML_MODEL_S3_PREFIX", "ml-models").strip().strip("/")
    key = explicit_key.lstrip("/") if explicit_key else ""
    if not key:
        model_filename = f"{model_version}.json" if model_version else artifact_path.name
        key = f"{prefix}/{model_filename}" if prefix else model_filename

    missing: list[str] = []
    if not access_key:
        missing.append("ML_MODEL_S3_ACCESS_KEY/STORAGE_ACCESS_KEY")
    if not secret_key:
        missing.append("ML_MODEL_S3_SECRET_KEY/STORAGE_SECRET_KEY")
    if not bucket:
        missing.append("ML_MODEL_S3_BUCKET/STORAGE_PRIVATE_BUCKET")

    if missing:
        if upload_required:
            raise RuntimeError(
                f"Model upload config is incomplete ({', '.join(missing)}) "
                "while ML_MODEL_UPLOAD_REQUIRED=true."
            )
        print(
            "Model upload skipped: missing config -> "
            + ", ".join(missing)
        )
        return None

    return endpoint_url, region, access_key, secret_key, bucket, key


def _upload_artifact(
    *,
    payload: bytes,
    endpoint_url: str,
    region: str,
    access_key: str,
    secret_key: str,
    bucket: str,
    key: str,
) -> str:
    force_path_style = _as_bool(os.getenv("ML_MODEL_S3_FORCE_PATH_STYLE"), default=True)
    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url or None,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            s3={"addressing_style": "path" if force_path_style else "auto"},
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=payload,
        ContentType="application/json",
    )
    return f"s3://{bucket}/{key}"


def main() -> int:
    data_url = os.getenv("ML_TRAIN_DATA_URL", "").strip()
    data_path = Path(os.getenv("ML_TRAIN_DATA_PATH", "/app/ml/data/train.csv"))
    artifact_path = Path(os.getenv("ML_MODEL_ARTIFACT_PATH", "/app/ml/artifacts/model.json"))
    timeout_sec = int(os.getenv("ML_TRAIN_DOWNLOAD_TIMEOUT_SEC", "120"))
    required = _as_bool(os.getenv("ML_TRAIN_REQUIRED"), default=False)

    if data_url:
        print(f"Downloading training data from: {data_url}")
        _download_file(data_url, data_path, timeout_sec=timeout_sec)
        print(f"Training data saved to: {data_path}")
    elif data_path.exists():
        print(f"Using existing local training data: {data_path}")
    else:
        if required:
            raise RuntimeError(
                "Training data is missing. Set ML_TRAIN_DATA_URL or place a dataset at ML_TRAIN_DATA_PATH."
            )
        print("ML training skipped: no dataset URL and no local dataset file.")
        return 0

    transactions = load_transactions_csv(data_path)
    artifact = train_profile_model(transactions)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_payload = artifact_to_json_bytes(artifact)
    artifact_path.write_bytes(artifact_payload)
    print(f"Model artifact saved to: {artifact_path}")

    upload_config = _resolve_upload_config(model_version=artifact.model_version, artifact_path=artifact_path)
    if upload_config is not None:
        endpoint_url, region, access_key, secret_key, bucket, key = upload_config
        model_uri = _upload_artifact(
            payload=artifact_payload,
            endpoint_url=endpoint_url,
            region=region,
            access_key=access_key,
            secret_key=secret_key,
            bucket=bucket,
            key=key,
        )
        print(f"Model artifact uploaded to: {model_uri}")

    print(
        f"Training finished: users={artifact.user_count}, tx={artifact.transaction_count}, "
        f"version={artifact.model_version}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
