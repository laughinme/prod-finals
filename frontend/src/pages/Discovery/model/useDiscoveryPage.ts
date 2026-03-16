import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import type {
  MatchProfile,
  MatchProfileExplanationReason,
} from "@/entities/match-profile/model";
import { toMatchProfile } from "@/entities/match-profile/model";
import {
  getLikeNotificationCard,
  postLikeNotificationReaction,
  type LikeNotificationCardDto,
} from "@/shared/api/likeNotifications";
import {
  getDemoFeedCard,
  getDemoFeedShortcuts,
  type DemoFeedShortcutItemDto,
} from "@/shared/api/feed";
import {
  useFeed,
  useFeedExplanation,
  useFeedReaction,
  useFeedTestMatch,
} from "@/features/matchmaking";
import { useProfile, useSetDefaultAvatar, useUploadAvatar } from "@/features/profile";
import { useBlockUser, useReportUser } from "@/features/safety";

type MatchNavigationState = {
  matchedProfile: MatchProfile;
  matchId: string | null;
  conversationId: string | null;
};

type DiscoveryLocationState = {
  likeNotificationId?: string | null;
} | null;

export type DiscoveryDemoShortcut = {
  demoUserKey: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isCurrentUser: boolean;
};

type ReasonStrength = "high" | "medium" | "low";

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
const EN_REASON_TEXT_MAP: Record<string, string> = {
  "the profile contains enough detail to support a more stable recommendation.":
    "Найдены признаки совместимости по интересам и поведению.",
};
const HIDDEN_REASON_CODES = new Set(["profile_quality", "strong_profile_signal"]);

function shouldHideReason(reason: MatchProfileExplanationReason): boolean {
  const code = reason.code.trim().toLowerCase();
  if (HIDDEN_REASON_CODES.has(code)) {
    return true;
  }

  const title = reason.title.trim().toLowerCase();
  if (title.includes("profile signal") || title.includes("данных профиля")) {
    return true;
  }

  const text = reason.text.trim().toLowerCase();
  return text.includes("enough detail to support") || text.includes("достаточно данных");
}

function filterReasonsForUi(
  reasons: MatchProfileExplanationReason[],
): MatchProfileExplanationReason[] {
  return reasons.filter((reason) => !shouldHideReason(reason));
}

function getCategoryTags(profile: MatchProfile): string[] {
  return Array.from(
    new Set(
      (profile.categoryBreakdown || [])
        .map((entry) => entry.label?.trim())
        .filter((label): label is string => Boolean(label && label !== "<none>" && label.toLowerCase() !== "unknown")),
    ),
  ).slice(0, 3);
}

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
    ?? "Найдены признаки совместимости по интересам и поведению.";
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

function toLikeNotificationProfile(dto: LikeNotificationCardDto): MatchProfile {
  return {
    id: dto.notification_id,
    candidateUserId: dto.candidate.user_id,
    name: dto.candidate.display_name,
    age: dto.candidate.age,
    image: dto.candidate.avatar_url,
    bio: dto.candidate.bio,
    matchScore: dto.compatibility.score_percent,
    categoryBreakdown: dto.compatibility.category_breakdown.map((cat) => ({
      categoryKey: cat.category_key,
      label: cat.label,
      scorePercent: cat.score_percent,
    })),
    tags: [],
    explanation: dto.compatibility.preview,
    location: dto.candidate.city ?? "",
    reasonCodes: dto.compatibility.reason_codes,
    detailsAvailable: false,
    actions: {
      canLike: dto.actions.can_like,
      canPass: dto.actions.can_pass,
      canHide: dto.actions.can_hide,
      canBlock: dto.actions.can_block,
      canReport: dto.actions.can_report,
    },
    source: "like_notification",
  };
}

function toDiscoveryDemoShortcut(dto: DemoFeedShortcutItemDto): DiscoveryDemoShortcut {
  return {
    demoUserKey: dto.demo_user_key,
    displayName: dto.display_name,
    avatarUrl: dto.avatar_url,
    bio: dto.bio,
    isCurrentUser: dto.is_current_user,
  };
}

