import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { IconCalendar, IconMail, IconShieldCheck } from "@tabler/icons-react";

import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { ProfileAvatarUpload } from "@/features/profile";
import { formatDate } from "@/shared/lib/date";
import type { User } from "@/entities/user/model";

interface ProfileInfoProps {
  profile: User;
  mobileTabBar?: React.ReactNode;
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
} as const;

export function ProfileInfo({ profile, mobileTabBar }: ProfileInfoProps) {
  const { t, i18n } = useTranslation();

  return (
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
      </div>

      {mobileTabBar && <div className="w-full md:hidden">{mobileTabBar}</div>}

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
              date: formatDate(profile.createdAt, i18n.language),
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
  );
}
