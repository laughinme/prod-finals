import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers/auth/useAuth";

export function useQuizCompletion() {
  const auth = useAuth();
  const userKey = auth?.user?.email || "anonymous";
  const storageKey = useMemo(() => `t-match:quiz-flow:${userKey}`, [userKey]);

  const [isQuizCompletedLocal, setIsQuizCompletedLocal] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(storageKey) === "true";
      } catch {
        return false;
      }
    },
  );

  // Sync state when storageKey changes (user login/logout)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setIsQuizCompletedLocal(stored === "true");
    } catch {
      setIsQuizCompletedLocal(false);
    }
  }, [storageKey]);

  const setQuizCompleted = useCallback((value: boolean) => {
    try {
      localStorage.setItem(storageKey, value ? "true" : "false");
      setIsQuizCompletedLocal(value);
    } catch {
      // Handle potential localStorage access errors
    }
  }, [storageKey]);

  return {
    isQuizCompletedLocal,
    markQuizCompleted: () => setQuizCompleted(true),
    setIsQuizCompletedLocal: setQuizCompleted,
  };
}
