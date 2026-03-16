import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getBlockedUsers } from "@/shared/api/safety";
import type { BlockedUsersResult } from "@/entities/safety";

export const BLOCKED_USERS_QUERY_KEY = ["safety", "blocked-users"] as const;

export function useBlockedUsers(): UseQueryResult<BlockedUsersResult> {
  return useQuery({
    queryKey: BLOCKED_USERS_QUERY_KEY,
    queryFn: getBlockedUsers,
  });
}
