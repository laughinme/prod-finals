import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/app/providers/auth/useAuth";
import {
  CURRENT_USER_PREVIEW,
  EMPTY_MATCHMAKING_DRAFT,
  INITIAL_CHAT_MESSAGES,
  type CurrentUserPreview,
  type MatchProfileExplanationReason,
  type MatchChatMessage,
  type MatchProfile,
  type MatchProfileId,
  type MatchmakingDraft,
} from "@/entities/match-profile/model";
import { useFeed } from "./useFeed";
import { useFeedExplanation } from "./useFeedExplanation";

type MatchmakingFlowContextValue = {
  currentProfile: MatchProfile | null;
  matchedProfile: MatchProfile | null;
  activeChatProfile: MatchProfile | null;
  chatProfiles: MatchProfile[];
  currentUserPreview: CurrentUserPreview;
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
  isFeedLoading: boolean;
  messages: MatchChatMessage[];
  setDraft: (draft: MatchmakingDraft) => void;
  completeOnboarding: (draft: MatchmakingDraft) => void;
  passCurrentProfile: () => void;
  likeCurrentProfile: () => { isMatch: boolean; profile: MatchProfile | null };
  resetDiscovery: () => void;
  openChat: (profileId: MatchProfileId) => void;
  closeMatch: () => void;
  sendMessage: (profileId: MatchProfileId, text: string) => void;
  reportProfile: (profileId: MatchProfileId) => void;
};

type PersistedMatchmakingState = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
};

const MatchmakingFlowContext = createContext<MatchmakingFlowContextValue | null>(null);

function getInitialPersistedState(): PersistedMatchmakingState {
  return {
    draft: EMPTY_MATCHMAKING_DRAFT,
    isOnboardingComplete: false,
  };
}

function cloneMessages(): Partial<Record<MatchProfileId, MatchChatMessage[]>> {
  return Object.fromEntries(
    Object.entries(INITIAL_CHAT_MESSAGES).map(([profileId, messages]) => [
      profileId,
      messages.map((message) => ({ ...message })),
    ]),
  ) as Partial<Record<MatchProfileId, MatchChatMessage[]>>;
}

function getStorageKey(userKey: string | null | undefined): string | null {
  if (!userKey) {
    return null;
  }

  return `t-match:mock-flow:${userKey}`;
}

function readPersistedState(storageKey: string | null): PersistedMatchmakingState {
  if (typeof window === "undefined" || !storageKey) {
    return getInitialPersistedState();
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return getInitialPersistedState();
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedMatchmakingState>;
    return {
      draft: {
        ...EMPTY_MATCHMAKING_DRAFT,
        ...parsedValue.draft,
        interests: parsedValue.draft?.interests ?? EMPTY_MATCHMAKING_DRAFT.interests,
      },
      isOnboardingComplete: parsedValue.isOnboardingComplete ?? false,
    };
  } catch {
    return getInitialPersistedState();
  }
}

