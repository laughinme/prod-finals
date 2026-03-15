import type { MatchProfile } from "../model";
import { MatchProfileDesktopCard } from "./MatchProfileDesktopCard";
import { MatchProfileMobileCard } from "./MatchProfileMobileCard";

export interface MatchProfileCardProps {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
}

export function MatchProfileCard({
  profile,
  isMobile,
  onLike,
  onPass,
  onOpenReport,
}: MatchProfileCardProps) {
  if (isMobile) {
    return (
      <MatchProfileMobileCard
        profile={profile}
        onLike={onLike}
        onPass={onPass}
        onOpenReport={onOpenReport}
      />
    );
  }

  return (
    <MatchProfileDesktopCard
      profile={profile}
      onOpenReport={onOpenReport}
    />
  );
}
