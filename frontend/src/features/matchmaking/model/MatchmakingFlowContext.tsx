import * as Sentry from "@sentry/react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/app/providers/auth/useAuth";

import type {
  MatchmakingFlowContextValue,
  PersistedMatchmakingState,
} from "./types";
import { MatchmakingFlowContext } from "./useMatchmakingFlow";

function getInitialPersistedState(): PersistedMatchmakingState {
  return {
    isOnboardingComplete: false,
  };
}

function getStorageKey(userKey: string | null | undefined): string | null {
  if (!userKey) {
    return null;
  }

  return `t-match:mock-flow:${userKey}`;
}

function readPersistedState(
  storageKey: string | null,
): PersistedMatchmakingState {
  if (typeof window === "undefined" || !storageKey) {
    return getInitialPersistedState();
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return getInitialPersistedState();
    }

    const parsedValue = JSON.parse(
      rawValue,
    ) as Partial<PersistedMatchmakingState>;

    return {
      isOnboardingComplete: parsedValue.isOnboardingComplete ?? false,
    };
  } catch (error) {
    Sentry.captureException(error);
    return getInitialPersistedState();
  }
}

function writePersistedState(
  storageKey: string | null,
  state: PersistedMatchmakingState,
) {
  if (typeof window === "undefined" || !storageKey) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function MatchmakingFlowProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const storageKey = getStorageKey(
    auth?.user?.email as string | null | undefined,
  );

  const [isOnboardingComplete, setIsOnboardingComplete] =
    useState<boolean>(false);

  useEffect(() => {
    const persistedState = readPersistedState(storageKey);
    setIsOnboardingComplete(persistedState.isOnboardingComplete);
  }, [storageKey]);

  useEffect(() => {
    writePersistedState(storageKey, {
      isOnboardingComplete,
    });
  }, [isOnboardingComplete, storageKey]);

  const completeOnboarding = () => {
    setIsOnboardingComplete(true);
  };

  return (
    <MatchmakingFlowContext.Provider
      value={{
        isOnboardingComplete,
        completeOnboarding,
        setIsOnboardingComplete,
      }}
    >
      {children}
    </MatchmakingFlowContext.Provider>
  );
}
