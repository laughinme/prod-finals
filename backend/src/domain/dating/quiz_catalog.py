from .enums import OnboardingStepType
from .interests import INTEREST_OPTIONS
from .schemas import OnboardingStep, OnboardingStepOption


HARD_FILTER_STEP_KEYS = {
    "match_preferences",
}

_QUIZ_STEPS = [
    OnboardingStep(
        step_key="match_preferences",
        title="Кого вы хотите видеть?",
        subtitle="Пол и возраст можно задать сразу на одном шаге.",
        description="Выберите пол и возрастной диапазон для первой выдачи.",
        step_type=OnboardingStepType.MULTI_SELECT,
        optional=True,
        multi_select=True,
        required_for_feed=False,
        max_answers=3,
        range_min=18,
        range_max=99,
        range_min_label="18",
        range_max_label="99",
        options=[
            OnboardingStepOption(value="male", label="Мужчины"),
            OnboardingStepOption(value="female", label="Женщины"),
            OnboardingStepOption(value="other", label="Небинарные"),
        ],
    ),
    OnboardingStep(
        step_key="interests",
        title="Ваши интересы",
        subtitle="Выберите от 3 до 5 тегов. Это поможет нам точнее находить совпадения.",
        description="Теги можно выбрать в любом порядке, они работают как мягкий сигнал для рекомендаций.",
        step_type=OnboardingStepType.MULTI_SELECT,
        optional=True,
        multi_select=True,
        required_for_feed=False,
        min_answers=3,
        max_answers=5,
        options=[
            OnboardingStepOption(value=value, label=label)
            for value, label in INTEREST_OPTIONS
        ],
    ),
]

_OPTION_LABELS = {
    option.value: option.label
    for step in _QUIZ_STEPS
    for option in step.options
}


def get_quiz_steps() -> list[OnboardingStep]:
    return list(_QUIZ_STEPS)


def get_step(step_key: str) -> OnboardingStep | None:
    for step in _QUIZ_STEPS:
        if step.step_key == step_key:
            return step
    return None


def is_hard_filter_step(step_key: str) -> bool:
    return step_key in HARD_FILTER_STEP_KEYS


def hard_filter_steps() -> list[OnboardingStep]:
    return [step for step in _QUIZ_STEPS if step.step_key in HARD_FILTER_STEP_KEYS]
