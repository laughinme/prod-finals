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

    def _apply_quiz_answer_to_user(self, user: User, step_key: str, answers: list[str]) -> None:
        if step_key == "who_to_meet":
            user.looking_for_genders = list(answers)
            return
        if step_key == "preferred_age_range":
            user.age_range_min = int(answers[0])
            user.age_range_max = int(answers[1])
            return
        if step_key == "connection_goal":
            user.goal = answers[0]
            return
        if step_key == "search_radius":
            user.distance_km = int(answers[0])
            return