function writePersistedState(storageKey: string | null, state: PersistedMatchmakingState) {
  if (typeof window === "undefined" || !storageKey) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function getProfileById(
  profiles: MatchProfile[],
  profileId: MatchProfileId | null,
): MatchProfile | null {
  if (!profileId) {
    return null;
  }

  return profiles.find((profile) => profile.id === profileId) ?? null;
}

function getTimeLabel(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function getExplanationTags(
  reasons: MatchProfileExplanationReason[],
  fallbackTags: string[],
): string[] {
  const nextTags = reasons
    .map((reason) => reason.tag)
    .filter((tag): tag is string => Boolean(tag))
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

export function MatchmakingFlowProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const storageKey = getStorageKey(auth?.user?.email as string | null | undefined);
  const { data: feed, isPending: isFeedLoading, refetch: refetchFeed } = useFeed();
  const profiles = feed?.profiles ?? [];

  const [draft, setDraft] = useState<MatchmakingDraft>(EMPTY_MATCHMAKING_DRAFT);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
  const [dismissedProfileIds, setDismissedProfileIds] = useState<MatchProfileId[]>([]);
  const [matchedProfileId, setMatchedProfileId] = useState<MatchProfileId | null>(null);
  const [activeChatProfileId, setActiveChatProfileId] = useState<MatchProfileId | null>(null);
  const [chatProfileIds, setChatProfileIds] = useState<MatchProfileId[]>([]);
  const [messagesByProfileId, setMessagesByProfileId] = useState<
    Partial<Record<MatchProfileId, MatchChatMessage[]>>
  >(() => cloneMessages());

  useEffect(() => {
    const persistedState = readPersistedState(storageKey);
    setDraft(persistedState.draft);
    setIsOnboardingComplete(persistedState.isOnboardingComplete);
    setDismissedProfileIds([]);
    setMatchedProfileId(null);
    setActiveChatProfileId(null);
    setChatProfileIds([]);
    setMessagesByProfileId(cloneMessages());
  }, [storageKey]);

  useEffect(() => {
    writePersistedState(storageKey, {
      draft,
      isOnboardingComplete,
    });
  }, [draft, isOnboardingComplete, storageKey]);

  const visibleProfiles = profiles.filter(
    (profile) => !dismissedProfileIds.includes(profile.id),
  );
  const baseCurrentProfile = visibleProfiles[0] ?? null;
  const currentProfileServeItemId =
    baseCurrentProfile?.source === "feed" && typeof baseCurrentProfile.id === "string"
      ? baseCurrentProfile.id
      : null;
  const { data: currentProfileExplanation } = useFeedExplanation(
    baseCurrentProfile?.detailsAvailable ? currentProfileServeItemId : null,
  );
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
  const matchedProfile = getProfileById(profiles, matchedProfileId);
  const activeChatProfile =
    getProfileById(profiles, activeChatProfileId) ??
    getProfileById(profiles, chatProfileIds[0] ?? null) ??
    null;
  const chatProfiles = chatProfileIds
    .map((profileId) => getProfileById(profiles, profileId))
    .filter((profile): profile is MatchProfile => profile !== null);
  const messages = activeChatProfile ? messagesByProfileId[activeChatProfile.id] ?? [] : [];

  const completeOnboarding = (nextDraft: MatchmakingDraft) => {
    setDraft(nextDraft);
    setIsOnboardingComplete(true);
  };

  const passCurrentProfile = () => {
    if (!currentProfile) {
      return;
    }

    setDismissedProfileIds((prevIds) =>
      prevIds.includes(currentProfile.id) ? prevIds : [...prevIds, currentProfile.id],
    );
  };

  const likeCurrentProfile = () => {
    if (!currentProfile) {
      return { isMatch: false, profile: null };
    }

    setDismissedProfileIds((prevIds) =>
      prevIds.includes(currentProfile.id) ? prevIds : [...prevIds, currentProfile.id],
    );

    const isMatch = currentProfile.id === profiles[0]?.id;
    if (isMatch) {
      setMatchedProfileId(currentProfile.id);
      setActiveChatProfileId(currentProfile.id);
      setChatProfileIds((prevIds) =>
        prevIds.includes(currentProfile.id) ? prevIds : [currentProfile.id, ...prevIds],
      );
    }

    return { isMatch, profile: currentProfile };
  };

  const resetDiscovery = () => {
    setDismissedProfileIds([]);
    void refetchFeed();
  };

  const openChat = (profileId: MatchProfileId) => {
    const profile = getProfileById(profiles, profileId);
    if (!profile) {
      return;
    }

    setActiveChatProfileId(profileId);
    setChatProfileIds((prevIds) => (prevIds.includes(profileId) ? prevIds : [profileId, ...prevIds]));
  };

  const closeMatch = () => {
    setMatchedProfileId(null);
  };

  const sendMessage = (profileId: MatchProfileId, text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }

    setMessagesByProfileId((prevMessages) => ({
      ...prevMessages,
      [profileId]: [
        ...(prevMessages[profileId] ?? []),
        {
          id: Date.now(),
          text: trimmedText,
          sender: "me",
          time: getTimeLabel(),
        },
      ],
    }));
  };

  const reportProfile = (profileId: MatchProfileId) => {
    setDismissedProfileIds((prevIds) =>
      prevIds.includes(profileId) ? prevIds : [...prevIds, profileId],
    );
    setMatchedProfileId((prevId) => (prevId === profileId ? null : prevId));
    setChatProfileIds((prevIds) => prevIds.filter((id) => id !== profileId));
    setActiveChatProfileId((prevId) => (prevId === profileId ? null : prevId));
  };

  return (
    <MatchmakingFlowContext.Provider
      value={{
        currentProfile,
        matchedProfile,
        activeChatProfile,
        chatProfiles,
        currentUserPreview: CURRENT_USER_PREVIEW,
        draft,
        isOnboardingComplete,
        isFeedLoading,
        messages,
        setDraft,
        completeOnboarding,
        passCurrentProfile,
        likeCurrentProfile,
        resetDiscovery,
        openChat,
        closeMatch,
        sendMessage,
        reportProfile,
      }}
    >
      {children}
    </MatchmakingFlowContext.Provider>
  );
}

export function useMatchmakingFlow() {
  const context = useContext(MatchmakingFlowContext);

  if (!context) {
    throw new Error("useMatchmakingFlow must be used within a MatchmakingFlowProvider.");
  }

  return context;
}
