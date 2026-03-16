from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AvatarAsset:
    filename: str
    content_type: str
    payload: bytes


def _docs_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "docs"


def _assets_dir() -> Path:
    return Path(__file__).resolve().parent / "assets"


@lru_cache
def load_default_avatar_asset() -> AvatarAsset:
    path = _assets_dir() / "chichis.png"
    if not path.exists():
        path = _docs_dir() / "chichis.png"
    return AvatarAsset(
        filename="default-avatar.png",
        content_type="image/png",
        payload=path.read_bytes(),
    )


@lru_cache
def load_dataset_avatar_asset() -> AvatarAsset:
    path = _assets_dir() / "sponge_bob.jpg"
    if not path.exists():
        path = _docs_dir() / "sponge_bob.jpg"
    return AvatarAsset(
        filename="dataset-avatar.jpg",
        content_type="image/jpeg",
        payload=path.read_bytes(),
    )
