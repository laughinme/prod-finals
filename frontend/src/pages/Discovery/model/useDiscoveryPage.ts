import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type {
  MatchProfile,
  MatchProfileExplanationReason,
} from "@/entities/match-profile/model";
import {
  useFeed,
  useFeedExplanation,
  useFeedReaction,
} from "@/features/matchmaking";
import { useBlockUser, useReportUser } from "@/features/safety";

type MatchNavigationState = {
  matchedProfile: MatchProfile;
  matchId: string | null;
  conversationId: string | null;
};

function getExplanationTags(
  reasons: MatchProfileExplanationReason[],
  fallbackTags: string[],
): string[] {
  const nextTags = reasons
    .map((reason) => reason.title.trim())
    .filter(Boolean)
    .slice(0, 3);

  return nextTags.length > 0 ? nextTags : fallbackTags;
}

function getExplanationText(
  reasons: MatchProfileExplanationReason[],
  fallbackText: string,
): string {
  const nextText = reasons
    .map((reason) => reason.text.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return nextText || fallbackText;
}

export function useDiscoveryPage() {
  const navigate = useNavigate();
  const { profiles, isLoading: isFeedLoading, notifyVisible, removeProfile } = useFeed();
  const feedReactionMutation = useFeedReaction();
  const blockUserMutation = useBlockUser();
  const reportUserMutation = useReportUser();
  const [showReport, setShowReport] = useState(false);
  const [exitX, setExitX] = useState<number>(0);
  const currentProfileSeenAtRef = useRef<number | null>(null);

  const baseCurrentProfile = profiles[0] ?? null;

  // Notify feed when running low so it prefetches
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
        explanation: currentProfileExplanation
          ? getExplanationText(
              currentProfileExplanation.reasons,
              baseCurrentProfile.explanation,
            )
          : baseCurrentProfile.explanation,
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
    } catch {
      // handled in safety mutation hook
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
    } catch {
      // handled in safety mutation hook
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
      } catch {
        // reaction failed silently — card already dismissed
      }
    }
  };

  const handlePass = async () => {
    if (!currentProfile) return;

    const passedProfile = currentProfile;
    const dwellTimeMs = getCurrentDwellTimeMs();

    setExitX(-1000);
    dismissCurrentProfile();

    if (passedProfile.source === "feed" && typeof passedProfile.id === "string") {
      try {
        await feedReactionMutation.mutateAsync({
          serveItemId: passedProfile.id,
          action: "pass",
          openedExplanation: Boolean(currentProfileExplanation),
          openedProfile: false,
          dwellTimeMs,
        });
      } catch {
        // reaction failed silently — card already dismissed
      }
    }
  };

  return {
    currentProfile,
    stackDepth: Math.min(profiles.length, 3),
    isFeedLoading,
    isSafetyPending: blockUserMutation.isPending || reportUserMutation.isPending,
    exitX,
    showReport,
    openReport: () => setShowReport(true),
    closeReport: () => setShowReport(false),
    handleLike,
    handlePass,
    handleBlock,
    handleReport,
  };
}
