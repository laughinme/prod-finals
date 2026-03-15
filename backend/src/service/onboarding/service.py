from collections.abc import Iterable

from core.errors import BadRequestError
from database.relational_db import User
from domain.dating import (
    AuditEntityType,
    OnboardingAnswersRequest,
    OnboardingAnswersResponse,
    OnboardingConfigResponse,
    OnboardingProgress,
    OnboardingStateResponse,
)
from domain.dating.category_catalog import pick_category_keys
from domain.dating.quiz_catalog import get_quiz_steps, get_step

from service.matchmaking import BaseDatingService


IMPORT_TRANSACTIONS_STEP_KEY = "import_transactions"


class OnboardingService(BaseDatingService):
    async def get_config(self, user: User) -> OnboardingConfigResponse:
        import_transactions = await self._get_import_transactions_value(user.id)
        steps = [
            step.model_copy(
                update={"import_transactions_value": import_transactions}
            )
            if step.import_transactions_enabled
            else step
            for step in get_quiz_steps()
        ]
        return OnboardingConfigResponse(steps=steps)

    async def get_state(self, user: User) -> OnboardingStateResponse:
        records = await self.matchmaking_repo.list_quiz_answers(user_id=user.id)
        return OnboardingStateResponse(**self._build_progress(user, records).model_dump())

    async def save_answers(self, user: User, payload: OnboardingAnswersRequest) -> OnboardingAnswersResponse:
        step = get_step(payload.step_key)
        if step is None:
            raise BadRequestError("Unknown quiz step")

        normalized_answers = self._validate_answers(step, payload.answers)
        import_transactions = await self._resolve_import_transactions_value(
            user=user,
            step_key=payload.step_key,
            import_transactions=payload.import_transactions,
        )

        await self.matchmaking_repo.upsert_quiz_answer(
            user_id=user.id,
            step_key=payload.step_key,
            answers=normalized_answers,
        )
        if import_transactions is not None:
            await self.matchmaking_repo.upsert_quiz_answer(
                user_id=user.id,
                step_key=IMPORT_TRANSACTIONS_STEP_KEY,
                answers=[str(import_transactions).lower()],
            )

        self._apply_quiz_answer_to_user(user, payload.step_key, normalized_answers)
        user.quiz_started = True
        user.onboarding_skipped = False
        progress_records = await self.matchmaking_repo.list_quiz_answers(user_id=user.id)
        progress = self._build_progress(user, progress_records)
        user.quiz_current_step_key = progress.current_step_key
        user.is_onboarded = user.can_open_feed
        await self.matchmaking_repo.reset_batch_for_date(user_id=user.id, batch_date=self.local_today())
        await self.add_audit_event(
            event_type="onboarding_answer_saved",
            entity_type=AuditEntityType.QUIZ,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={
                "step_key": payload.step_key,
                "answers": normalized_answers,
                "import_transactions": import_transactions,
            },
        )
        await self.uow.commit()
        await self.uow.session.refresh(user)

        if payload.step_key == "interests" and normalized_answers:
            await self._sync_onboarding_with_ml(
                user=user,
                favorite_categories=normalized_answers,
                import_transactions=import_transactions if import_transactions is not None else True,
            )

        return OnboardingAnswersResponse(
            step_key=payload.step_key,
            **progress.model_dump(),
        )

    async def skip(self, user: User) -> OnboardingStateResponse:
        user.quiz_started = True
        user.onboarding_skipped = True
        user.quiz_current_step_key = None
        await self.matchmaking_repo.reset_batch_for_date(user_id=user.id, batch_date=self.local_today())
        await self.add_audit_event(
            event_type="onboarding_skipped",
            entity_type=AuditEntityType.QUIZ,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={"skipped": True},
        )
        await self.uow.commit()
        await self.uow.session.refresh(user)
        records = await self.matchmaking_repo.list_quiz_answers(user_id=user.id)
        return OnboardingStateResponse(**self._build_progress(user, records).model_dump())

    def _validate_answers(self, step, answers: list[str]) -> list[str]:
        if step.step_key == "match_preferences":
            return self._validate_match_preferences(step, answers)

        normalized = [answer.strip() for answer in answers if answer and answer.strip()]
        if not normalized and step.optional:
            return []

        if step.step_type.value == "range":
            if len(normalized) != 2:
                raise BadRequestError("Range step requires exactly two values")
            try:
                lower = int(normalized[0])
                upper = int(normalized[1])
            except ValueError as exc:
                raise BadRequestError("Range values must be integers") from exc
            if step.range_min is not None and lower < step.range_min:
                raise BadRequestError("Range lower bound is too small")
            if step.range_max is not None and upper > step.range_max:
                raise BadRequestError("Range upper bound is too large")
            if lower > upper:
                raise BadRequestError("Range lower bound must be less than or equal to upper bound")
            return [str(lower), str(upper)]

        normalized = list(dict.fromkeys(normalized))
        if step.min_answers is not None and len(normalized) < step.min_answers:
            raise BadRequestError("Not enough answers provided for the step")
        if step.max_answers is not None and len(normalized) > step.max_answers:
            raise BadRequestError("Too many answers provided for the step")

        allowed_values = {option.value for option in step.options}
        if any(answer not in allowed_values for answer in normalized):
            raise BadRequestError("Unknown answer passed for quiz step")
        return normalized

    def _validate_match_preferences(self, step, answers: list[str]) -> list[str]:
        normalized = [answer.strip() for answer in answers if answer and answer.strip()]
        if not normalized:
            return []

        genders: list[str] = []
        age_min: int | None = None
        age_max: int | None = None
        allowed_genders = {option.value for option in step.options}

        for answer in normalized:
            if answer.startswith("gender:"):
                gender = answer.split(":", 1)[1]
                if gender not in allowed_genders:
                    raise BadRequestError("Unknown gender passed for match preferences")
                genders.append(gender)
                continue
            if answer.startswith("age_min:"):
                try:
                    age_min = int(answer.split(":", 1)[1])
                except ValueError as exc:
                    raise BadRequestError("Age minimum must be an integer") from exc
                continue
            if answer.startswith("age_max:"):
                try:
                    age_max = int(answer.split(":", 1)[1])
                except ValueError as exc:
                    raise BadRequestError("Age maximum must be an integer") from exc
                continue
            raise BadRequestError("Unknown value passed for match preferences")

        genders = list(dict.fromkeys(genders))
        if len(genders) > (step.max_answers or len(step.options)):
            raise BadRequestError("Too many genders selected")

        if age_min is None or age_max is None:
            raise BadRequestError("Age range is required for match preferences")
        if step.range_min is not None and age_min < step.range_min:
            raise BadRequestError("Range lower bound is too small")
        if step.range_max is not None and age_max > step.range_max:
            raise BadRequestError("Range upper bound is too large")
        if age_min > age_max:
            raise BadRequestError("Range lower bound must be less than or equal to upper bound")

        return [
            *[f"gender:{gender}" for gender in genders],
            f"age_min:{age_min}",
            f"age_max:{age_max}",
        ]

    def _apply_quiz_answer_to_user(self, user: User, step_key: str, answers: list[str]) -> None:
        if not answers:
            return

        if step_key == "match_preferences":
            genders = [
                answer.split(":", 1)[1]
                for answer in answers
                if answer.startswith("gender:")
            ]
            age_min = next(
                int(answer.split(":", 1)[1])
                for answer in answers
                if answer.startswith("age_min:")
            )
            age_max = next(
                int(answer.split(":", 1)[1])
                for answer in answers
                if answer.startswith("age_max:")
            )
            user.looking_for_genders = genders
            user.age_range_min = age_min
            user.age_range_max = age_max
            return
        if step_key == "interests":
            user.interests = list(answers)
            return

    def _build_progress(self, user: User, records: Iterable) -> OnboardingProgress:
        steps = get_quiz_steps()
        step_keys = [step.step_key for step in steps]
        answers_by_step = self._build_answers_by_step(user, records, step_keys)
        completed_step_keys = [step_key for step_key in step_keys if step_key in answers_by_step]
        completed = len(completed_step_keys) == len(step_keys)
        should_show = not user.onboarding_skipped and not completed

        current_step_key: str | None = None
        if should_show:
            if user.quiz_current_step_key in step_keys and user.quiz_current_step_key not in completed_step_keys:
                current_step_key = user.quiz_current_step_key
            else:
                current_step_key = next(
                    (step_key for step_key in step_keys if step_key not in completed_step_keys),
                    step_keys[0] if step_keys else None,
                )

        return OnboardingProgress(
            quiz_started=bool(user.quiz_started),
            skipped=bool(user.onboarding_skipped),
            completed=completed,
            should_show=should_show,
            current_step_key=current_step_key,
            completed_step_keys=completed_step_keys,
            answers_by_step=answers_by_step,
        )

    def _build_answers_by_step(self, user: User, records: Iterable, step_keys: list[str]) -> dict[str, list[str]]:
        answers_by_step = {
            record.step_key: list(record.answers or [])
            for record in records
            if record.step_key in step_keys
        }

        if "match_preferences" not in answers_by_step:
            inferred_match_preferences: list[str] = []
            inferred_match_preferences.extend(
                f"gender:{gender}"
                for gender in list(user.looking_for_genders or [])
                if gender
            )
            if user.age_range_min is not None:
                inferred_match_preferences.append(f"age_min:{user.age_range_min}")
            if user.age_range_max is not None:
                inferred_match_preferences.append(f"age_max:{user.age_range_max}")
            if inferred_match_preferences:
                answers_by_step["match_preferences"] = inferred_match_preferences

        if "interests" not in answers_by_step and user.interests:
            answers_by_step["interests"] = list(user.interests)

        return answers_by_step

    async def _resolve_import_transactions_value(
        self,
        *,
        user: User,
        step_key: str,
        import_transactions: bool | None,
    ) -> bool | None:
        step = get_step(step_key)
        if step is None or not step.import_transactions_enabled:
            return None
        if import_transactions is not None:
            return import_transactions
        return await self._get_import_transactions_value(user.id)

    async def _get_import_transactions_value(self, user_id) -> bool:
        saved_answer = await self.matchmaking_repo.get_quiz_answer(
            user_id=user_id,
            step_key=IMPORT_TRANSACTIONS_STEP_KEY,
        )
        if saved_answer is None or not saved_answer.answers:
            return True
        return saved_answer.answers[0].strip().lower() != "false"

    async def _sync_onboarding_with_ml(
        self,
        *,
        user: User,
        favorite_categories: list[str],
        import_transactions: bool,
    ) -> None:
        categories = list(dict.fromkeys(favorite_categories or list(user.interests or [])))
        if not categories:
            categories = pick_category_keys(f"onboarding:{user.id}")[:3]
        await self.ml_facade.sync_onboarding_profile(
            user_id=user.id,
            ml_user_id=user.service_user_id,
            favorite_categories=categories[:15],
            import_transactions=import_transactions,
        )
