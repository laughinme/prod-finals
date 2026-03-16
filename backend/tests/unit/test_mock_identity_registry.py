import pytest

from service.mock_identity.registry import MockIdentityRegistry


MALE_FIRST_NAMES = {
    "Алексей",
    "Илья",
    "Иван",
    "Михаил",
    "Никита",
    "Роман",
    "Дмитрий",
    "Максим",
    "Кирилл",
    "Артем",
    "Андрей",
    "Егор",
    "Павел",
    "Степан",
    "Владимир",
    "Тимофей",
    "Матвей",
    "Сергей",
    "Глеб",
    "Федор",
}

FEMALE_FIRST_NAMES = {
    "Анна",
    "Мария",
    "Екатерина",
    "Ольга",
    "Алина",
    "София",
    "Дарья",
    "Елена",
    "Виктория",
    "Полина",
    "Анастасия",
    "Вероника",
    "Ксения",
    "Юлия",
    "Надежда",
    "Валерия",
    "Татьяна",
    "Лилия",
    "Ульяна",
    "Арина",
}

MALE_LAST_NAMES = {
    "Иванов",
    "Петров",
    "Смирнов",
    "Кузнецов",
    "Соколов",
    "Попов",
    "Лебедев",
    "Козлов",
    "Новиков",
    "Морозов",
    "Волков",
    "Соловьев",
    "Зайцев",
    "Павлов",
    "Семенов",
    "Голубев",
    "Виноградов",
    "Богданов",
    "Воробьев",
    "Федоров",
}

FEMALE_LAST_NAMES = {
    "Иванова",
    "Петрова",
    "Смирнова",
    "Кузнецова",
    "Соколова",
    "Попова",
    "Лебедева",
    "Козлова",
    "Новикова",
    "Морозова",
    "Волкова",
    "Соловьева",
    "Зайцева",
    "Павлова",
    "Семенова",
    "Голубева",
    "Виноградова",
    "Богданова",
    "Воробьева",
    "Федорова",
}


def _assert_profile_matches_gender(profile) -> None:
    if profile.gender == "male":
        assert profile.first_name in MALE_FIRST_NAMES
        assert profile.last_name in MALE_LAST_NAMES
        return

    assert profile.gender == "female"
    assert profile.first_name in FEMALE_FIRST_NAMES
    assert profile.last_name in FEMALE_LAST_NAMES


@pytest.mark.unit
def test_dataset_profiles_use_gender_consistent_names():
    registry = MockIdentityRegistry.from_default_source()

    profiles = registry.dataset_profiles()

    assert profiles
    for profile in profiles:
        _assert_profile_matches_gender(profile)


@pytest.mark.unit
def test_registration_profiles_use_gender_consistent_names():
    registry = MockIdentityRegistry.from_default_source()

    profiles = [
        registry.registration_profile(email="alpha@example.com"),
        registry.registration_profile(email="beta@example.com"),
        registry.registration_profile(email="gamma@example.com"),
        registry.registration_profile(email="delta@example.com"),
        registry.registration_profile(email="omega@example.com"),
    ]

    for profile in profiles:
        _assert_profile_matches_gender(profile)
