import { getAllUsersAdmin } from "@/shared/api/admin/get-users";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useModerationUsers(filter: { banned: boolean | null }) {
  console.log("useModerationUsers: calling useInfiniteQuery", filter);
  const result = useInfiniteQuery({
    queryKey: ["admin-users", filter],
    queryFn: async ({ pageParam }) => {
      const response = await getAllUsersAdmin({
        banned: filter.banned,
        limit: 12,
        cursor: pageParam,
      });
      return response;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.items || lastPage.items.length === 0) return undefined;
      return lastPage.items[lastPage.items.length - 1].id;
    },
  });
  return result;
}
