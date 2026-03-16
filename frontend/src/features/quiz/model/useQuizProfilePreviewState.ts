import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/app/providers/auth/useAuth";

export function useQuizProfilePreviewState() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userKey = auth?.user?.email || "anonymous";
  const storageKey = useMemo(
    () => `t-match:quiz-profile-preview:${userKey}`,
    [userKey],
  );
  const queryKey = useMemo(
    () => ["quiz", "profile-preview", userKey] as const,
    [userKey],
  );

  const readStoredValue = useCallback(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }, [storageKey]);

  const { data: isProfilePreviewPending = false } = useQuery({
    queryKey,
    queryFn: async () => readStoredValue(),
    initialData: readStoredValue,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    queryClient.setQueryData(queryKey, readStoredValue());
  }, [queryClient, queryKey, readStoredValue]);

  const setProfilePreviewPending = useCallback(
    (value: boolean) => {
      try {
        localStorage.setItem(storageKey, value ? "true" : "false");
      } catch {
        // Ignore localStorage access issues and still update in-memory state.
      }

      queryClient.setQueryData(queryKey, value);
    },
    [queryClient, queryKey, storageKey],
  );

  return {
    isProfilePreviewPending,
    markProfilePreviewPending: () => setProfilePreviewPending(true),
    clearProfilePreviewPending: () => setProfilePreviewPending(false),
  };
}
