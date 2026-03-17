import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  Ban,
  Bot,
  ChartColumn,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  MessageSquareWarning,
  MessageCircleMore,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  UserRoundX,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { useAdminDashboard } from "@/features/admin/useAdminDashboard";
import { useAdminRandomMixSettings } from "@/features/admin/useAdminRandomMixSettings";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  getAdminModerationReports,
  getAdminModerationSummary,
  reviewAdminReport,
  type ModerationReportStatusDto,
} from "@/shared/api/admin/moderation";

import ModerationPage from "./ModerationPage";
import {
  formatDayLabel,
  formatNumber as formatNumberLabel,
  formatPercent as formatPercentLabel,
} from "./utils";

type ReviewStatusFilter = ModerationReportStatusDto | "all";
type ReviewDecision = Exclude<ModerationReportStatusDto, "pending">;
type OverviewRow = {
  day: string;
  registrations: number;
  feedServed: number;
  matches: number;
  firstMessages: number;
  replies: number;
  safetyEvents: number;
};

const OVERVIEW_CHART_CONFIG = {
  registrations: { label: "Registrations", color: "#0ea5e9" },
  feedServed: { label: "Feed served", color: "#f59e0b" },
  matches: { label: "Matches", color: "#0f766e" },
  firstMessages: { label: "First messages", color: "#ec4899" },
  replies: { label: "Replies", color: "#8b5cf6" },
  safetyEvents: { label: "Safety events", color: "#ef4444" },
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-3xl">
          {icon}
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function MetricStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ConversionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatPercent(value)}</p>
    </div>
  );
}

function FlowCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SegmentTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    user_source: "dataset" | "cold_start" | null;
    decision_mode: "model" | "fallback" | "unknown" | null;
    counts: {
      feed_like: number;
      match_created: number;
      chat_first_message_sent: number;
      user_reported: number;
    };
    conversions: {
      first_message_rate_from_matches: number;
    };
  }>;
}) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.dashboard.table.segment")}</TableHead>
              <TableHead>{t("admin.dashboard.metrics.likes")}</TableHead>
              <TableHead>{t("admin.dashboard.metrics.matches")}</TableHead>
              <TableHead>{t("admin.dashboard.metrics.first_messages")}</TableHead>
              <TableHead>{t("admin.dashboard.metrics.reports")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.user_source ?? "all"}-${row.decision_mode ?? "all"}-${index}`}>
                <TableCell className="font-medium">
                  {row.user_source
                    ? t(`admin.dashboard.segment_labels.user_source.${row.user_source}`)
                    : row.decision_mode
                      ? t(`admin.dashboard.segment_labels.decision_mode.${row.decision_mode}`)
                      : t("admin.dashboard.segment_labels.all")}
                </TableCell>
                <TableCell>{row.counts.feed_like}</TableCell>
                <TableCell>{row.counts.match_created}</TableCell>
                <TableCell>{row.counts.chat_first_message_sent}</TableCell>
                <TableCell>
                  {row.counts.user_reported}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatPercent(row.conversions.first_message_rate_from_matches)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { t } = useTranslation();
  const randomMix = useAdminRandomMixSettings();
  const { userSummary, registrations, funnelSummary, funnelDaily, isError, isLoading } =
    useAdminDashboard();

  const dailyRows = useMemo<OverviewRow[]>(() => {
    const map = new Map<string, OverviewRow>();
    for (const item of registrations) {
      map.set(item.day, {
        day: item.day,
        registrations: item.count,
        feedServed: 0,
        matches: 0,
        firstMessages: 0,
        replies: 0,
        safetyEvents: 0,
      });
    }

    for (const item of funnelDaily) {
      const existing = map.get(item.day) ?? {
        day: item.day,
        registrations: 0,
        feedServed: 0,
        matches: 0,
        firstMessages: 0,
        replies: 0,
        safetyEvents: 0,
      };
      existing.feedServed += item.counts.feed_served;
      existing.matches += item.counts.match_created;
      existing.firstMessages += item.counts.chat_first_message_sent;
      existing.replies += item.counts.chat_first_reply_received;
      existing.safetyEvents += item.counts.user_blocked + item.counts.user_reported;
      map.set(item.day, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [funnelDaily, registrations]);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/60 bg-card/80">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!userSummary || !funnelSummary) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {t("admin.dashboard.overview_error_title")}
          </CardTitle>
          <CardDescription>{t("admin.dashboard.overview_error_description")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-slate-900 text-white">
          {t("admin.generated_at", {
            date: funnelSummary.generated_at
              ? new Intl.DateTimeFormat("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(funnelSummary.generated_at))
              : "—",
          })}
        </Badge>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricCard
          icon={Users}
          title={t("admin.total_users")}
          value={formatNumberLabel(userSummary.total_users)}
          hint={t("admin.onboarded_share", {
            value: formatPercentLabel(
              userSummary.total_users > 0
                ? userSummary.onboarded_users / userSummary.total_users
                : 0,
            ),
          })}
        />
        <OverviewMetricCard
          icon={Sparkles}
          title={t("admin.matches_created")}
          value={formatNumberLabel(funnelSummary.totals.match_created)}
          hint={t("admin.match_rate", {
            value: formatPercentLabel(funnelSummary.conversions.match_rate_from_likes),
          })}
        />
        <OverviewMetricCard
          icon={MessageCircleMore}
          title={t("admin.first_replies")}
          value={formatNumberLabel(funnelSummary.totals.chat_first_reply_received)}
          hint={t("admin.reply_rate", {
            value: formatPercentLabel(
              funnelSummary.conversions.first_reply_rate_from_first_messages,
            ),
          })}
        />
        <OverviewMetricCard
          icon={ShieldAlert}
          title={t("admin.safety_events")}
          value={formatNumberLabel(
            funnelSummary.totals.user_blocked + funnelSummary.totals.user_reported,
          )}
          hint={t("admin.negative_rate", {
            value: formatPercentLabel(
              funnelSummary.conversions.negative_outcome_rate_from_matches,
            ),
          })}
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.activity_timeline")}</CardTitle>
            <CardDescription>{t("admin.activity_timeline_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={OVERVIEW_CHART_CONFIG} className="h-80 w-full">
              <AreaChart data={dailyRows} margin={{ left: 8, right: 8, top: 12 }}>
                <defs>
                  <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-registrations)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-registrations)"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                  <linearGradient id="feedServedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDayLabel}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  stroke="var(--color-registrations)"
                  fill="url(#registrationsFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="feedServed"
                  stroke="#f59e0b"
                  fill="url(#feedServedFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.quality_snapshot")}</CardTitle>
            <CardDescription>{t("admin.quality_snapshot_description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <QualityItem
              label={t("admin.like_rate_label")}
              value={formatPercentLabel(funnelSummary.conversions.like_rate)}
            />
            <QualityItem
              label={t("admin.message_after_match")}
              value={formatPercentLabel(funnelSummary.conversions.first_message_rate_from_matches)}
            />
            <QualityItem
              label={t("admin.reply_after_message")}
              value={formatPercentLabel(
                funnelSummary.conversions.first_reply_rate_from_first_messages,
              )}
            />
            <QualityItem
              label={t("admin.explanation_opens")}
              value={formatNumberLabel(funnelSummary.totals.feed_explanation_opened)}
            />
            <QualityItem
              label={t("admin.banned_users")}
              value={formatNumberLabel(userSummary.banned_users)}
            />
            <QualityItem
              label={t("admin.registered_last_24h")}
              value={formatNumberLabel(userSummary.registered_last_24h)}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.daily_funnel")}</CardTitle>
            <CardDescription>{t("admin.daily_funnel_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={OVERVIEW_CHART_CONFIG} className="h-80 w-full">
              <BarChart data={dailyRows} margin={{ left: 8, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDayLabel}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="matches"
                  fill="var(--color-matches)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="firstMessages"
                  fill="#ec4899"
                  radius={[8, 8, 0, 0]}
                />
                <Bar dataKey="replies" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="safetyEvents" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <OverviewSegmentCard
            title={t("admin.by_source")}
            description={t("admin.by_source_description")}
            items={funnelSummary.by_user_source}
          />
          <OverviewSegmentCard
            title={t("admin.by_decision_mode")}
            description={t("admin.by_decision_mode_description")}
            items={funnelSummary.by_decision_mode}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SegmentMatrixCard
          title={t("admin.segment_matrix")}
          description={t("admin.segment_matrix_description")}
          items={funnelSummary.by_segment}
        />
        <div className="grid gap-4">
          <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle>{t("admin.notes_title")}</CardTitle>
              <CardDescription>{t("admin.notes_description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <InsightRow
                icon={Bot}
                title={t("admin.insight_model_title")}
                text={t("admin.insight_model_text")}
              />
              <InsightRow
                icon={Activity}
                title={t("admin.insight_dataset_title")}
                text={t("admin.insight_dataset_text")}
              />
              <InsightRow
                icon={ChartColumn}
                title={t("admin.insight_funnel_title")}
                text={t("admin.insight_funnel_text")}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle>{t("admin.random_mix_title")}</CardTitle>
              <CardDescription>{t("admin.random_mix_description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.random_mix_current")}</span>
                <span className="font-semibold">{randomMix.draftPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={randomMix.draftPercent}
                onChange={(event) => randomMix.setDraftPercent(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-amber-500"
              />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t("admin.random_mix_hint_low")}</span>
                <span>{t("admin.random_mix_hint_high")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {randomMix.updatedAt
                    ? t("admin.random_mix_updated_at", {
                        date: new Intl.DateTimeFormat("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(randomMix.updatedAt)),
                      })
                    : t("admin.random_mix_not_set")}
                </div>
                <Button
                  size="sm"
                  onClick={() => void randomMix.save()}
                  disabled={
                    randomMix.isLoading || randomMix.isSaving || !randomMix.isDirty
                  }
                >
                  {randomMix.isSaving
                    ? t("admin.random_mix_saving")
                    : t("admin.random_mix_save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {isError ? (
        <Card className="rounded-[28px] border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>{t("admin.partial_data_title")}</CardTitle>
            <CardDescription>{t("admin.partial_data_description")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function OverviewMetricCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: typeof Users;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="rounded-3xl border-border/80 bg-card/95">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">{value}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QualityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function OverviewSegmentCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{
    user_source: string | null;
    decision_mode: string | null;
    counts: {
      feed_served: number;
      match_created: number;
      chat_first_reply_received: number;
    };
    conversions: { first_reply_rate_from_first_messages: number };
  }>;
}) {
  return (
    <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item, index) => {
          const label = item.user_source ?? item.decision_mode ?? `segment-${index}`;
          return (
            <div
              key={`${label}-${index}`}
              className="rounded-2xl border border-border/70 bg-background/90 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium capitalize">
                  {label.replaceAll("_", " ")}
                </span>
                <Badge variant="outline">
                  {formatPercentLabel(item.conversions.first_reply_rate_from_first_messages)}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumberLabel(item.counts.feed_served)}
                  </div>
                  <div>Feed</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumberLabel(item.counts.match_created)}
                  </div>
                  <div>Matches</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumberLabel(item.counts.chat_first_reply_received)}
                  </div>
                  <div>Replies</div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SegmentMatrixCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{
    user_source: string | null;
    decision_mode: string | null;
    counts: {
      match_created: number;
      chat_first_message_sent: number;
      user_blocked: number;
      user_reported: number;
    };
  }>;
}) {
  return (
    <Card className="rounded-[28px] border-border/60 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item, index) => (
          <div
            key={`${item.user_source}-${item.decision_mode}-${index}`}
            className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/90 px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">
                {(item.user_source ?? "unknown").replaceAll("_", " ")} x{" "}
                {(item.decision_mode ?? "unknown").replaceAll("_", " ")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatNumberLabel(item.counts.match_created)} matches /{" "}
                {formatNumberLabel(item.counts.chat_first_message_sent)} first messages
              </div>
            </div>
            <Badge variant="outline">
              {formatNumberLabel(item.counts.user_blocked + item.counts.user_reported)} safety
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InsightRow({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatusFilter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const summaryQuery = useQuery({
    queryKey: ["admin", "moderation", "summary"],
    queryFn: getAdminModerationSummary,
    staleTime: 30_000,
  });

  const reportsQuery = useQuery({
    queryKey: ["admin", "moderation", "reports", status],
    queryFn: () => getAdminModerationReports(status, 60),
    staleTime: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      reportId,
      decision,
      banUser,
    }: {
      reportId: string;
      decision: ReviewDecision;
      banUser: boolean;
    }) =>
      reviewAdminReport(reportId, {
        status: decision,
        ban_user: banUser,
        review_note: notes[reportId]?.trim() || undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        variables.banUser
          ? t("admin.reviews.review_ban_success")
          : variables.decision === "resolved"
            ? t("admin.reviews.review_resolve_success")
            : t("admin.reviews.review_dismiss_success"),
      );
    },
    onError: () => {
      toast.error(t("admin.reviews.review_error"));
    },
  });

  const reports = reportsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {t("admin.reviews.title")}
            </CardTitle>
            <CardDescription>{t("admin.reviews.subtitle")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={status}
              onValueChange={(value: ReviewStatusFilter) => setStatus(value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("admin.reviews.filter_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.reviews.filter_all")}</SelectItem>
                <SelectItem value="pending">{t("admin.reviews.filter_pending")}</SelectItem>
                <SelectItem value="resolved">{t("admin.reviews.filter_resolved")}</SelectItem>
                <SelectItem value="dismissed">{t("admin.reviews.filter_dismissed")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                summaryQuery.refetch();
                reportsQuery.refetch();
              }}
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  summaryQuery.isFetching || reportsQuery.isFetching ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<MessageSquareWarning className="h-5 w-5 text-primary" />}
          label={t("admin.reviews.summary.total")}
          value={summaryQuery.data?.total_reports ?? 0}
        />
        <MetricCard
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          label={t("admin.reviews.summary.pending")}
          value={summaryQuery.data?.pending_reports ?? 0}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label={t("admin.reviews.summary.resolved")}
          value={summaryQuery.data?.resolved_reports ?? 0}
        />
        <MetricCard
          icon={<Ban className="h-5 w-5 text-rose-600" />}
          label={t("admin.reviews.summary.banned_targets")}
          value={summaryQuery.data?.banned_targets ?? 0}
        />
      </div>

      <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t("admin.reviews.flow_title")}</CardTitle>
          <CardDescription>{t("admin.reviews.flow_description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <FlowCard
            title={t("admin.reviews.flow.reported_title")}
            description={t("admin.reviews.flow.reported_description")}
          />
          <FlowCard
            title={t("admin.reviews.flow.review_title")}
            description={t("admin.reviews.flow.review_description")}
          />
          <FlowCard
            title={t("admin.reviews.flow.action_title")}
            description={t("admin.reviews.flow.action_description")}
          />
        </CardContent>
      </Card>

      {reportsQuery.isPending ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border/60 bg-card/80">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reportsQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t("admin.reviews.error_title")}
            </CardTitle>
            <CardDescription>{t("admin.reviews.error_description")}</CardDescription>
          </CardHeader>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t("admin.reviews.empty_title")}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {t("admin.reviews.empty_description")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isPending = report.review_status === "pending";

            return (
              <Card
                key={report.id}
                className="rounded-3xl border-border/60 bg-card/90 shadow-sm"
              >
                <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isPending ? "secondary" : "outline"}>
                        {t(`admin.reviews.status.${report.review_status}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`admin.reviews.context.${report.source_context}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`admin.reviews.category.${report.category}`, {
                          defaultValue: report.category,
                        })}
                      </Badge>
                      {report.review_action === "banned" && (
                        <Badge variant="destructive">
                          {t("admin.reviews.action_banned")}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">
                        {report.actor.display_name} → {report.target.display_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.reviews.meta_line", {
                          createdAt: format(new Date(report.created_at), "dd.MM.yyyy HH:mm"),
                          actorEmail: report.actor.email,
                          targetEmail: report.target.email,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                    <p className="font-medium">{t("admin.reviews.reason_title")}</p>
                    <p className="mt-1 max-w-md text-muted-foreground">
                      {report.description || t("admin.reviews.no_description")}
                    </p>
                    {report.also_block && (
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-600">
                        {t("admin.reviews.also_block")}
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t("admin.reviews.note_label")}
                      </label>
                      <textarea
                        value={notes[report.id] ?? report.review_note ?? ""}
                        onChange={(event) =>
                          setNotes((prev) => ({
                            ...prev,
                            [report.id]: event.target.value,
                          }))
                        }
                        disabled={!isPending || reviewMutation.isPending}
                        placeholder={t("admin.reviews.note_placeholder")}
                        className="min-h-28 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <div className="flex min-w-[220px] flex-col gap-2">
                      <Button
                        disabled={!isPending || reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            reportId: report.id,
                            decision: "resolved",
                            banUser: true,
                          })
                        }
                        className="justify-start gap-2 rounded-2xl"
                      >
                        <Ban className="h-4 w-4" />
                        {t("admin.reviews.resolve_and_ban")}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!isPending || reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            reportId: report.id,
                            decision: "resolved",
                            banUser: false,
                          })
                        }
                        className="justify-start gap-2 rounded-2xl"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("admin.reviews.resolve_only")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!isPending || reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            reportId: report.id,
                            decision: "dismissed",
                            banUser: false,
                          })
                        }
                        className="justify-start gap-2 rounded-2xl"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        {t("admin.reviews.dismiss")}
                      </Button>
                    </div>
                  </div>

                  {!isPending && (
                    <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      {report.reviewer ? (
                        <p>
                          {t("admin.reviews.reviewed_by", {
                            reviewer: report.reviewer.display_name,
                            reviewedAt: report.reviewed_at
                              ? format(new Date(report.reviewed_at), "dd.MM.yyyy HH:mm")
                              : "—",
                          })}
                        </p>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <Badge
          variant="outline"
          className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]"
        >
          {t("admin.dashboard.badge")}
        </Badge>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.dashboard.title")}</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            {t("admin.dashboard.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/60 p-1 lg:w-fit">
          <TabsTrigger value="overview" className="rounded-xl px-5">
            {t("admin.dashboard.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-xl px-5">
            {t("admin.dashboard.tabs.reviews")}
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl px-5">
            {t("admin.dashboard.tabs.users")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="reviews" className="space-y-6">
          <ReviewsTab />
        </TabsContent>
        <TabsContent value="users" className="space-y-6">
          <ModerationPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
