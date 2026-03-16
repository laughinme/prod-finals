import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from domain.dating import CompatibilityCategoryScore, CompatibilityPreview
from service.feed.service import FeedService, _is_template_preview


class _FakeMlFacade:
    def __init__(self, preview_text: str) -> None:
        self.preview_text = preview_text
        self.called = 0

    async def build_preview(self, _scored):
        self.called += 1
        return CompatibilityPreview(
            score=0.91,
            score_percent=91,
            preview=self.preview_text,
            reason_codes=["category_fit"],
            reason_signals=[],
            category_breakdown=[
                CompatibilityCategoryScore(
                    category_key="entertainment",
                    label="Развлечения",
                    score_percent=91,
                )
            ],
        )


@pytest.mark.unit
def test_is_template_preview_detects_known_fallbacks():
    assert _is_template_preview("Ваш общий интерес — «Развлечения».") is True
    assert _is_template_preview("Хорошее совпадение по интересам: «Транспорт».") is True
    assert _is_template_preview("Найдены признаки совместимости по интересам и поведению.") is True
    assert _is_template_preview("Вам легко договориться о формате встреч и досуга.") is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_template_previews_replaces_fallback_text():
    service = FeedService.__new__(FeedService)
    service.ml_facade = _FakeMlFacade("Вам легко находить общий ритм встреч и интересов.")

    item = SimpleNamespace(
        id=uuid4(),
        target_user_id=uuid4(),
        score=0.93,
        preview="Ваш общий интерес — «Развлечения».",
        reason_codes=["category_fit"],
        reason_signals=[],
        category_breakdown=[
            {"category_key": "entertainment", "label": "Развлечения", "score_percent": 93}
        ],
    )

    await FeedService._refresh_template_previews(service, items=[item])

    assert service.ml_facade.called == 1
    assert item.preview == "Вам легко находить общий ритм встреч и интересов."
    assert item.reason_codes == ["category_fit"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_template_previews_skips_non_template_text():
    service = FeedService.__new__(FeedService)
    service.ml_facade = _FakeMlFacade("Этот текст не должен вызываться.")

    item = SimpleNamespace(
        id=uuid4(),
        target_user_id=uuid4(),
        score=0.88,
        preview="Вам легко договориться о темпе общения и формате встреч.",
        reason_codes=["category_fit"],
        reason_signals=[],
        category_breakdown=[
            {"category_key": "grocery", "label": "Супермаркеты", "score_percent": 88}
        ],
    )

    await FeedService._refresh_template_previews(service, items=[item])

    assert service.ml_facade.called == 0
    assert item.preview == "Вам легко договориться о темпе общения и формате встреч."
