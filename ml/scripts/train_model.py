from __future__ import annotations

from pathlib import Path
import os
import urllib.request

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


def main() -> int:
    data_url = os.getenv("ML_TRAIN_DATA_URL", "").strip()
    data_path = Path(os.getenv("ML_TRAIN_DATA_PATH", "/app/ml/data/train.csv"))
    artifact_path = Path(os.getenv("ML_MODEL_ARTIFACT_PATH", "/app/ml/artifacts/model.json"))
    timeout_sec = int(os.getenv("ML_TRAIN_DOWNLOAD_TIMEOUT_SEC", "120"))
    required = _as_bool(os.getenv("ML_TRAIN_REQUIRED"), default=False)

    if not data_url:
        if required:
            raise RuntimeError("ML_TRAIN_DATA_URL is required when ML_TRAIN_REQUIRED=true.")
        print("ML training skipped: ML_TRAIN_DATA_URL is empty.")
        return 0

    print(f"Downloading training data from: {data_url}")
    _download_file(data_url, data_path, timeout_sec=timeout_sec)
    print(f"Training data saved to: {data_path}")

    transactions = load_transactions_csv(data_path)
    artifact = train_profile_model(transactions)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_bytes(artifact_to_json_bytes(artifact))
    print(f"Model artifact saved to: {artifact_path}")
    print(
        f"Training finished: users={artifact.user_count}, tx={artifact.transaction_count}, "
        f"version={artifact.model_version}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
