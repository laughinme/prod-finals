import { useQueries } from "@tanstack/react-query";

import {
  getAdminFunnelDaily,
  getAdminFunnelSummary,
  getAdminRegistrations,
  getAdminUserSummary,
} from "@/shared/api/admin";

const ADMIN_DASHBOARD_DAYS = 30;

export function useAdminDashboard() {
  const results = useQueries({
    queries: [
      {
        queryKey: ["admin", "summary"],
        queryFn: getAdminUserSummary,
        staleTime: 1000 * 60,
      },
      {
        queryKey: ["admin", "registrations", ADMIN_DASHBOARD_DAYS],
        queryFn: () => getAdminRegistrations(ADMIN_DASHBOARD_DAYS),
        staleTime: 1000 * 60,
      },
      {
        queryKey: ["admin", "funnel", "summary"],
        queryFn: getAdminFunnelSummary,
        staleTime: 1000 * 30,
      },
      {
        queryKey: ["admin", "funnel", "daily", ADMIN_DASHBOARD_DAYS],
        queryFn: () => getAdminFunnelDaily(ADMIN_DASHBOARD_DAYS),
        staleTime: 1000 * 30,
      },
    ],
  });

  const [userSummary, registrations, funnelSummary, funnelDaily] = results;

  return {
    userSummary: userSummary.data ?? null,
    registrations: registrations.data ?? [],
    funnelSummary: funnelSummary.data ?? null,
    funnelDaily: funnelDaily.data ?? [],
    isLoading: results.some((item) => item.isPending),
    isError: results.some((item) => item.isError),
  };
}
