import { useState, useCallback } from "react";

const QUIZ_COMPLETED_KEY = "quiz_completed";

export function useQuizCompletion() {
  const [isQuizCompletedLocal, setIsQuizCompletedLocal] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(QUIZ_COMPLETED_KEY) === "true";
      } catch {
        return false;
      }
    },
  );

  const markQuizCompleted = useCallback(() => {
    try {
      localStorage.setItem(QUIZ_COMPLETED_KEY, "true");
      setIsQuizCompletedLocal(true);
    } catch {
      // Handle potential localStorage access errors (e.g. in incognito)
    }
  }, []);

  return {
    isQuizCompletedLocal,
    markQuizCompleted,
  };
}
