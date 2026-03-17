from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DemoDatasetAccount:
    dataset_index: int
    demo_user_key: str
    email: str


DEMO_DATASET_ACCOUNTS: tuple[DemoDatasetAccount, ...] = (
    DemoDatasetAccount(
        dataset_index=1,
        demo_user_key="dataset_demo_1",
        email="demo.food.a@tmatch.local",
    ),
    DemoDatasetAccount(
        dataset_index=2,
        demo_user_key="dataset_demo_2",
        email="demo.food.b@tmatch.local",
    ),
    DemoDatasetAccount(
        dataset_index=3,
        demo_user_key="dataset_demo_3",
        email="demo.style@tmatch.local",
    ),
    DemoDatasetAccount(
        dataset_index=4,
        demo_user_key="dataset_demo_4",
        email="demo.cold@tmatch.local",
    ),
)

DEMO_FEED_PAIR_BY_EMAIL: dict[str, str] = {
    "demo.food.a@tmatch.local": "demo.food.b@tmatch.local",
    "demo.food.b@tmatch.local": "demo.food.a@tmatch.local",
}

DEMO_DATASET_EMAIL_TO_KEY: dict[str, str] = {
    account.email: account.demo_user_key for account in DEMO_DATASET_ACCOUNTS
}

DEMO_DATASET_INDEX_TO_KEY: dict[int, str] = {
    account.dataset_index: account.demo_user_key for account in DEMO_DATASET_ACCOUNTS
}
