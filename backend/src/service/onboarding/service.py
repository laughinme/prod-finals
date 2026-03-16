from collections.abc import Iterable

from core.errors import BadRequestError
from database.relational_db import User
from domain.dating import (
    AuditEntityType,
    FeedCandidateContext,
    OnboardingAnswersRequest,
    OnboardingAnswersResponse,
    OnboardingConfigResponse,
    OnboardingEstimateRequest,
    OnboardingEstimateResponse,
    OnboardingProgress,
    OnboardingStateResponse,
)
from domain.dating.category_catalog import pick_category_keys
from domain.dating.quiz_catalog import get_quiz_steps, get_step

from service.matchmaking import BaseDatingService


IMPORT_TRANSACTIONS_STEP_KEY = "import_transactions"
PROFILE_PREVIEW_STEP_KEY = "profile_preview"
PUBLIC_MATCH_GENDERS = {"male", "female"}


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

    async def estimate(self, user: User, payload: OnboardingEstimateRequest) -> OnboardingEstimateResponse:
        answers_by_step = {key: list(value or []) for key, value in (payload.answers_by_step or {}).items()}
        requester = await self._build_estimate_context(user=user, answers_by_step=answers_by_step)
        excluded_ids = await self.matchmaking_repo.list_excluded_target_ids_for_user(user.id)
        total = 0
        for candidate in await self.matchmaking_repo.list_feed_candidates(requester_id=user.id):
            if candidate.id in excluded_ids or not candidate.can_be_shown_in_feed:
                continue
            candidate_context = await self._build_feed_context(candidate)
            if self._candidate_passes_filters(
                requester_context=requester,
                candidate_context=candidate_context,
            ):
                total += 1
        return OnboardingEstimateResponse(estimated_count=total)

    async def save_answers(self, user: User, payload: OnboardingAnswersRequest) -> OnboardingAnswersResponse:
        step = get_step(payload.step_key)
        if step is None:
            raise BadRequestError("Unknown quiz step")

        if payload.step_key == PROFILE_PREVIEW_STEP_KEY and not user.has_approved_photo:
            raise BadRequestError("Add a photo before completing onboarding")

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

        if payload.step_key == "interests_and_bank_signal" and normalized_answers:
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
        user.is_onboarded = user.can_open_feed
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
        if step.step_key == PROFILE_PREVIEW_STEP_KEY:
            return self._validate_profile_preview(step, answers)
        if step.step_key == "goal_and_audience":
            return self._validate_goal_and_audience(step, answers)

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

    def _validate_profile_preview(self, step, answers: list[str]) -> list[str]:
        normalized = [answer.strip() for answer in answers if answer and answer.strip()]
        if normalized != ["confirmed"]:
            raise BadRequestError("Profile preview requires explicit confirmation")
        return normalized

    def _validate_goal_and_audience(self, step, answers: list[str]) -> list[str]:
        normalized = [answer.strip() for answer in answers if answer and answer.strip()]
        if not normalized:
            return []

        allowed_values = {option.value for option in step.options}
        if any(answer not in allowed_values for answer in normalized):
            raise BadRequestError("Unknown value passed for goal and audience step")

        goals = [answer for answer in normalized if answer.startswith("goal:")]
        audiences = [answer for answer in normalized if answer.startswith("audience:")]
        goals = list(dict.fromkeys(goals))
        audiences = list(dict.fromkeys(audiences))

        if len(goals) > 1:
            raise BadRequestError("Only one goal can be selected")
        if "audience:anyone" in audiences and len(audiences) > 1:
            raise BadRequestError("Audience 'anyone' cannot be combined with explicit genders")

        return [*goals, *audiences]

    def _apply_quiz_answer_to_user(self, user: User, step_key: str, answers: list[str]) -> None:
        if step_key == "goal_and_audience":
            if not answers:
                user.goal = None
                user.looking_for_genders = []
                return
            goals = [
                answer.split(":", 1)[1]
                for answer in answers
                if answer.startswith("goal:")
            ]
            audiences = [
                answer.split(":", 1)[1]
                for answer in answers
                if answer.startswith("audience:")
            ]
            user.goal = goals[0] if goals else None
            user.looking_for_genders = [] if "anyone" in audiences else [
                gender for gender in audiences if gender in PUBLIC_MATCH_GENDERS
            ]
            return
        if step_key == "interests_and_bank_signal":
            user.interests = list(answers or [])
            return

    def _build_progress(self, user: User, records: Iterable) -> OnboardingProgress:
        steps = get_quiz_steps()
        step_keys = [step.step_key for step in steps]
        workflow_step_keys = [*step_keys, PROFILE_PREVIEW_STEP_KEY]
        pre_preview_step_keys = list(step_keys)
        record_step_keys = {
            record.step_key
            for record in records
            if record.step_key in workflow_step_keys
        }
        answers_by_step = self._build_answers_by_step(user, records, workflow_step_keys)
        completed_step_keys = [
            step_key
            for step_key in workflow_step_keys
            if step_key in record_step_keys
        ]
        required_profile_step_key = user.required_profile_step_key
        if (
            required_profile_step_key == PROFILE_PREVIEW_STEP_KEY
            and any(step_key not in completed_step_keys for step_key in pre_preview_step_keys)
        ):
            required_profile_step_key = None
        missing_required_fields = list(user.missing_required_fields)
        completed = len(completed_step_keys) == len(workflow_step_keys) and required_profile_step_key is None
        should_show = required_profile_step_key is not None or (not user.onboarding_skipped and not completed)

        current_step_key: str | None = None
        if required_profile_step_key is not None:
            current_step_key = required_profile_step_key
        elif should_show:
            if (
                user.quiz_current_step_key in workflow_step_keys
                and user.quiz_current_step_key not in completed_step_keys
            ):
                current_step_key = user.quiz_current_step_key
            else:
                current_step_key = next(
                    (step_key for step_key in workflow_step_keys if step_key not in completed_step_keys),
                    workflow_step_keys[0] if workflow_step_keys else None,
                )

        return OnboardingProgress(
            quiz_started=bool(user.quiz_started),
            skipped=bool(user.onboarding_skipped),
            completed=completed,
            should_show=should_show,
            current_step_key=current_step_key,
            required_profile_step_key=required_profile_step_key,
            missing_required_fields=missing_required_fields,
            completed_step_keys=completed_step_keys,
            answers_by_step=answers_by_step,
        )

    def _build_answers_by_step(self, user: User, records: Iterable, step_keys: list[str]) -> dict[str, list[str]]:
        answers_by_step = {
            record.step_key: list(record.answers or [])
            for record in records
            if record.step_key in step_keys
        }

        inferred_goal_and_audience: list[str] = []
        if user.goal:
            inferred_goal_and_audience.append(f"goal:{user.goal}")
        inferred_goal_and_audience.extend(
            f"audience:{gender}"
            for gender in list(user.looking_for_genders or [])
            if gender in PUBLIC_MATCH_GENDERS
        )
        if not user.looking_for_genders:
            inferred_goal_and_audience = [
                answer for answer in inferred_goal_and_audience
                if not answer.startswith("audience:")
            ]
            inferred_goal_and_audience.append("audience:anyone")
        if inferred_goal_and_audience or "goal_and_audience" in answers_by_step:
            answers_by_step["goal_and_audience"] = inferred_goal_and_audience

        if user.interests or "interests_and_bank_signal" in answers_by_step:
            answers_by_step["interests_and_bank_signal"] = list(user.interests or [])

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

    async def _build_estimate_context(
        self,
        *,
        user: User,
        answers_by_step: dict[str, list[str]],
    ) -> FeedCandidateContext:
        context = await self._build_feed_context(user)
        step_answers = list(answers_by_step.get("goal_and_audience", []))
        if step_answers:
            goals = [
                answer.split(":", 1)[1]
                for answer in step_answers
                if answer.startswith("goal:")
            ]
            audiences = [
                answer.split(":", 1)[1]
                for answer in step_answers
                if answer.startswith("audience:")
            ]
            context.search_preferences["goal"] = goals[0] if goals else None
            context.search_preferences["looking_for_genders"] = [] if "anyone" in audiences else [
                gender for gender in audiences if gender in PUBLIC_MATCH_GENDERS
            ]

        interests = answers_by_step.get("interests_and_bank_signal")
        if interests is not None:
            context.interests = list(interests or [])
        return context

    def _candidate_passes_filters(
        self,
        *,
        requester_context: FeedCandidateContext,
        candidate_context: FeedCandidateContext,
    ) -> bool:
        requester_prefs = requester_context.search_preferences
        candidate_prefs = candidate_context.search_preferences

        if (
            requester_prefs.get("looking_for_genders")
            and candidate_context.gender is not None
            and candidate_context.gender not in requester_prefs["looking_for_genders"]
        ):
            return False
        if (
            candidate_prefs.get("looking_for_genders")
            and requester_context.gender is not None
            and requester_context.gender not in candidate_prefs["looking_for_genders"]
        ):
            return False
        return True
