import { banUser } from "@/shared/api/admin/ban-user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function useBanUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      userId,
      isBanned,
    }: {
      userId: string;
      isBanned: boolean;
    }) => {
      return await banUser(userId, isBanned);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        variables.isBanned
          ? t("admin.moderation_page.ban_success")
          : t("admin.moderation_page.unban_success"),
      );
    },
    onError: () => {
      toast.error(t("admin.moderation_page.update_error"));
    },
  });
}
