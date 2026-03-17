import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  MessageSquareWarning,
  RefreshCcw,
  ShieldAlert,
  UserRoundX,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { toast } from "sonner";

import { useAdminDashboard } from "@/features/admin/useAdminDashboard";
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

type ReviewStatusFilter = ModerationReportStatusDto | "all";
type ReviewDecision = Exclude<ModerationReportStatusDto, "pending">;

const OVERVIEW_CHART_CONFIG = {
  registrations: { label: "Registrations", color: "#0ea5e9" },
  matches: { label: "Matches", color: "#0f766e" },
  messages: { label: "First messages", color: "#2563eb" },
  reports: { label: "Reports", color: "#dc2626" },
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
  const { userSummary, registrations, funnelSummary, funnelDaily, isError, isLoading } =
    useAdminDashboard();

  const overviewRows = useMemo(
    () =>
      funnelDaily.map((row) => ({
        day: format(new Date(row.day), "dd.MM"),
        matches: row.counts.match_created,
        messages: row.counts.chat_first_message_sent,
        reports: row.counts.user_reported,
      })),
    [funnelDaily],
  );

  const registrationRows = useMemo(
    () =>
      registrations.map((row) => ({
        day: format(new Date(row.day), "dd.MM"),
        registrations: row.count,
      })),
    [registrations],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/60 bg-card/80">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !userSummary || !funnelSummary) {
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Users className="h-5 w-5 text-primary" />}
          label={t("admin.dashboard.cards.total_users")}
          value={userSummary.total_users}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label={t("admin.dashboard.cards.onboarded")}
          value={userSummary.onboarded_users}
        />
        <MetricCard
          icon={<UserRoundX className="h-5 w-5 text-amber-600" />}
          label={t("admin.dashboard.cards.banned")}
          value={userSummary.banned_users}
        />
        <MetricCard
          icon={<Flame className="h-5 w-5 text-rose-600" />}
          label={t("admin.dashboard.cards.last_24h")}
          value={userSummary.registered_last_24h}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.dashboard.registrations_title")}</CardTitle>
            <CardDescription>{t("admin.dashboard.registrations_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={OVERVIEW_CHART_CONFIG} className="h-[260px] w-full">
              <LineChart data={registrationRows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="registrations"
                  type="monotone"
                  stroke="var(--color-registrations)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.dashboard.funnel_title")}</CardTitle>
            <CardDescription>{t("admin.dashboard.funnel_description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricStat
              label={t("admin.dashboard.metrics.feed_served")}
              value={funnelSummary.totals.feed_served}
            />
            <MetricStat
              label={t("admin.dashboard.metrics.likes")}
              value={funnelSummary.totals.feed_like}
            />
            <MetricStat
              label={t("admin.dashboard.metrics.matches")}
              value={funnelSummary.totals.match_created}
            />
            <MetricStat
              label={t("admin.dashboard.metrics.first_messages")}
              value={funnelSummary.totals.chat_first_message_sent}
            />
            <MetricStat
              label={t("admin.dashboard.metrics.first_replies")}
              value={funnelSummary.totals.chat_first_reply_received}
            />
            <MetricStat
              label={t("admin.dashboard.metrics.reports")}
              value={funnelSummary.totals.user_reported}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.dashboard.daily_outcomes_title")}</CardTitle>
            <CardDescription>{t("admin.dashboard.daily_outcomes_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={OVERVIEW_CHART_CONFIG} className="h-[280px] w-full">
              <BarChart data={overviewRows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="matches" fill="var(--color-matches)" radius={8} />
                <Bar dataKey="messages" fill="var(--color-messages)" radius={8} />
                <Bar dataKey="reports" fill="var(--color-reports)" radius={8} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t("admin.dashboard.conversions_title")}</CardTitle>
            <CardDescription>{t("admin.dashboard.conversions_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ConversionStat
              label={t("admin.dashboard.conversions.like_rate")}
              value={funnelSummary.conversions.like_rate}
            />
            <ConversionStat
              label={t("admin.dashboard.conversions.match_rate")}
              value={funnelSummary.conversions.match_rate_from_likes}
            />
            <ConversionStat
              label={t("admin.dashboard.conversions.first_message_rate")}
              value={funnelSummary.conversions.first_message_rate_from_matches}
            />
            <ConversionStat
              label={t("admin.dashboard.conversions.first_reply_rate")}
              value={funnelSummary.conversions.first_reply_rate_from_first_messages}
            />
            <ConversionStat
              label={t("admin.dashboard.conversions.negative_rate")}
              value={funnelSummary.conversions.negative_outcome_rate_from_matches}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SegmentTable
          title={t("admin.dashboard.segments.user_source_title")}
          rows={funnelSummary.by_user_source}
        />
        <SegmentTable
          title={t("admin.dashboard.segments.decision_mode_title")}
          rows={funnelSummary.by_decision_mode}
        />
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
