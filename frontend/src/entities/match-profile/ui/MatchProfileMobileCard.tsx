import {
  Heart,
  MapPin,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MatchProfile } from "../model";

interface MatchProfileMobileCardProps {
  profile: MatchProfile;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
}

export function MatchProfileMobileCard({
  profile,
  onLike,
  onPass,
  onOpenReport,
}: MatchProfileMobileCardProps) {
  const { t } = useTranslation();
  const title = profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;

  return (
    <div className="mx-auto w-full max-w-100">
      <div className="relative aspect-4/7 overflow-hidden rounded-4xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.15)] sm:rounded-[40px]">
        {profile.image ? (
          <img
            src={profile.image}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : null}

        <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0A] via-[#0A0A0A]/55 to-transparent" />

        <div className="absolute top-5 right-5 left-5 flex items-start justify-between gap-3 sm:top-6 sm:right-6 sm:left-6">
          <div className="flex items-center gap-2 rounded-full bg-[#2A2A2A]/80 px-4 py-2 text-sm font-bold text-white backdrop-blur-md">
            <Sparkles className="size-4 text-primary" />
            {profile.matchScore}%
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenReport}
              className="flex size-10 items-center justify-center rounded-full bg-[#2A2A2A]/80 text-white backdrop-blur-md transition-colors hover:bg-[#383838]"
              aria-label={t("discovery.report_profile")}
            >
              <ShieldAlert className="size-5" />
            </button>
          </div>
        </div>

        <div className="absolute right-6 bottom-6 left-6 flex flex-col gap-5 sm:right-8 sm:bottom-8 sm:left-8">
          <div>
            <h2 className="mb-2 text-[32px] leading-tight font-extrabold tracking-tight text-white sm:text-[36px]">
              {title}
            </h2>

            {profile.location ? (
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300 sm:text-base">
                <MapPin className="size-5" />
                <span>{profile.location}</span>
              </div>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-gray-200 sm:text-base">
            {profile.explanation}
          </p>

          <div className="mt-2 flex gap-4">
            <button
              onClick={onPass}
              className="flex h-16 flex-1 items-center justify-center rounded-3xl bg-[#2A2A2A] text-white transition-colors hover:bg-[#333333]"
              aria-label={t("discovery.pass_profile")}
            >
              <X className="size-6" strokeWidth={2.5} />
            </button>

            <button
              onClick={onLike}
              className="flex h-16 flex-1 items-center justify-center rounded-3xl bg-primary text-black shadow-[0_0_40px_rgba(255,221,45,0.3)] transition-colors hover:bg-[#FFD100]"
              aria-label={t("discovery.like_profile")}
            >
              <Heart className="size-6 fill-current" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
