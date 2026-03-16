import { motion } from "motion/react";
import { PreferencesEditor } from "@/features/profile/PreferencesEditor";
import type { User } from "@/entities/user/model";

interface FiltersTabProps {
  profile: User;
  mobileTabBar: React.ReactNode;
}

export function FiltersTab({ profile, mobileTabBar }: FiltersTabProps) {
  return (
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
  );
}
