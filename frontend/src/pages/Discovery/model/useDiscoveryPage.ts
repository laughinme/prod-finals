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
  const { profiles, notifyVisible, removeProfile } = useFeed();
  const feedReactionMutation = useFeedReaction();
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
  const { data: currentProfileExplanation } = useFeedExplanation(
    baseCurrentProfile?.detailsAvailable ? currentProfileServeItemId : null,
  );

  useEffect(() => {
    currentProfileSeenAtRef.current = baseCurrentProfile ? Date.now() : null;
  }, [baseCurrentProfile?.id]);

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

  const handleLike = async () => {
    if (feedReactionMutation.isPending || !currentProfile) {
      return;
    }

    setExitX(1000);

    try {
      const reaction =
        currentProfile.source === "feed" && typeof currentProfile.id === "string"
          ? await feedReactionMutation.mutateAsync({
              serveItemId: currentProfile.id,
              action: "like",
              openedExplanation: Boolean(currentProfileExplanation),
              openedProfile: false,
              dwellTimeMs: getCurrentDwellTimeMs(),
            })
          : null;

      dismissCurrentProfile();

      if (reaction?.result === "matched" && reaction.match) {
        const state: MatchNavigationState = {
          matchedProfile: currentProfile,
          matchId: reaction.match.matchId,
          conversationId: reaction.match.conversationId,
        };

        window.setTimeout(() => navigate("/match", { state }), 300);
      }
    } catch {
      setExitX(0);
    }
  };

  const handlePass = async () => {
    if (feedReactionMutation.isPending || !currentProfile) {
      return;
    }

    setExitX(-1000);

    try {
      if (currentProfile.source === "feed" && typeof currentProfile.id === "string") {
        await feedReactionMutation.mutateAsync({
          serveItemId: currentProfile.id,
          action: "pass",
          openedExplanation: Boolean(currentProfileExplanation),
          openedProfile: false,
          dwellTimeMs: getCurrentDwellTimeMs(),
        });
      }

      dismissCurrentProfile();
    } catch {
      setExitX(0);
    }
  };

  return {
    currentProfile,
    exitX,
    showReport,
    openReport: () => setShowReport(true),
    closeReport: () => setShowReport(false),
    handleLike,
    handlePass,
  };
}
