import type { MatchProfile } from "@/entities/match-profile/model";
import { DiscoveryDesktopProfileCard } from "./DiscoveryDesktopProfileCard";
import { DiscoveryMobileProfileCard } from "./DiscoveryMobileProfileCard";

export type DiscoveryProfileCardProps = {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
};

export type DiscoveryProfileCardViewProps = Omit<
  DiscoveryProfileCardProps,
  "isMobile"
>;

export function DiscoveryProfileCard(props: DiscoveryProfileCardProps) {
  if (props.isMobile) {
    return (
      <DiscoveryMobileProfileCard
        profile={props.profile}
        onLike={props.onLike}
        onPass={props.onPass}
        onOpenReport={props.onOpenReport}
      />
    );
  }

  return (
    <DiscoveryDesktopProfileCard
      profile={props.profile}
      onLike={props.onLike}
      onPass={props.onPass}
      onOpenReport={props.onOpenReport}
    />
  );
}
