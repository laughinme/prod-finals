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
  MOCK_DISCOVERY_PROFILES,
  type CurrentUserPreview,
  type MatchChatMessage,
  type MatchProfile,
  type MatchmakingDraft,
} from "@/entities/match-profile/model";

type MatchmakingFlowContextValue = {
  currentProfile: MatchProfile | null;
  matchedProfile: MatchProfile | null;
  activeChatProfile: MatchProfile | null;
  chatProfiles: MatchProfile[];
  currentUserPreview: CurrentUserPreview;
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
  messages: MatchChatMessage[];
  setDraft: (draft: MatchmakingDraft) => void;
  completeOnboarding: (draft: MatchmakingDraft) => void;
  passCurrentProfile: () => void;
  likeCurrentProfile: () => { isMatch: boolean; profile: MatchProfile | null };
  resetDiscovery: () => void;
  openChat: (profileId: number) => void;
  closeMatch: () => void;
  sendMessage: (profileId: number, text: string) => void;
  reportProfile: (profileId: number) => void;
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

function cloneProfiles(): MatchProfile[] {
  return MOCK_DISCOVERY_PROFILES.map((profile) => ({
    ...profile,
    tags: [...profile.tags],
  }));
}

function cloneMessages(): Record<number, MatchChatMessage[]> {
  return Object.fromEntries(
    Object.entries(INITIAL_CHAT_MESSAGES).map(([profileId, messages]) => [
      Number(profileId),
      messages.map((message) => ({ ...message })),
    ]),
  );
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

function getProfileById(profileId: number | null): MatchProfile | null {
  if (!profileId) {
    return null;
  }

  return MOCK_DISCOVERY_PROFILES.find((profile) => profile.id === profileId) ?? null;
}

function getTimeLabel(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function MatchmakingFlowProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const storageKey = getStorageKey(auth?.user?.email as string | null | undefined);

  const [draft, setDraft] = useState<MatchmakingDraft>(EMPTY_MATCHMAKING_DRAFT);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<MatchProfile[]>(() => cloneProfiles());
  const [matchedProfileId, setMatchedProfileId] = useState<number | null>(null);
  const [activeChatProfileId, setActiveChatProfileId] = useState<number | null>(null);
  const [chatProfileIds, setChatProfileIds] = useState<number[]>([]);
  const [messagesByProfileId, setMessagesByProfileId] = useState<
    Record<number, MatchChatMessage[]>
  >(() => cloneMessages());

  useEffect(() => {
    const persistedState = readPersistedState(storageKey);
    setDraft(persistedState.draft);
    setIsOnboardingComplete(persistedState.isOnboardingComplete);
    setProfiles(cloneProfiles());
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

  const currentProfile = profiles[0] ?? null;
  const matchedProfile = getProfileById(matchedProfileId);
  const activeChatProfile =
    getProfileById(activeChatProfileId) ??
    getProfileById(chatProfileIds[0] ?? null) ??
    null;
  const chatProfiles = chatProfileIds
    .map((profileId) => getProfileById(profileId))
    .filter((profile): profile is MatchProfile => profile !== null);
  const messages = activeChatProfile ? messagesByProfileId[activeChatProfile.id] ?? [] : [];

  const completeOnboarding = (nextDraft: MatchmakingDraft) => {
    setDraft(nextDraft);
    setIsOnboardingComplete(true);
  };

  const passCurrentProfile = () => {
    setProfiles((prevProfiles) => prevProfiles.slice(1));
  };

  const likeCurrentProfile = () => {
    if (!currentProfile) {
      return { isMatch: false, profile: null };
    }

    setProfiles((prevProfiles) => prevProfiles.slice(1));

    const isMatch = currentProfile.id === 1;
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
    setProfiles(cloneProfiles());
  };

  const openChat = (profileId: number) => {
    const profile = getProfileById(profileId);
    if (!profile) {
      return;
    }

    setActiveChatProfileId(profileId);
    setChatProfileIds((prevIds) => (prevIds.includes(profileId) ? prevIds : [profileId, ...prevIds]));
  };

  const closeMatch = () => {
    setMatchedProfileId(null);
  };

  const sendMessage = (profileId: number, text: string) => {
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

  const reportProfile = (profileId: number) => {
    setProfiles((prevProfiles) => prevProfiles.filter((profile) => profile.id !== profileId));
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
