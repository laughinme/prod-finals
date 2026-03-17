from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AvatarAsset:
    filename: str
    content_type: str
    payload: bytes


def _docs_dir() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "docs"
        if candidate.exists():
            return candidate
    return Path(__file__).resolve().parents[2] / "docs"


def _assets_dir() -> Path:
    return Path(__file__).resolve().parent / "assets"


def _resolve_asset_path(*filenames: str) -> Path:
    for base_dir in (_assets_dir(), _docs_dir()):
        for filename in filenames:
            candidate = base_dir / filename
            if candidate.exists():
                return candidate
    return _assets_dir() / filenames[0]


@lru_cache
def load_default_avatar_asset() -> AvatarAsset:
    path = _resolve_asset_path("chichis.png")
    return AvatarAsset(
        filename="default-avatar.png",
        content_type="image/png",
        payload=path.read_bytes(),
    )


@lru_cache
def load_dataset_avatar_asset() -> AvatarAsset:
    path = _resolve_asset_path("saul.jpeg")
    return AvatarAsset(
        filename="dataset-avatar.jpeg",
        content_type="image/jpeg",
        payload=path.read_bytes(),
    )
