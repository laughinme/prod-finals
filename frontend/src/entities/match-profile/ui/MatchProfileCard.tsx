import type { MatchProfile } from "../model";
import { MatchProfileDesktopCard } from "./MatchProfileDesktopCard";
import { MatchProfileMobileCard } from "./MatchProfileMobileCard";

export interface MatchProfileCardProps {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
  onPrepareTestMatch?: () => void;
  isPreparingTestMatch?: boolean;
  showMatchScore?: boolean;
  showReportButton?: boolean;
  showActions?: boolean;
}

export function MatchProfileCard({
  profile,
  isMobile,
  onLike,
  onPass,
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
  showMatchScore = true,
  showReportButton = true,
  showActions = true,
}: MatchProfileCardProps) {
  if (isMobile) {
    return (
      <MatchProfileMobileCard
        profile={profile}
        onLike={onLike}
        onPass={onPass}
        onOpenReport={onOpenReport}
        onPrepareTestMatch={onPrepareTestMatch}
        isPreparingTestMatch={isPreparingTestMatch}
        showMatchScore={showMatchScore}
        showReportButton={showReportButton}
        showActions={showActions}
      />
    );
  }

  return (
    <MatchProfileDesktopCard
      profile={profile}
      onOpenReport={onOpenReport}
      onPrepareTestMatch={onPrepareTestMatch}
      isPreparingTestMatch={isPreparingTestMatch}
      showMatchScore={showMatchScore}
      showReportButton={showReportButton}
    />
  );
}
