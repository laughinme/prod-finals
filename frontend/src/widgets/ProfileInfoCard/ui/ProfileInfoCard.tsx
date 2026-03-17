import { motion } from "motion/react";
import { ProfileEditForm } from "@/features/profile";
import type { User } from "@/entities/user/model";
import { ProfileInfo } from "./ProfileInfo";
import { ProfilePreview } from "./ProfilePreview";

interface ProfileInfoCardProps {
  profile: User;
  isMobile: boolean;
  mobileTabBar: React.ReactNode;
}

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

export function ProfileInfoCard({
  profile,
  isMobile,
  mobileTabBar,
}: ProfileInfoCardProps) {
  return (
    <>
      <motion.div
        className="flex flex-col gap-6 md:flex-row md:gap-8 lg:gap-12"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <ProfileInfo profile={profile} mobileTabBar={mobileTabBar} />
        <motion.div
          variants={item}
          className="w-full -mt-4 md:mt-0 md:w-2/3 md:pt-8"
        >
          <ProfileEditForm profile={profile} />
        </motion.div>
      </motion.div>

      <ProfilePreview profile={profile} isMobile={isMobile} />
    </>
  );
}
