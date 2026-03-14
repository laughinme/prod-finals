from collections import Counter

from .enums import InsightStrength, OnboardingStepType
from .schemas import LifestyleTag, OnboardingStep, OnboardingStepOption


_QUIZ_STEPS = [
    OnboardingStep(
        step_key="weekend_vibe",
        title="How do you usually spend weekends?",
        description="These answers only improve ranking quality.",
        step_type=OnboardingStepType.MULTI_SELECT,
        options=[
            OnboardingStepOption(value="cozy_home", label="Cozy home evenings"),
            OnboardingStepOption(value="city_walks", label="City walks"),
            OnboardingStepOption(value="outdoors", label="Outdoors"),
            OnboardingStepOption(value="live_events", label="Concerts and events"),
        ],
    ),
    OnboardingStep(
        step_key="social_energy",
        title="What social pace feels right?",
        step_type=OnboardingStepType.SINGLE_SELECT,
        options=[
            OnboardingStepOption(value="quiet", label="Quiet and calm"),
            OnboardingStepOption(value="balanced", label="Balanced"),
            OnboardingStepOption(value="outgoing", label="Outgoing"),
        ],
    ),
    OnboardingStep(
        step_key="food_mood",
        title="What sounds most like you?",
        step_type=OnboardingStepType.MULTI_SELECT,
        options=[
            OnboardingStepOption(value="coffee_spots", label="Coffee spots"),
            OnboardingStepOption(value="new_restaurants", label="New restaurants"),
            OnboardingStepOption(value="home_cooking", label="Home cooking"),
        ],
    ),
    OnboardingStep(
        step_key="travel_style",
        title="What is your travel style?",
        step_type=OnboardingStepType.SINGLE_SELECT,
        options=[
            OnboardingStepOption(value="spontaneous", label="Spontaneous"),
            OnboardingStepOption(value="planned", label="Well planned"),
            OnboardingStepOption(value="stay_local", label="Local plans first"),
        ],
    ),
    OnboardingStep(
        step_key="pet_attitude",
        title="How do you feel about pets?",
        step_type=OnboardingStepType.SINGLE_SELECT,
        options=[
            OnboardingStepOption(value="love_pets", label="Love pets"),
            OnboardingStepOption(value="okay_with_pets", label="Okay with pets"),
            OnboardingStepOption(value="no_pets", label="Prefer no pets"),
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


def get_option_label(code: str) -> str:
    return _OPTION_LABELS.get(code, code.replace("_", " ").title())


def derive_lifestyle_tags(answer_map: dict[str, list[str]]) -> list[LifestyleTag]:
    counter = Counter(code for answers in answer_map.values() for code in answers)
    tags: list[LifestyleTag] = []
    for code, count in counter.most_common(5):
        strength = InsightStrength.HIGH if count > 1 else InsightStrength.MEDIUM
        tags.append(LifestyleTag(code=code, label=get_option_label(code), strength=strength))
    return tags
