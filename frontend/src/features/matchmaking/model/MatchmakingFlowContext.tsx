import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/app/providers/auth/useAuth";
import {
  EMPTY_MATCHMAKING_DRAFT,
  type MatchmakingDraft,
} from "@/entities/match-profile/model";

type MatchmakingFlowContextValue = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
  setDraft: (draft: MatchmakingDraft) => void;
  completeOnboarding: (draft: MatchmakingDraft) => void;
};

type PersistedMatchmakingState = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
};

const MatchmakingFlowContext =
  createContext<MatchmakingFlowContextValue | null>(null);

function getInitialPersistedState(): PersistedMatchmakingState {
  return {
    draft: EMPTY_MATCHMAKING_DRAFT,
    isOnboardingComplete: false,
  };
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

export function MatchmakingFlowProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const storageKey = getStorageKey(auth?.user?.email as string | null | undefined);

  const [draft, setDraft] = useState<MatchmakingDraft>(EMPTY_MATCHMAKING_DRAFT);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);

  useEffect(() => {
    const persistedState = readPersistedState(storageKey);
    setDraft(persistedState.draft);
    setIsOnboardingComplete(persistedState.isOnboardingComplete);
  }, [storageKey]);

  useEffect(() => {
    writePersistedState(storageKey, {
      draft,
      isOnboardingComplete,
    });
  }, [draft, isOnboardingComplete, storageKey]);

  const completeOnboarding = (nextDraft: MatchmakingDraft) => {
    setDraft(nextDraft);
    setIsOnboardingComplete(true);
  };

  return (
    <MatchmakingFlowContext.Provider
      value={{
        draft,
        isOnboardingComplete,
        setDraft,
        completeOnboarding,
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
