import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Sentry from "@sentry/react";

import type {
  MatchProfile,
  MatchProfileExplanationReason,
} from "@/entities/match-profile/model";
import {
  useFeed,
  useFeedExplanation,
  useFeedReaction,
  useFeedTestMatch,
} from "@/features/matchmaking";
import { useBlockUser, useReportUser } from "@/features/safety";

type MatchNavigationState = {
  matchedProfile: MatchProfile;
  matchId: string | null;
  conversationId: string | null;
};

type ReasonStrength = "high" | "medium" | "low";

const COMPAT_TITLE_MAP: Record<string, string> = {
  lifestyle_similarity: "Похожий образ жизни",
  activity_overlap: "Общие интересы",
  communication_style_fit: "Комфортный стиль общения",
  meetup_rhythm_fit: "Похожий ритм встреч",
  locality_fit: "Удобная география",
  novelty_boost: "Новый релевантный кандидат",
};

const COMPAT_TEXT_MAP: Record<string, Record<ReasonStrength, string>> = {
  lifestyle_similarity: {
    high: "Ваши привычки и стиль жизни хорошо совпадают.",
    medium: "Ваш образ жизни в целом хорошо сочетается.",
    low: "Есть точки соприкосновения по образу жизни.",
  },
  activity_overlap: {
    high: "У вас много общих интересов и сценариев досуга.",
    medium: "Есть заметное пересечение по интересам.",
    low: "Найдены отдельные общие интересы.",
  },
  communication_style_fit: {
    high: "Вам должно быть комфортно общаться друг с другом.",
    medium: "Ваш стиль общения в целом совместим.",
    low: "Есть базовая совместимость по стилю общения.",
  },
  meetup_rhythm_fit: {
    high: "Ваш привычный ритм встреч хорошо совпадает.",
    medium: "Ваш ритм встреч в целом сочетается.",
    low: "Есть базовая совместимость по ритму встреч.",
  },
  locality_fit: {
    high: "Вам будет удобно встречаться с учетом локации.",
    medium: "Локация и дистанция в целом подходят.",
    low: "Есть допустимая совместимость по локации.",
  },
};

const RAW_COMPAT_TOKEN_PATTERN = /^(?:compat\.)?[a-z_]+(?:\.(?:high|medium|low))?$/i;
const EN_REASON_TITLE_MAP: Record<string, string> = {
  "strong profile signal": "Достаточно данных профиля",
};
const EN_REASON_TEXT_MAP: Record<string, string> = {
  "the profile contains enough detail to support a more stable recommendation.":
    "В анкете достаточно данных для уверенной рекомендации.",
};

function parseCompatToken(raw: string): { code: string; strength: ReasonStrength } | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !RAW_COMPAT_TOKEN_PATTERN.test(normalized)) {
    return null;
  }

  const parts = normalized.split(".");
  if (parts[0] === "compat" && parts.length === 3) {
    const [, code, strength] = parts;
    if (strength === "high" || strength === "medium" || strength === "low") {
      return { code, strength };
    }
    return { code, strength: "medium" };
  }

  if (parts.length === 2) {
    const [code, strength] = parts;
    if (strength === "high" || strength === "medium" || strength === "low") {
      return { code, strength };
    }
  }

  if (parts.length === 1) {
    return { code: parts[0], strength: "medium" };
  }

  return null;
}

function normalizeReasonTitle(reason: MatchProfileExplanationReason): string {
  const rawTitle = reason.title.trim();
  const enMapped = EN_REASON_TITLE_MAP[rawTitle.toLowerCase()];
  if (enMapped) {
    return enMapped;
  }
  const parsedFromTitle = parseCompatToken(rawTitle);
  if (!parsedFromTitle) {
    return rawTitle;
  }

  return COMPAT_TITLE_MAP[parsedFromTitle.code] ?? "Совместимость профилей";
}

function normalizeReasonText(reason: MatchProfileExplanationReason): string {
  const rawText = reason.text.trim();
  const enMapped = EN_REASON_TEXT_MAP[rawText.toLowerCase()];
  if (enMapped) {
    return enMapped;
  }
  const parsedFromText = parseCompatToken(rawText);
  if (!parsedFromText) {
    return rawText;
  }

  return COMPAT_TEXT_MAP[parsedFromText.code]?.[parsedFromText.strength]
    ?? "Найдены признаки совместимости по анкете и поведению.";
}

function getExplanationTags(
  reasons: MatchProfileExplanationReason[],
  fallbackTags: string[],
): string[] {
  const nextTags = Array.from(
    new Set(
      reasons
        .map((reason) => normalizeReasonTitle(reason))
        .filter(Boolean),
    ),
  )
    .filter(Boolean)
    .slice(0, 3);

  return nextTags.length > 0 ? nextTags : fallbackTags;
}

function getExplanationText(
  reasons: MatchProfileExplanationReason[],
  fallbackText: string,
): string {
  const nextText = reasons
    .map((reason) => normalizeReasonText(reason))
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return nextText || fallbackText;
}

