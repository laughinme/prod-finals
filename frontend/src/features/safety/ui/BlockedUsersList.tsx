import { motion } from "motion/react";
import { Loader2, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProfileImageFallback } from "@/shared/components/ui/profile-image-fallback";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/date";
import { useBlockedUsers } from "../model/useBlockedUsers";
import { useUnblockUser } from "../model/useUnblockUser";

interface BlockedUsersListProps {
  mobileTabBar: React.ReactNode;
}

export function BlockedUsersList({ mobileTabBar }: BlockedUsersListProps) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useBlockedUsers();
  const unblockMutation = useUnblockUser();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {mobileTabBar}
      <div className="mt-4 space-y-4 md:mt-0 md:pt-16">
        <section className="space-y-2 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase">
            {t("profile.blocked_title")}
          </p>
          <h3 className="text-xl font-bold">{t("profile.blocked_subtitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("profile.blocked_description")}
          </p>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-3xl border border-border/60 bg-card/90 p-10">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {t("profile.blocked_load_error")}
          </div>
        ) : null}

        {!isLoading && !isError && (data?.items.length ?? 0) === 0 ? (
          <div className="rounded-3xl border border-border/60 bg-card/90 p-8 text-center text-sm text-muted-foreground">
            {t("profile.blocked_empty")}
          </div>
        ) : null}

        {!isLoading && !isError && (data?.items.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {data?.items.map((item) => (
              <div
                key={item.blockId}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 p-4"
              >
                <ProfileImageFallback
                  src={item.avatarUrl}
                  alt={item.displayName}
                  containerClassName="size-12 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {item.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("profile.blocked_on", {
                      date: formatDate(item.blockedAt, i18n.language),
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unblockMutation.isPending}
                  onClick={() => unblockMutation.mutate(item.targetUserId)}
                >
                  {unblockMutation.isPending &&
                  unblockMutation.variables === item.targetUserId ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ShieldOff className="mr-2 size-4" />
                  )}
                  {t("profile.unblock_action")}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
