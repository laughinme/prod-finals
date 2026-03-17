import { getAllUsersAdmin } from "@/shared/api/admin/get-users";
import { useInfiniteQuery } from "@tanstack/react-query";

const MODERATION_USERS_PAGE_SIZE = 12;

export function useModerationUsers(filter: { banned: boolean | null }) {
  const query = useInfiniteQuery({
    queryKey: ["admin-users", filter.banned],
    queryFn: async ({ pageParam }) => {
      const response = await getAllUsersAdmin({
        banned: filter.banned,
        limit: MODERATION_USERS_PAGE_SIZE,
        cursor: pageParam ?? null,
      });
      return response;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const seenUserIds = new Set<string>();
  const users =
    query.data?.pages.flatMap((page) =>
      page.items.filter((user): user is NonNullable<typeof user> => {
        if (!user?.id || seenUserIds.has(user.id)) {
          return false;
        }

        seenUserIds.add(user.id);
        return true;
      }),
    ) ?? [];

  return {
    ...query,
    users,
  };
}
