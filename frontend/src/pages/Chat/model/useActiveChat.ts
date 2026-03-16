import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/app/providers/auth/useAuth";
import { useMatches } from "@/features/match";
import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";
import { useIsMobile } from "@/shared/hooks/use-mobile";

import type { ChatNavigationState } from "./types";

type ChatView = "conversation" | "list";

type PersistedChatState = {
  activeMatchId: string | null;
  view: ChatView;
};

const CHAT_STATE_STORAGE_KEY_PREFIX = "t-match:chat-state:";

function getChatStateStorageKey(userKey: string) {
  return `${CHAT_STATE_STORAGE_KEY_PREFIX}${userKey}`;
}

function readPersistedChatState(storageKey: string): PersistedChatState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedChatState>;
    const view =
      parsedValue.view === "list" || parsedValue.view === "conversation"
        ? parsedValue.view
        : "conversation";

    return {
      activeMatchId:
        typeof parsedValue.activeMatchId === "string"
          ? parsedValue.activeMatchId
          : null,
      view,
    };
  } catch {
    return null;
  }
}

function writePersistedChatState(
  storageKey: string,
  state: PersistedChatState,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage access issues and keep chat state in memory only.
  }
}

export function useActiveChat() {
  const auth = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: matchesResponse, isLoading: isLoadingMatches } = useMatches();
  const matchNotifications = useMatchNotifications();
  const routeState = location.state as ChatNavigationState | null;
  const requestedMatchId = searchParams.get("match") ?? null;
  const explicitMatchId = routeState?.matchId ?? requestedMatchId ?? null;
  const storageKey = useMemo(
    () => getChatStateStorageKey(auth?.user?.email ?? "anonymous"),
    [auth?.user?.email],
  );
  const [activeMatchId, setActiveMatchId] = useState<string | null>(() => {
    if (explicitMatchId) {
      return explicitMatchId;
    }

    return readPersistedChatState(storageKey)?.activeMatchId ?? null;
  });
  const [view, setView] = useState<ChatView>(() => {
    if (explicitMatchId) {
      return "conversation";
    }

    return readPersistedChatState(storageKey)?.view ?? "conversation";
  });
  const [preferredMatchId, setPreferredMatchId] = useState<string | null>(
    explicitMatchId,
  );
  const [search, setSearch] = useState("");

  const matches = matchesResponse?.matches;
  const activeMatches = useMemo(
    () => (matches ?? []).filter((match) => match.status === "active"),
    [matches],
  );
  const visibleMatches = useMemo(
    () =>
      activeMatches.filter((match) =>
        match.displayName.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [activeMatches, search],
  );
  const activeMatch =
    visibleMatches.find((match) => match.matchId === activeMatchId) ??
    activeMatches.find((match) => match.matchId === activeMatchId) ??
    null;
  const hasExplicitConversationSelected =
    explicitMatchId != null && activeMatchId === explicitMatchId;
  const fallbackProfile = hasExplicitConversationSelected
    ? routeState?.matchedProfile ?? null
    : null;
  const activeConversationId =
    activeMatch?.conversationId ??
    (hasExplicitConversationSelected ? routeState?.conversationId ?? null : null);
  const isLoadingInitialChat = isLoadingMatches && !matchesResponse;

  useEffect(() => {
    if (explicitMatchId) {
      setPreferredMatchId(explicitMatchId);
      setView("conversation");
      setActiveMatchId(explicitMatchId);
      return;
    }

    const persistedState = readPersistedChatState(storageKey);
    setPreferredMatchId(null);
    setView(persistedState?.view ?? "conversation");
    setActiveMatchId(persistedState?.activeMatchId ?? null);
  }, [explicitMatchId, location.key, storageKey]);

  useEffect(() => {
    if (preferredMatchId) {
      if (activeMatchId !== preferredMatchId) {
        setActiveMatchId(preferredMatchId);
      }
      if (view !== "conversation") {
        setView("conversation");
      }
      return;
    }

    if (isMobile && view === "list") {
      if (activeMatchId !== null) {
        setActiveMatchId(null);
      }
      return;
    }

    if (isLoadingInitialChat) {
      return;
    }

    const hasSelectedActiveMatch =
      activeMatchId != null &&
      activeMatches.some((match) => match.matchId === activeMatchId);

    if (hasSelectedActiveMatch) {
      return;
    }

    const nextActiveMatch = visibleMatches[0] ?? activeMatches[0] ?? null;

    if (nextActiveMatch) {
      setView("conversation");
      setActiveMatchId(nextActiveMatch.matchId);
      return;
    }

    if (activeMatchId !== null) {
      setActiveMatchId(null);
    }
  }, [
    activeMatchId,
    activeMatches,
    isMobile,
    isLoadingInitialChat,
    preferredMatchId,
    visibleMatches,
    view,
  ]);

  useEffect(() => {
    if (activeMatch?.matchId) {
      void matchNotifications?.markMatchAsSeen(activeMatch.matchId);
    }
  }, [activeMatch?.matchId, matchNotifications]);

  useEffect(() => {
    writePersistedChatState(storageKey, {
      activeMatchId,
      view,
    });
  }, [activeMatchId, storageKey, view]);

  const moveAwayFromMatch = (matchId: string) => {
    if (preferredMatchId === matchId) {
      setPreferredMatchId(null);
    }

    const nextMatch =
      visibleMatches.find((match) => match.matchId !== matchId) ??
      activeMatches.find((match) => match.matchId !== matchId) ??
      null;

    if (nextMatch) {
      setView("conversation");
      setActiveMatchId(nextMatch.matchId);
      return;
    }

    setView("list");
    setActiveMatchId(null);
    navigate("/discovery");
  };

  const selectMatch = (matchId: string | null) => {
    setPreferredMatchId(null);

    if (matchId === null) {
      setView("list");
      setActiveMatchId(null);
      return;
    }

    setView("conversation");
    setActiveMatchId(matchId);
  };

  return {
    activeConversationId,
    activeMatch,
    fallbackProfile,
    goToDiscovery: () => navigate("/discovery"),
    isLoadingInitialChat,
    moveAwayFromMatch,
    search,
    selectMatch,
    setSearch,
    visibleMatches,
  };
}
