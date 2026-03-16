import apiProtected from "./axiosInstance";

export type UserStatsSummaryDto = {
  generated_at: string;
  total_users: number;
  onboarded_users: number;
  banned_users: number;
  registered_last_24h: number;
};

export type RegistrationsGraphDto = {
  day: string;
  count: number;
};

export type FunnelCountsDto = {
  feed_served: number;
  feed_explanation_opened: number;
  feed_like: number;
  feed_pass: number;
  feed_hide: number;
  match_created: number;
  chat_first_message_sent: number;
  chat_first_reply_received: number;
  match_closed: number;
  user_blocked: number;
  user_reported: number;
};

export type FunnelConversionRatesDto = {
  like_rate: number;
  match_rate_from_likes: number;
  first_message_rate_from_matches: number;
  first_reply_rate_from_first_messages: number;
  negative_outcome_rate_from_matches: number;
};

export type FunnelSegmentSummaryDto = {
  user_source: "dataset" | "cold_start" | null;
  decision_mode: "model" | "fallback" | "unknown" | null;
  counts: FunnelCountsDto;
  conversions: FunnelConversionRatesDto;
};

export type FunnelSummaryDto = {
  generated_at: string;
  totals: FunnelCountsDto;
  conversions: FunnelConversionRatesDto;
  by_user_source: FunnelSegmentSummaryDto[];
  by_decision_mode: FunnelSegmentSummaryDto[];
  by_segment: FunnelSegmentSummaryDto[];
};

export type FunnelDailyRowDto = {
  day: string;
  user_source: "dataset" | "cold_start";
  decision_mode: "model" | "fallback" | "unknown";
  counts: FunnelCountsDto;
  conversions: FunnelConversionRatesDto;
};

export type RandomMixConfigDto = {
  random_mix_percent: number;
  updated_at: string;
};

export const getAdminUserSummary = async (): Promise<UserStatsSummaryDto> => {
  const response = await apiProtected.get<UserStatsSummaryDto>("/admins/stats/summary");
  return response.data;
};

export const getAdminRegistrations = async (
  days: number,
): Promise<RegistrationsGraphDto[]> => {
  const response = await apiProtected.get<RegistrationsGraphDto[]>(
    "/admins/stats/registrations",
    {
      params: { days },
    },
  );
  return response.data;
};

export const getAdminFunnelSummary = async (): Promise<FunnelSummaryDto> => {
  const response = await apiProtected.get<FunnelSummaryDto>("/admins/stats/funnel/summary");
  return response.data;
};

export const getAdminFunnelDaily = async (
  days: number,
): Promise<FunnelDailyRowDto[]> => {
  const response = await apiProtected.get<FunnelDailyRowDto[]>(
    "/admins/stats/funnel/daily",
    {
      params: { days },
    },
  );
  return response.data;
};

export const getAdminRandomMixConfig = async (): Promise<RandomMixConfigDto> => {
  const response = await apiProtected.get<RandomMixConfigDto>("/admins/experiments/random-mix");
  return response.data;
};

export const updateAdminRandomMixConfig = async (
  randomMixPercent: number,
): Promise<RandomMixConfigDto> => {
  const response = await apiProtected.put<RandomMixConfigDto>(
    "/admins/experiments/random-mix",
    {
      random_mix_percent: randomMixPercent,
    },
  );
  return response.data;
};
