import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useMatches } from "@/features/match";
import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";

import type { ChatNavigationState } from "./types";

export function useActiveChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: matchesResponse, isLoading: isLoadingMatches } = useMatches();
  const matchNotifications = useMatchNotifications();
  const routeState = location.state as ChatNavigationState | null;
  const requestedMatchId = searchParams.get("match");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    routeState?.matchId ?? requestedMatchId ?? null,
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
  const fallbackProfile = routeState?.matchedProfile ?? null;
  const activeConversationId =
    activeMatch?.conversationId ?? routeState?.conversationId ?? null;
  const isLoadingInitialChat = isLoadingMatches && !matchesResponse;

  useEffect(() => {
    const hasSelectedActiveMatch =
      activeMatchId != null &&
      activeMatches.some((match) => match.matchId === activeMatchId);

    if (hasSelectedActiveMatch) {
      return;
    }

    const initialActiveMatch =
      (routeState?.matchId &&
        activeMatches.find((match) => match.matchId === routeState.matchId)) ??
      (requestedMatchId &&
        activeMatches.find((match) => match.matchId === requestedMatchId)) ??
      visibleMatches[0] ??
      activeMatches[0] ??
      null;

    if (initialActiveMatch) {
      setActiveMatchId(initialActiveMatch.matchId);
      return;
    }

    if (!routeState?.conversationId) {
      setActiveMatchId(null);
    }
  }, [
    activeMatchId,
    activeMatches,
    requestedMatchId,
    routeState?.conversationId,
    routeState?.matchId,
    visibleMatches,
  ]);

  useEffect(() => {
    if (activeMatch?.matchId) {
      void matchNotifications?.markMatchAsSeen(activeMatch.matchId);
    }
  }, [activeMatch?.matchId, matchNotifications]);

  const moveAwayFromMatch = (matchId: string) => {
    const nextMatch =
      visibleMatches.find((match) => match.matchId !== matchId) ??
      activeMatches.find((match) => match.matchId !== matchId) ??
      null;

    if (nextMatch) {
      setActiveMatchId(nextMatch.matchId);
      return;
    }

    setActiveMatchId(null);
    navigate("/discovery");
  };

  return {
    activeConversationId,
    activeMatch,
    fallbackProfile,
    goToDiscovery: () => navigate("/discovery"),
    isLoadingInitialChat,
    moveAwayFromMatch,
    search,
    selectMatch: (matchId: string) => setActiveMatchId(matchId),
    setSearch,
    visibleMatches,
  };
}
