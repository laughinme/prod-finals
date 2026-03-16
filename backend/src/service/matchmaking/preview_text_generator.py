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
        model: str = "Qwen/Qwen2.5-0.5B-Instruct",
        timeout_sec: float = 4.0,
    ) -> None:
        self._enabled = bool(enabled)
        self._provider = provider.strip().lower()
        self._api_key = api_key.strip()
        self._model = model.strip() or "Qwen/Qwen2.5-0.5B-Instruct"
        self._timeout_sec = max(float(timeout_sec), 1.0)
        self._fallback_models = [
            "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
            "HuggingFaceTB/SmolLM2-1.7B-Instruct",
            "google/flan-t5-small",
        ]
        self._unavailable_models: set[str] = set()
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
            f"Тема совпадения: {category_label}. "
            f"Сила совпадения: {strength_ru}. "
            "Язык: русский. Ограничение: 8-14 слов. "
            "Без кавычек, без списков, без префиксов."
        )
        models_to_try = self._ordered_models()
        for model_name in models_to_try:
            generated, status_code = await self._call_huggingface_model(model_name=model_name, prompt=prompt)
            if generated:
                if model_name != self._model:
                    logger.info("HF preview generation switched model from %s to %s", self._model, model_name)
                self._model = model_name
                return generated
            if status_code in {404, 410}:
                self._unavailable_models.add(model_name)
        return None

    def _ordered_models(self) -> list[str]:
        ordered = [self._model]
        ordered.extend(model for model in self._fallback_models if model not in ordered)
        available = [model for model in ordered if model not in self._unavailable_models]
        return available or ordered

    async def _call_huggingface_model(self, *, model_name: str, prompt: str) -> tuple[str | None, int | None]:
        endpoint = f"https://api-inference.huggingface.co/models/{model_name}"
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
        except Exception as exc:  # pragma: no cover - network/runtime safety
            logger.warning("HF preview generation failed for model %s: %s", model_name, exc)
            return None, None

        if response.status_code >= 400:
            if response.status_code in {404, 410}:
                logger.info(
                    "HF model %s is unavailable (status %s), trying fallback",
                    model_name,
                    response.status_code,
                )
            else:
                body_preview = response.text.strip().replace("\n", " ")[:160]
                logger.warning(
                    "HF preview generation failed with status %s for model %s: %s",
                    response.status_code,
                    model_name,
                    body_preview,
                )
            return None, response.status_code

        raw = response.json()
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    text = item.get("generated_text")
                    if isinstance(text, str) and text.strip():
                        return text, None
            return None, response.status_code

        if isinstance(raw, dict):
            text = raw.get("generated_text")
            if isinstance(text, str) and text.strip():
                return text, None

        return None, response.status_code

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