export function useDiscoveryPage() {
  const navigate = useNavigate();
  const {
    profiles,
    isLoading: isFeedLoading,
    notifyVisible,
    removeProfile,
  } = useFeed();
  const feedReactionMutation = useFeedReaction();
  const feedTestMatchMutation = useFeedTestMatch();
  const blockUserMutation = useBlockUser();
  const reportUserMutation = useReportUser();
  const [showReport, setShowReport] = useState(false);
  const [exitX, setExitX] = useState<number>(0);
  const currentProfileSeenAtRef = useRef<number | null>(null);

  const baseCurrentProfile = profiles[0] ?? null;

  useEffect(() => {
    notifyVisible(profiles.length);
  }, [profiles.length, notifyVisible]);

  const currentProfileServeItemId =
    baseCurrentProfile?.source === "feed" &&
    typeof baseCurrentProfile.id === "string"
      ? baseCurrentProfile.id
      : null;
  const currentProfileId = baseCurrentProfile?.id ?? null;
  const { data: currentProfileExplanation } = useFeedExplanation(
    baseCurrentProfile?.detailsAvailable ? currentProfileServeItemId : null,
  );

  useEffect(() => {
    currentProfileSeenAtRef.current = currentProfileId ? Date.now() : null;
  }, [currentProfileId]);

  const currentProfile = baseCurrentProfile
    ? {
        ...baseCurrentProfile,
        explanation: baseCurrentProfile.explanation
          || (currentProfileExplanation
            ? getExplanationText(
                currentProfileExplanation.reasons,
                baseCurrentProfile.explanation,
              )
            : ""),
        tags: currentProfileExplanation
          ? getExplanationTags(
              currentProfileExplanation.reasons,
              baseCurrentProfile.tags,
            )
          : baseCurrentProfile.tags,
      }
    : null;

  const getCurrentDwellTimeMs = () => {
    if (!currentProfileSeenAtRef.current) {
      return null;
    }

    return Math.max(Date.now() - currentProfileSeenAtRef.current, 0);
  };

  const dismissCurrentProfile = () => {
    if (!currentProfile) {
      return;
    }

    removeProfile(currentProfile.id);
  };

  const handleBlock = async () => {
    if (!currentProfile?.candidateUserId) {
      return;
    }

    try {
      await blockUserMutation.mutateAsync({
        targetUserId: currentProfile.candidateUserId,
        sourceContext: "feed",
        reasonCode: "unwanted_contact",
      });
      setShowReport(false);
      setExitX(-1000);
      dismissCurrentProfile();
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const handleReport = async () => {
    if (!currentProfile?.candidateUserId) {
      return;
    }

    try {
      await reportUserMutation.mutateAsync({
        targetUserId: currentProfile.candidateUserId,
        sourceContext: "feed",
        category: "other",
        alsoBlock: true,
      });
      setShowReport(false);
      setExitX(-1000);
      dismissCurrentProfile();
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const handleLike = async () => {
    if (!currentProfile) return;

    const likedProfile = currentProfile;
    const dwellTimeMs = getCurrentDwellTimeMs();

    setExitX(1000);
    dismissCurrentProfile();

    if (likedProfile.source === "feed" && typeof likedProfile.id === "string") {
      try {
        const reaction = await feedReactionMutation.mutateAsync({
          serveItemId: likedProfile.id,
          action: "like",
          openedExplanation: Boolean(currentProfileExplanation),
          openedProfile: false,
          dwellTimeMs,
        });

        if (reaction?.result === "matched" && reaction.match) {
          const state: MatchNavigationState = {
            matchedProfile: likedProfile,
            matchId: reaction.match.matchId,
            conversationId: reaction.match.conversationId,
          };
          navigate("/match", { state });
        }
      } catch (e) {
        Sentry.captureException(e);
      }
    }
  };

  const handlePass = async () => {
    if (!currentProfile) return;

    const passedProfile = currentProfile;
    const dwellTimeMs = getCurrentDwellTimeMs();

    setExitX(-1000);
    dismissCurrentProfile();

    if (
      passedProfile.source === "feed" &&
      typeof passedProfile.id === "string"
    ) {
      try {
        await feedReactionMutation.mutateAsync({
          serveItemId: passedProfile.id,
          action: "pass",
          openedExplanation: Boolean(currentProfileExplanation),
          openedProfile: false,
          dwellTimeMs,
        });
      } catch {
        // card already dismissed
      }
    }
  };

  const handlePrepareTestMatch = async () => {
    if (!currentProfile) return;
    if (currentProfile.source !== "feed" || typeof currentProfile.id !== "string") {
      return;
    }

    try {
      await feedTestMatchMutation.mutateAsync({
        serveItemId: currentProfile.id,
      });
    } catch {
      // handled in feed test-match mutation hook
    }
  };

  return {
    currentProfile,
    nextProfiles: profiles.slice(1, 3),
    isFeedLoading,
    isSafetyPending:
      blockUserMutation.isPending || reportUserMutation.isPending,
    exitX,
    showReport,
    openReport: () => setShowReport(true),
    closeReport: () => setShowReport(false),
    handleLike,
    handlePass,
    handlePrepareTestMatch,
    handleBlock,
    handleReport,
    isPreparingTestMatch: feedTestMatchMutation.isPending,
  };
}
