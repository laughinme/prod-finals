import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";

import { useAuth } from "@/entities/auth";
import { useProfile, PreferencesEditor } from "@/features/profile";
import { BlockedUsersList } from "@/features/safety";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  ProfileNavigation,
  type ProfileTab,
} from "@/widgets/ProfileNavigation";
import { ProfileBanner } from "@/widgets/ProfileBanner";
import { ProfileInfoCard } from "@/widgets/ProfileInfoCard";
import { ProfileSkeleton } from "@/widgets/ProfileInfoCard";

export default function ProfilePage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { data: profile, isLoading, isError } = useProfile();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

  const handleLogout = () => auth?.logout();

  const mobileTabBar = (
    <ProfileNavigation
      variant="mobile"
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    />
  );

  return (
    <div className="relative flex-1">
      <ProfileBanner />

      <main className="relative z-10 mx-auto flex-1 w-full max-w-5xl px-4 pb-20 pt-2 sm:pt-24 md:pb-12 md:pt-36 lg:px-6">
        {isLoading && <ProfileSkeleton />}

        {isError && (
          <div className="mx-auto mt-12 max-w-2xl rounded-xl border bg-card p-8 py-20 text-center text-muted-foreground">
            {t("profile.load_error")}
          </div>
        )}

        {profile && (
          <div className="flex gap-6">
            <div className="min-w-0 flex-1">
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

              {activeTab === "profile" && (
                <ProfileInfoCard
                  profile={profile}
                  isMobile={isMobile}
                  mobileTabBar={mobileTabBar}
                />
              )}

              {activeTab === "blocked" && (
                <BlockedUsersList mobileTabBar={mobileTabBar} />
              )}
            </div>

            <ProfileNavigation
              variant="desktop"
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onLogout={handleLogout}
            />
          </div>
        )}
      </main>
    </div>
  );
}
