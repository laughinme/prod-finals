import { useTranslation } from "react-i18next";
import { Calendar, Info, MapPin, ShieldAlert } from "lucide-react";

import type { MatchProfile } from "../model";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { ScoreBreakdownPopover } from "./ScoreBreakdownPopover";

interface MatchProfileDesktopCardProps {
  profile: MatchProfile;
  onOpenReport: () => void;
}

export function MatchProfileDesktopCard({
  profile,
  onOpenReport,
}: MatchProfileDesktopCardProps) {
  const { t } = useTranslation();
  const title = profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;
  const hasMeta = Boolean(profile.location || profile.activity);

  return (
    <Card className="relative flex flex-col overflow-hidden rounded-4xl border-border bg-card p-0 shadow-2xl shadow-primary/5 md:flex-row">
      {/* Top Left Badge */}
      <div className="absolute top-6 left-6 z-20 hidden items-center gap-2 md:flex">
        <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
          <div className="rounded-xl border border-primary/20 bg-black/90 px-3 py-1 text-lg font-black text-primary shadow-xl backdrop-blur-md transition-opacity hover:opacity-80">
            {profile.matchScore}%
          </div>
        </ScoreBreakdownPopover>
      </div>

      <div className="relative h-[50vh] w-full shrink-0 md:h-[70vh] md:w-[45%]">
        {profile.image ? (
          <img
            src={profile.image}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent md:hidden" />

        {/* Mobile top left badge */}
        <div className="absolute top-4 left-4 z-20 md:hidden">
          <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
            <div className="rounded-lg border border-primary/20 bg-black/90 px-2.5 py-1 text-base font-black text-primary shadow-lg backdrop-blur-md transition-opacity hover:opacity-80">
              {profile.matchScore}%
            </div>
          </ScoreBreakdownPopover>
        </div>

        <div className="absolute right-4 bottom-4 left-4 text-white md:hidden">
          <h2 className="text-3xl font-bold">{title}</h2>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col p-8 md:h-[70vh] md:w-[55%] md:overflow-y-auto md:px-12 md:pt-6 md:pb-12">
        <div className="mb-6 hidden items-start justify-between gap-6 md:flex">
          <div className="min-w-0 pt-15">
            <h2 className="mb-3 text-6xl font-black tracking-tight text-foreground">{title}</h2>
            {hasMeta ? (
              <div className="flex items-center gap-4 font-medium text-muted-foreground">
                {profile.location ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-5" />
                    {profile.location}
                  </span>
                ) : null}
                {profile.activity ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-5" />
                    {profile.activity}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            onClick={onOpenReport}
          >
            <ShieldAlert className="size-7.5 opacity-80" />
          </button>
        </div>

        {profile.bio && (
          <div className="mb-6">
            <p className="text-lg leading-relaxed text-foreground/80">
              {profile.bio}
            </p>
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="rounded-xl bg-secondary/50 px-4 py-2 text-sm font-semibold text-secondary-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="mt-auto mb-0 rounded-3xl border border-primary/10 bg-primary/5 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-2xl bg-primary/10 p-3 text-primary">
              <Info className="size-6" />
            </div>
            <div>
              <h4 className="mb-2 text-lg font-semibold">{t("discovery.why_matched")}</h4>
              <p className="leading-relaxed text-muted-foreground">
                {profile.explanation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
