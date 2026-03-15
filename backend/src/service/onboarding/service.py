from core.errors import BadRequestError
from database.relational_db import User
from domain.dating import AuditEntityType, OnboardingAnswersRequest, OnboardingAnswersResponse, OnboardingConfigResponse
from domain.dating.quiz_catalog import get_quiz_steps, get_step

from service.matchmaking import BaseDatingService


class OnboardingService(BaseDatingService):
    def get_config(self) -> OnboardingConfigResponse:
        return OnboardingConfigResponse(steps=get_quiz_steps())

    async def save_answers(self, user: User, payload: OnboardingAnswersRequest) -> OnboardingAnswersResponse:
        step = get_step(payload.step_key)
        if step is None:
            raise BadRequestError("Unknown quiz step")

        normalized_answers = self._validate_answers(step, payload.answers)
        self._apply_quiz_answer_to_user(user, payload.step_key, normalized_answers)
        user.quiz_started = True
        user.is_onboarded = user.can_open_feed
        await self.matchmaking_repo.reset_batch_for_date(user_id=user.id, batch_date=self.local_today())
        await self.add_audit_event(
            event_type="onboarding_answer_saved",
            entity_type=AuditEntityType.QUIZ,
            entity_id=str(user.id),
            actor_user_id=user.id,
            payload={"step_key": payload.step_key, "answers": normalized_answers},
        )
        await self.uow.commit()
        await self.uow.session.refresh(user)

        return OnboardingAnswersResponse(
            step_key=payload.step_key,
            quiz_started=user.quiz_started,
        )

    def _validate_answers(self, step, answers: list[str]) -> list[str]:
        if step.step_key == "match_preferences":
            return self._validate_match_preferences(step, answers)

        normalized = [answer.strip() for answer in answers if answer and answer.strip()]

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