export function useDiscoveryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as DiscoveryLocationState;
  const { data: viewerProfile } = useProfile();

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
  const uploadAvatarMutation = useUploadAvatar();
  const setDefaultAvatarMutation = useSetDefaultAvatar();
  const [showReport, setShowReport] = useState(false);
  const [showPhotoGate, setShowPhotoGate] = useState(false);
  const [exitX, setExitX] = useState<number>(0);
  const [retryLikeAfterPhoto, setRetryLikeAfterPhoto] = useState(false);
  const [activeLikeNotificationId, setActiveLikeNotificationId] = useState<string | null>(
    routeState?.likeNotificationId ?? null,
  );
  const [activeDemoShortcutKey, setActiveDemoShortcutKey] = useState<string | null>(null);
  const currentProfileSeenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (routeState?.likeNotificationId) {
      setActiveLikeNotificationId(routeState.likeNotificationId);
    }
  }, [routeState?.likeNotificationId]);

  const likeNotificationCardQuery = useQuery({
    queryKey: ["notifications", "likes", activeLikeNotificationId, "card"],
    queryFn: async () => {
      if (!activeLikeNotificationId) {
        throw new Error("Missing like notification id");
      }
      return getLikeNotificationCard(activeLikeNotificationId);
    },
    enabled: Boolean(activeLikeNotificationId),
    retry: false,
  });

  const demoShortcutsQuery = useQuery({
    queryKey: ["feed", "demo-shortcuts"],
    queryFn: getDemoFeedShortcuts,
    staleTime: 1000 * 60 * 10,
  });

  const demoShortcutCardQuery = useQuery({
    queryKey: ["feed", "demo-shortcuts", activeDemoShortcutKey, "card"],
    queryFn: async () => {
      if (!activeDemoShortcutKey) {
        throw new Error("Missing demo shortcut key");
      }
      return getDemoFeedCard(activeDemoShortcutKey);
    },
    enabled: Boolean(activeDemoShortcutKey),
    retry: false,
  });

  useEffect(() => {
    if (!likeNotificationCardQuery.isError) {
      return;
    }
    setActiveLikeNotificationId(null);
    navigate(location.pathname, { replace: true, state: null });
  }, [likeNotificationCardQuery.isError, location.pathname, navigate]);

  useEffect(() => {
    if (!demoShortcutCardQuery.isError) {
      return;
    }
    setActiveDemoShortcutKey(null);
  }, [demoShortcutCardQuery.isError]);

  const specialLikeProfile = likeNotificationCardQuery.data
    ? toLikeNotificationProfile(likeNotificationCardQuery.data)
    : null;
  const demoShortcutProfile = demoShortcutCardQuery.data
    ? { ...toMatchProfile(demoShortcutCardQuery.data), source: "demo_shortcut" as const }
    : null;
  const baseCurrentProfile = demoShortcutProfile ?? specialLikeProfile ?? profiles[0] ?? null;

  useEffect(() => {
    notifyVisible(profiles.length);
  }, [profiles.length, notifyVisible]);

  const currentProfileServeItemId =
    (baseCurrentProfile?.source === "feed" || baseCurrentProfile?.source === "demo_shortcut") &&
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

  const reasonsForUi = currentProfileExplanation
    ? filterReasonsForUi(currentProfileExplanation.reasons)
    : [];

  const currentProfile = baseCurrentProfile
    ? {
        ...baseCurrentProfile,
        explanation: baseCurrentProfile.explanation
          || (reasonsForUi.length > 0
            ? getExplanationText(
                reasonsForUi,
                baseCurrentProfile.explanation,
              )
            : ""),
        tags: getCategoryTags(baseCurrentProfile),
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

    if (currentProfile.source === "like_notification") {
      setActiveLikeNotificationId(null);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (currentProfile.source === "demo_shortcut") {
      setActiveDemoShortcutKey(null);
      return;
    }

    removeProfile(currentProfile.id);
  };

  const openPhotoGate = () => {
    setShowPhotoGate(true);
  };

  const closePhotoGate = () => {
    setRetryLikeAfterPhoto(false);
    setShowPhotoGate(false);
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

  const handleLike = useCallback(async (): Promise<boolean> => {
    if (!currentProfile) {
      return false;
    }

    const canLikeProfiles =
      viewerProfile?.canLikeProfiles ?? currentProfile.actions?.canLike ?? false;

    if (!canLikeProfiles) {
      openPhotoGate();
      return false;
    }

    const likedProfile = currentProfile;
    const dwellTimeMs = getCurrentDwellTimeMs();

    if (
      likedProfile.source === "like_notification" &&
      activeLikeNotificationId
    ) {
      try {
        const reaction = await postLikeNotificationReaction(
          activeLikeNotificationId,
          {
            action: "like",
            openedExplanation: false,
            openedProfile: false,
            dwellTimeMs,
          },
        );
        setExitX(1000);
        dismissCurrentProfile();

        if (reaction?.result === "matched" && reaction.match) {
          const state: MatchNavigationState = {
            matchedProfile: likedProfile,
            matchId: reaction.match.match_id,
            conversationId: reaction.match.conversation_id,
          };
          navigate("/match", { state });
        }
        return true;
      } catch (e) {
        if (
          axios.isAxiosError(e) &&
          typeof e.response?.data === "object" &&
          e.response?.data &&
          "error_code" in e.response.data &&
          e.response.data.error_code === "PHOTO_REQUIRED_TO_LIKE"
        ) {
          openPhotoGate();
          return false;
        }
        Sentry.captureException(e);
        toast.error(t("discovery.like_failed"));
        return false;
      }
    }

    if (
      (likedProfile.source === "feed" || likedProfile.source === "demo_shortcut") &&
      typeof likedProfile.id === "string"
    ) {
      try {
        const reaction = await feedReactionMutation.mutateAsync({
          serveItemId: likedProfile.id,
          action: "like",
          openedExplanation: Boolean(currentProfileExplanation),
          openedProfile: false,
          dwellTimeMs,
        });

        setExitX(1000);
        dismissCurrentProfile();

        if (reaction?.result === "matched" && reaction.match) {
          const state: MatchNavigationState = {
            matchedProfile: likedProfile,
            matchId: reaction.match.matchId,
            conversationId: reaction.match.conversationId,
          };
          navigate("/match", { state });
        }
        return true;
      } catch (e) {
        if (
          axios.isAxiosError(e) &&
          typeof e.response?.data === "object" &&
          e.response?.data &&
          "error_code" in e.response.data &&
          e.response.data.error_code === "PHOTO_REQUIRED_TO_LIKE"
        ) {
          openPhotoGate();
          return false;
        }
        Sentry.captureException(e);
        toast.error(t("discovery.like_failed"));
      }
    }
    return false;
  }, [
    currentProfile,
    currentProfileExplanation,
    feedReactionMutation,
    navigate,
    t,
    viewerProfile?.canLikeProfiles,
  ]);

  useEffect(() => {
    if (!retryLikeAfterPhoto || !viewerProfile?.canLikeProfiles) {
      return;
    }

    setRetryLikeAfterPhoto(false);
    setShowPhotoGate(false);
    void handleLike();
  }, [handleLike, retryLikeAfterPhoto, viewerProfile?.canLikeProfiles]);

  const handleUseDefaultPhoto = async () => {
    try {
      await setDefaultAvatarMutation.mutateAsync();
      setRetryLikeAfterPhoto(true);
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    try {
      await uploadAvatarMutation.mutateAsync(file);
      setRetryLikeAfterPhoto(true);
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const handlePass = async () => {
    if (!currentProfile) return;

    const passedProfile = currentProfile;
    const dwellTimeMs = getCurrentDwellTimeMs();

    setExitX(-1000);
    dismissCurrentProfile();

    if (
      passedProfile.source === "like_notification" &&
      activeLikeNotificationId
    ) {
      try {
        await postLikeNotificationReaction(activeLikeNotificationId, {
          action: "pass",
          openedExplanation: false,
          openedProfile: false,
          dwellTimeMs,
        });
      } catch {
        // special notification card already dismissed
      }
      return;
    }

    if (
      (passedProfile.source === "feed" || passedProfile.source === "demo_shortcut") &&
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
    if (
      (currentProfile.source !== "feed" && currentProfile.source !== "demo_shortcut")
      || typeof currentProfile.id !== "string"
    ) {
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
    nextProfiles: (specialLikeProfile || demoShortcutProfile) ? profiles.slice(0, 2) : profiles.slice(1, 3),
    isFeedLoading: isFeedLoading || likeNotificationCardQuery.isLoading || demoShortcutCardQuery.isLoading,
    demoShortcuts: (demoShortcutsQuery.data?.items || []).map(toDiscoveryDemoShortcut),
    activeDemoShortcutKey,
    openDemoShortcut: (demoUserKey: string) => setActiveDemoShortcutKey(demoUserKey),
    closeDemoShortcut: () => setActiveDemoShortcutKey(null),
    isSafetyPending:
      blockUserMutation.isPending || reportUserMutation.isPending,
    isPhotoGatePending:
      uploadAvatarMutation.isPending || setDefaultAvatarMutation.isPending,
    exitX,
    showReport,
    showPhotoGate,
    openReport: () => setShowReport(true),
    closeReport: () => setShowReport(false),
    closePhotoGate,
    handleLike,
    handlePass,
    handlePrepareTestMatch,
    handleBlock,
    handleReport,
    handleUseDefaultPhoto,
    handleUploadPhoto,
    isPreparingTestMatch: feedTestMatchMutation.isPending,
  };
}
