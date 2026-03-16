import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/entities/auth";
import { useProfile } from "@/features/profile";
import { useIsMobile } from "@/shared/hooks/use-mobile";

import { ProfileSkeleton } from "./components/ProfileSkeleton";
import {
  ProfileNavigation,
  type ProfileTab,
} from "./components/ProfileNavigation";
import { ProfileBanner } from "./components/ProfileBanner";
import { FiltersTab } from "./components/FiltersTab";
import { ProfileTabContent } from "./components/ProfileTabContent";

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
                <FiltersTab profile={profile} mobileTabBar={mobileTabBar} />
              )}

              {activeTab === "profile" && (
                <ProfileTabContent
                  profile={profile}
                  isMobile={isMobile}
                  mobileTabBar={mobileTabBar}
                />
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
