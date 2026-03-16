from datetime import date, datetime

from pydantic import BaseModel, Field

from domain.statistics.enums import FunnelDecisionMode, FunnelUserSource


class FunnelCounts(BaseModel):
    feed_served: int = Field(default=0, ge=0)
    feed_explanation_opened: int = Field(default=0, ge=0)
    feed_like: int = Field(default=0, ge=0)
    feed_pass: int = Field(default=0, ge=0)
    feed_hide: int = Field(default=0, ge=0)
    match_created: int = Field(default=0, ge=0)
    chat_first_message_sent: int = Field(default=0, ge=0)
    chat_first_reply_received: int = Field(default=0, ge=0)
    match_closed: int = Field(default=0, ge=0)
    user_blocked: int = Field(default=0, ge=0)
    user_reported: int = Field(default=0, ge=0)


class FunnelConversionRates(BaseModel):
    like_rate: float = Field(default=0, ge=0)
    match_rate_from_likes: float = Field(default=0, ge=0)
    first_message_rate_from_matches: float = Field(default=0, ge=0)
    first_reply_rate_from_first_messages: float = Field(default=0, ge=0)
    negative_outcome_rate_from_matches: float = Field(default=0, ge=0)


class FunnelSegmentSummary(BaseModel):
    user_source: FunnelUserSource | None = None
    decision_mode: FunnelDecisionMode | None = None
    counts: FunnelCounts
    conversions: FunnelConversionRates


class FunnelSummary(BaseModel):
    generated_at: datetime
    totals: FunnelCounts
    conversions: FunnelConversionRates
    by_user_source: list[FunnelSegmentSummary]
    by_decision_mode: list[FunnelSegmentSummary]
    by_segment: list[FunnelSegmentSummary]


class FunnelDailyRow(BaseModel):
    day: date
    user_source: FunnelUserSource
    decision_mode: FunnelDecisionMode
    counts: FunnelCounts
    conversions: FunnelConversionRates
