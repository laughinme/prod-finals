import { useTranslation } from "react-i18next";
import { Calendar, Heart, Info, MapPin, ShieldAlert, X } from "lucide-react";

import type { MatchProfile } from "../model";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";

interface MatchProfileDesktopCardProps {
  profile: MatchProfile;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
}

export function MatchProfileDesktopCard({
  profile,
  onLike,
  onPass,
  onOpenReport,
}: MatchProfileDesktopCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-4xl border-border bg-card py-0 shadow-xl md:flex-row">
      <div className="relative h-[50vh] w-full md:h-[70vh] md:w-1/2">
        <img
          src={profile.image}
          alt={profile.name}
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent md:hidden" />
        <div className="absolute right-4 bottom-4 left-4 text-white md:hidden">
          <h2 className="text-3xl font-bold">
            {profile.name}, {profile.age}
          </h2>
        </div>
      </div>

      <div className="flex w-full flex-col p-8 md:w-1/2 md:p-12">
        <div className="mb-6 hidden items-start justify-between md:flex">
          <div>
            <h2 className="mb-2 text-4xl font-bold">
              {profile.name}, {profile.age}
            </h2>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {profile.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {profile.activity}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <button
              className="mb-2 text-muted-foreground transition-colors hover:text-destructive"
              onClick={onOpenReport}
            >
              <ShieldAlert className="size-5" />
            </button>
            <div className="rounded-xl bg-primary/20 px-3 py-1.5 text-lg font-bold text-primary-foreground">
              {profile.matchScore}%
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-secondary px-3 py-1 text-sm text-secondary-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="mb-auto rounded-2xl border border-primary/10 bg-primary/5 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-primary p-3">
              <Info className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h4 className="mb-2 text-lg font-semibold">{t("discovery.why_matched")}</h4>
              <p className="leading-relaxed text-muted-foreground">
                {profile.explanation}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 border-t border-border pt-8">
          <Button
            variant="outline"
            size="icon"
            className="size-20 rounded-full border-2 border-border hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onPass}
          >
            <X className="size-10" />
          </Button>
          <Button
            size="icon"
            className="size-20 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
            onClick={onLike}
          >
            <Heart className="size-10 fill-current" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
