from .enums import Goal, OnboardingStepType
from .schemas import OnboardingStep, OnboardingStepOption


HARD_FILTER_STEP_KEYS = {
    "who_to_meet",
    "preferred_age_range",
    "connection_goal",
    "search_radius",
}

_QUIZ_STEPS = [
    OnboardingStep(
        step_key="who_to_meet",
        title="Who would you like to see first?",
        subtitle="This affects which profiles are eligible for your feed.",
        description="Choose one or more genders you want in your recommendations.",
        step_type=OnboardingStepType.MULTI_SELECT,
        optional=True,
        multi_select=True,
        required_for_feed=False,
        min_answers=1,
        max_answers=3,
        options=[
            OnboardingStepOption(value="male", label="Men"),
            OnboardingStepOption(value="female", label="Women"),
            OnboardingStepOption(value="other", label="Other"),
        ],
    ),
    OnboardingStep(
        step_key="preferred_age_range",
        title="What age range feels right?",
        subtitle="We use this as a hard filter for your feed.",
        description="Set the age range you want to see first.",
        step_type=OnboardingStepType.RANGE,
        optional=True,
        required_for_feed=False,
        range_min=18,
        range_max=99,
        range_min_label="18",
        range_max_label="99",
    ),
    OnboardingStep(
        step_key="connection_goal",
        title="What kind of connection are you looking for?",
        subtitle="This helps us filter and rank the feed.",
        description="Choose the closest intention right now.",
        step_type=OnboardingStepType.SINGLE_SELECT,
        optional=True,
        required_for_feed=False,
        max_answers=1,
        options=[
            OnboardingStepOption(value=Goal.SERIOUS_RELATIONSHIP.value, label="Serious relationship"),
            OnboardingStepOption(value=Goal.CASUAL_DATES.value, label="Casual dates"),
            OnboardingStepOption(value=Goal.NEW_FRIENDS.value, label="New friends"),
        ],
    ),
    OnboardingStep(
        step_key="search_radius",
        title="How far are you open to meeting?",
        subtitle="We keep this practical for the first version.",
        description="This is used as a location filter. In MVP it works on city-level availability.",
        step_type=OnboardingStepType.SINGLE_SELECT,
        optional=True,
        required_for_feed=False,
        max_answers=1,
        options=[
            OnboardingStepOption(value="10", label="Up to 10 km"),
            OnboardingStepOption(value="30", label="Up to 30 km"),
            OnboardingStepOption(value="60", label="Up to 60 km"),
            OnboardingStepOption(value="100", label="Up to 100 km"),
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
