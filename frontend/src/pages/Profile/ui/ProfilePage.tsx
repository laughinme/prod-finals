import { useState } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { IconCalendar, IconMail, IconShieldCheck, IconLogout } from "@tabler/icons-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { useAuth } from "@/app/providers/auth/useAuth";
import { useProfile } from "@/features/profile/useProfile";
import { ProfileAvatarUpload } from "@/features/profile/ProfileAvatarUpload";
import { ProfileEditForm } from "@/features/profile/ProfileEditForm";
import { PreferencesEditor } from "@/features/profile/PreferencesEditor";
import { MatchProfileCard } from "@/entities/match-profile/ui";
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

type ProfileTab = "profile" | "filters";

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { data: profile, isLoading, isError } = useProfile();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

  function getAge(birthDate: string | null | undefined): number | null {
    if (!birthDate) return null;

    const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;

    const now = new Date();
    let age = now.getUTCFullYear() - year;
    const currentMonth = now.getUTCMonth() + 1;
    const currentDay = now.getUTCDate();

    if (currentMonth < month || (currentMonth === month && currentDay < day)) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

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

  /* Desktop sidebar — hidden on mobile */
  const sidebarNav = (
    <nav className="mt-16 hidden w-40 shrink-0 flex-col gap-1 md:flex">
      <button
        type="button"
        onClick={() => setActiveTab("profile")}
        className={cn(
          "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          activeTab === "profile"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {t("profile.tab_profile")}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("filters")}
        className={cn(
          "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          activeTab === "filters"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {t("profile.tab_filters")}
      </button>

      <Separator className="my-2" />

      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground hover:text-destructive"
        onClick={() => auth?.logout()}
      >
        <IconLogout className="mr-2 size-4" />
        {t("common.logout")}
      </Button>
    </nav>
  );

  /* Mobile horizontal tab bar — hidden on desktop */
  const mobileTabBar = (
    <div className="flex items-center border-b border-border/40 md:hidden">
      <button
        type="button"
        onClick={() => setActiveTab("profile")}
        className={cn(
          "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
          activeTab === "profile"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        {t("profile.tab_profile")}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("filters")}
        className={cn(
          "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
          activeTab === "filters"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        {t("profile.tab_filters")}
      </button>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground hover:text-destructive"
        onClick={() => auth?.logout()}
      >
        <IconLogout className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="relative flex-1">
      {/* Banner — desktop only, hidden on filters tab */}
      <div className="absolute top-0 left-0 right-0 z-0 hidden border-b border-border/40 bg-linear-to-r from-neutral-200 to-neutral-300 sm:block sm:h-32 md:h-44 dark:from-neutral-800 dark:to-neutral-900" />

      <main className="relative z-10 mx-auto flex-1 w-full max-w-5xl px-4 pb-20 pt-2 sm:pt-24 md:pb-12 md:pt-36 lg:px-6">
        {isLoading && <ProfileSkeleton />}

        {isError && (
          <div className="mx-auto mt-12 max-w-2xl rounded-xl border bg-card p-8 py-20 text-center text-muted-foreground">
            {t("profile.load_error")}
          </div>
        )}

        {profile && (
          <div className="flex gap-6">
            {/* Main content area */}
            <div className="min-w-0 flex-1">
              {/* ===== FILTERS TAB ===== */}
              {activeTab === "filters" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {mobileTabBar}
                  <div className="mt-4 md:mt-0 md:pt-16">
                    <PreferencesEditor profile={profile} />
                  </div>
                </motion.div>
              )}

              {/* ===== PROFILE TAB ===== */}
              {activeTab === "profile" && (
                <>
                  <motion.div
                    className="flex flex-col gap-6 md:flex-row md:gap-8 lg:gap-12"
                    variants={container}
                    initial="hidden"
                    animate="show"
                  >
                    {/* Left column — avatar, info */}
                    <motion.div
                      variants={item}
                      className="flex w-full flex-col items-center gap-5 text-center md:w-1/3 md:items-start md:text-left"
                    >
                      <div className="sm:-mt-20">
                        <ProfileAvatarUpload
                          src={profile.profilePicUrl}
                          fullName={profile.fullName}
                          email={profile.email}
                        />
                      </div>

                      <div className="w-full space-y-1">
                        <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
                          {profile.fullName}
                        </h1>
                        <p className="truncate text-sm font-medium text-muted-foreground md:text-base">
                          {profile.email}
                        </p>
                      </div>

                      {/* Mobile tab bar — sits naturally in the flow */}
                      <div className="w-full md:hidden">{mobileTabBar}</div>

                      <Separator className="w-full" />

                      <div className="hidden w-full space-y-4 text-sm md:block">
                        <div className="flex items-center text-muted-foreground">
                          <IconMail className="mr-3 size-4 shrink-0" />
                          <span className="truncate">{profile.email}</span>
                        </div>

                        <div className="flex items-center text-muted-foreground">
                          <IconCalendar className="mr-3 size-4 shrink-0" />
                          <span>
                            {t("profile.online_since", {
                              date: formatDate(profile.createdAt),
                            })}
                          </span>
                        </div>

                        <div className="flex items-center text-muted-foreground">
                          <IconShieldCheck className="mr-3 size-4 shrink-0" />
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

                    {/* Right column — edit form */}
                    <motion.div
                      variants={item}
                      className="w-full -mt-4 md:mt-0 md:w-2/3 md:pt-8"
                    >
                      <ProfileEditForm profile={profile} />
                    </motion.div>
                  </motion.div>

                  {/* Card preview */}
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="relative left-1/2 mt-8 w-screen -translate-x-1/2 md:mt-12"
                  >
                    <div className="flex w-full flex-col items-center md:translate-x-20">
                      <h2 className="mb-4 text-center text-xl font-bold tracking-tight md:mb-6 md:text-2xl">
                        {t("profile.my_questionnaire")}
                      </h2>
                      <div className="w-[calc(100vw-2rem)] max-w-5xl md:w-[calc(100vw-4rem)]">
                        {(() => {
                          const previewProfile = {
                            id: profile.email,
                            candidateUserId: null,
                            name: profile.fullName,
                            age: getAge(profile.birthDate),
                            image: profile.profilePicUrl,
                            bio: profile.bio,
                            matchScore: 0,
                            categoryBreakdown: [],
                            tags: [],
                            explanation: "",
                            location: "",
                            reasonCodes: [],
                            detailsAvailable: false,
                            actions: null,
                            source: "feed",
                          } satisfies MatchProfile;

                          return (
                            <MatchProfileCard
                              profile={previewProfile}
                              isMobile={isMobile}
                              onLike={() => {}}
                              onPass={() => {}}
                              onOpenReport={() => {}}
                              showMatchScore={false}
                              showReportButton={false}
                              showActions={false}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>

            {/* Sidebar — always visible, no animation */}
            {sidebarNav}
          </div>
        )}
      </main>
    </div>
  );
}
