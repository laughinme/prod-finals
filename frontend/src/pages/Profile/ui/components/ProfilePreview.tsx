import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { MatchProfileCard } from "@/entities/match-profile/ui";
import { getAge } from "@/shared/lib/date";
import type { User } from "@/entities/user/model";
import type { MatchProfile } from "@/entities/match-profile/model";

interface ProfilePreviewProps {
  profile: User;
  isMobile: boolean;
}

export function ProfilePreview({ profile, isMobile }: ProfilePreviewProps) {
  const { t } = useTranslation();
  const goalLabel = profile.goal
    ? t(`profile.goal_${profile.goal}`, {
        defaultValue: profile.goal,
      })
    : null;

  const previewProfile = {
    id: profile.email,
    candidateUserId: null,
    name: profile.fullName,
    age: getAge(profile.birthDate),
    image: profile.profilePicUrl,
    bio: profile.bio,
    matchScore: 0,
    categoryBreakdown: [],
    tags: [
      ...(goalLabel ? [goalLabel] : []),
      ...profile.interests.slice(0, 4),
    ],
    explanation: "",
    location: profile.city?.name ?? "",
    reasonCodes: [],
    detailsAvailable: false,
    actions: null,
    source: "feed",
  } satisfies MatchProfile;

  return (
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
        </div>
      </div>
    </motion.div>
  );
}
