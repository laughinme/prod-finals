from enum import Enum


class FunnelUserSource(str, Enum):
    DATASET = "dataset"
    COLD_START = "cold_start"


class FunnelDecisionMode(str, Enum):
    MODEL = "model"
    FALLBACK = "fallback"
    UNKNOWN = "unknown"
