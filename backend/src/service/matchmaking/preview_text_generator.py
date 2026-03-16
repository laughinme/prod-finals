from __future__ import annotations

import asyncio
import logging
import re
from typing import Literal

import httpx


logger = logging.getLogger(__name__)

ScoreBand = Literal["high", "medium", "low"]


class LlmCategoryPreviewGenerator:
    """Generates short category-based preview texts with an optional external LLM."""

    def __init__(
        self,
        *,
        enabled: bool = False,
        provider: str = "huggingface",
        api_key: str = "",
        model: str = "google/flan-t5-small",
        timeout_sec: float = 4.0,
    ) -> None:
        self._enabled = bool(enabled)
        self._provider = provider.strip().lower()
        self._api_key = api_key.strip()
        self._model = model.strip() or "google/flan-t5-small"
        self._timeout_sec = max(float(timeout_sec), 1.0)
        self._cache: dict[tuple[str, ScoreBand], str] = {}
        self._lock = asyncio.Lock()

    async def render_category_preview(
        self,
        *,
        category_label: str,
        score_percent: int | None,
        fallback_text: str,
    ) -> str:
        fallback = fallback_text.strip() or "Ваши интересы хорошо совпадают."
        label = category_label.strip()
        if not label:
            return fallback

        if not self._enabled or not self._api_key or self._provider != "huggingface":
            return fallback

        score_band = self._score_band(score_percent)
        cache_key = (label.lower(), score_band)

        cached = self._cache.get(cache_key)
        if cached:
            return cached

        async with self._lock:
            cached = self._cache.get(cache_key)
            if cached:
                return cached

            generated = await self._generate_huggingface_text(
                category_label=label,
                score_band=score_band,
            )
            text = self._sanitize_generated_text(generated) or fallback
            self._cache[cache_key] = text
            return text

    def _score_band(self, score_percent: int | None) -> ScoreBand:
        if score_percent is None:
            return "medium"
        if score_percent >= 75:
            return "high"
        if score_percent >= 45:
            return "medium"
        return "low"

    async def _generate_huggingface_text(
        self,
        *,
        category_label: str,
        score_band: ScoreBand,
    ) -> str | None:
        strength_ru = {
            "high": "высокая",
            "medium": "средняя",
            "low": "базовая",
        }[score_band]
        prompt = (
            "Сгенерируй одну короткую фразу для дейтинг-рекомендации. "
            f"Категория интересов: {category_label}. "
            f"Сила совпадения: {strength_ru}. "
            "Язык: русский. Ограничение: 8-14 слов. "
            "Без кавычек, без списков, без префиксов."
        )

        endpoint = f"https://api-inference.huggingface.co/models/{self._model}"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 48,
                "temperature": 0.8,
                "do_sample": True,
                "return_full_text": False,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.warning(
                    "HF preview generation failed with status %s for model %s",
                    response.status_code,
                    self._model,
                )
                return None
            raw = response.json()
        except Exception as exc:  # pragma: no cover - network/runtime safety
            logger.warning("HF preview generation failed: %s", exc)
            return None

        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    text = item.get("generated_text")
                    if isinstance(text, str) and text.strip():
                        return text
            return None

        if isinstance(raw, dict):
            text = raw.get("generated_text")
            if isinstance(text, str) and text.strip():
                return text

        return None

    def _sanitize_generated_text(self, text: str | None) -> str | None:
        if not text:
            return None

        normalized = re.sub(r"\s+", " ", text).strip().strip("\"'`")
        normalized = re.sub(r"^(?:ответ|response)\s*[:\-]\s*", "", normalized, flags=re.IGNORECASE)
        normalized = normalized.strip()

        if not normalized:
            return None
        if len(normalized) > 160:
            normalized = normalized[:157].rstrip(" ,;:.") + "..."
        if normalized[-1] not in ".!?":
            normalized += "."
        return normalized
