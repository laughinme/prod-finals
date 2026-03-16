import { useQuery } from "@tanstack/react-query";

import { getOnboardingState } from "@/shared/api/onboarding";

export function useOnboardingState() {
  return useQuery({
    queryKey: ["onboarding", "state"],
    queryFn: getOnboardingState,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
