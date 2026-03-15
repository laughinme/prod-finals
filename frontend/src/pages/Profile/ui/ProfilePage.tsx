import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { IconCalendar, IconMail, IconShieldCheck } from "@tabler/icons-react";

import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { useProfile } from "@/features/profile/useProfile";
import { ProfileAvatarUpload } from "@/features/profile/ProfileAvatarUpload";
import { ProfileEditForm } from "@/features/profile/ProfileEditForm";
import { DiscoveryDesktopProfileCard } from "@/pages/Discovery/ui/DiscoveryDesktopProfileCard";
import { DiscoveryMobileProfileCard } from "@/pages/Discovery/ui/DiscoveryMobileProfileCard";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import type { MatchProfile } from "@/entities/match-profile/model";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
} as const;

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const { data: profile, isLoading, isError } = useProfile();

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      i18n.language === "ru" ? "ru-RU" : "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );
  }

  return (
    <div className="relative flex-1">
      <div className="absolute top-0 left-0 right-0 z-0 h-36 border-b border-border/40 bg-linear-to-r from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-900 sm:h-48 md:h-64"></div>

      <main className="relative z-10 mx-auto flex-1 w-full max-w-5xl px-4 pt-28 pb-8 sm:pt-40 md:pb-12 md:pt-56 lg:px-6">
        {isLoading && <ProfileSkeleton />}

        {isError && (
          <div className="mx-auto mt-12 max-w-2xl rounded-xl border bg-card p-8 py-20 text-center text-muted-foreground">
            {t("profile.load_error")}
          </div>
        )}

        {profile && (
          <motion.div
            className="flex flex-col gap-8 md:flex-row lg:gap-12"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <motion.div
              variants={item}
              className="flex w-full flex-col items-center gap-6 text-center md:w-1/3 md:items-start md:text-left"
            >
              <div className="-mt-12 sm:-mt-20">
                <ProfileAvatarUpload
                  src={profile.profilePicUrl}
                  username={profile.username}
                  email={profile.email}
                />
              </div>

              <div className="w-full space-y-1">
                <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">
                  {profile.username || profile.email}
                </h1>
                <p className="truncate text-base font-medium text-muted-foreground">
                  {profile.email}
                </p>
              </div>

              {profile.roles && profile.roles.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {profile.roles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      className="px-2.5 py-0.5 text-xs"
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator className="w-full" />

              <div className="w-full space-y-4 text-sm">
                <div className="flex items-center text-muted-foreground">
                  <IconMail className="mr-3 size-4" />
                  <span>{profile.email}</span>
                </div>

                <div className="flex items-center text-muted-foreground">
                  <IconCalendar className="mr-3 size-4" />
                  <span>
                    {t("profile.online_since", {
                      date: formatDate(profile.createdAt),
                    })}
                  </span>
                </div>

                <div className="flex items-center text-muted-foreground">
                  <IconShieldCheck className="mr-3 size-4" />
                  {profile.banned ? (
                    <Badge
                      variant="destructive"
                      className="h-5 rounded-sm px-1.5 text-[10px] font-semibold uppercase"
                    >
                      {t("profile.banned")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 rounded-sm border-foreground/20 px-1.5 text-[10px] font-semibold uppercase text-foreground/70"
                    >
                      {t("profile.active")}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="flex w-full flex-col pt-4 md:w-2/3 md:pt-8"
            >
              <ProfileEditForm profile={profile} />
            </motion.div>
          </motion.div>
        )}

        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-12"
          >
            <h2 className="mb-6 text-2xl font-bold tracking-tight">
              {t("profile.my_questionnaire")}
            </h2>
            {(() => {
              const previewProfile = {
                id: profile.email,
                candidateUserId: null,
                name: profile.username || profile.email,
                age: null,
                image: profile.profilePicUrl,
                bio: profile.bio,
                matchScore: 0,
                tags: [],
                explanation: "",
                location: "",
                activity: "",
                reasonCodes: [],
                detailsAvailable: false,
                actions: null,
                source: "feed",
              } satisfies MatchProfile;

              return isMobile ? (
                <DiscoveryMobileProfileCard
                  profile={previewProfile}
                  onLike={() => {}}
                  onPass={() => {}}
                  onOpenReport={() => {}}
                  showMatchScore={false}
                  showActions={false}
                  showReportButton={false}
                />
              ) : (
                <DiscoveryDesktopProfileCard
                  profile={previewProfile}
                  onLike={() => {}}
                  onPass={() => {}}
                  onOpenReport={() => {}}
                  showMatchScore={false}
                  showReportButton={false}
                />
              );
            })()}
          </motion.div>
        )}
      </main>
    </div>
  );
}
