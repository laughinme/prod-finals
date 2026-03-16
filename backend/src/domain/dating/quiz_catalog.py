from .enums import OnboardingStepType
from .category_catalog import load_category_definitions
from .schemas import OnboardingStep, OnboardingStepOption


HARD_FILTER_STEP_KEYS = {
    "goal_and_audience",
}

_QUIZ_STEPS = [
    OnboardingStep(
        step_key="goal_and_audience",
        title="Что вы ищете?",
        subtitle="Это поможет быстрее собрать первую релевантную подборку.",
        description="Цель знакомства и кого показывать можно настроить здесь, а потом изменить в профиле.",
        step_type=OnboardingStepType.MULTI_SELECT,
        optional=True,
        multi_select=True,
        required_for_feed=False,
        max_answers=5,
        options=[
            OnboardingStepOption(value="goal:serious_relationship", label="Серьезные отношения"),
            OnboardingStepOption(value="goal:casual_dates", label="Легкое общение"),
            OnboardingStepOption(value="goal:new_friends", label="Новые друзья"),
            OnboardingStepOption(value="audience:male", label="Мужчины"),
            OnboardingStepOption(value="audience:female", label="Женщины"),
            OnboardingStepOption(value="audience:anyone", label="Не важно"),
        ],
    ),
    OnboardingStep(
        step_key="interests_and_bank_signal",
        title="Ваши интересы",
        subtitle="Отметьте любые теги, которые правда вам откликаются.",
        description="Теги можно выбрать в любом порядке, они работают как мягкий сигнал для рекомендаций.",
        step_type=OnboardingStepType.MULTI_SELECT,
        optional=True,
        multi_select=True,
        required_for_feed=False,
        import_transactions_enabled=True,
        import_transactions_default=True,
        options=[
            OnboardingStepOption(value=item.key, label=item.label)
            for item in load_category_definitions()
        ],
    ),
]

_PROFILE_PREVIEW_STEP = OnboardingStep(
    step_key="profile_preview",
    title="Ваша карточка",
    subtitle="Так вас увидят другие пользователи в ленте.",
    description="На этом шаге нужно добавить фото или выбрать демо-фото, а потом открыть подборку.",
    step_type=OnboardingStepType.SINGLE_SELECT,
    optional=False,
    multi_select=False,
    required_for_feed=True,
    min_answers=1,
    max_answers=1,
    options=[OnboardingStepOption(value="confirmed", label="Готово")],
)

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
    if step_key == _PROFILE_PREVIEW_STEP.step_key:
        return _PROFILE_PREVIEW_STEP
    return None


def is_hard_filter_step(step_key: str) -> bool:
    return step_key in HARD_FILTER_STEP_KEYS


def hard_filter_steps() -> list[OnboardingStep]:
    return [step for step in _QUIZ_STEPS if step.step_key in HARD_FILTER_STEP_KEYS]
