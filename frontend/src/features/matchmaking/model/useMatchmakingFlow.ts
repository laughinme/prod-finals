import { createContext, useContext } from "react";
import type { MatchmakingFlowContextValue } from "./types";

export const MatchmakingFlowContext =
  createContext<MatchmakingFlowContextValue | null>(null);

export function useMatchmakingFlow() {
  const context = useContext(MatchmakingFlowContext);

  if (!context) {
    throw new Error(
      "useMatchmakingFlow must be used within a MatchmakingFlowProvider.",
    );
  }

  return context;
}
