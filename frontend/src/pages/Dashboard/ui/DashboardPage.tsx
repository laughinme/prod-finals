import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Ban,
  Bot,
  ChartColumn,
  MessageCircleMore,
  ShieldAlert,
  Sparkles,
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
import { useAdminDashboard } from "@/features/admin/useAdminDashboard";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useProfile } from "@/features/profile";
import { formatPercent, formatNumber, formatDayLabel } from "./utils";

type OverviewRow = {
  day: string;
  registrations: number;
  feedServed: number;
  matches: number;
  firstMessages: number;
  replies: number;
  safetyEvents: number;
};

const overviewChartConfig = {
  registrations: { label: "Registrations", color: "var(--chart-1, #2563eb)" },
  feedServed: { label: "Feed served", color: "var(--chart-2, #f59e0b)" },
  matches: { label: "Matches", color: "var(--chart-3, #14b8a6)" },
  firstMessages: { label: "First messages", color: "var(--chart-4, #ec4899)" },
  replies: { label: "Replies", color: "var(--chart-5, #8b5cf6)" },
  safetyEvents: { label: "Safety events", color: "#ef4444" },
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const {
    userSummary,
    registrations,
    funnelSummary,
    funnelDaily,
    isLoading,
    isError,
  } = useAdminDashboard();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = profile?.roles.includes("admin") ?? false;
  const tab = location.pathname.endsWith("/moderation")
    ? "moderation"
    : "overview";

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
      existing.safetyEvents +=
        item.counts.user_blocked + item.counts.user_reported;
      map.set(item.day, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [funnelDaily, registrations]);

  if (isProfileLoading || isLoading) {
    return (
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 lg:px-6">
        <div className="grid gap-4">
          <Skeleton className="h-28 rounded-3xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <Skeleton className="h-90 rounded-3xl" />
            <Skeleton className="h-90 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/discovery" replace />;
  }

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 lg:px-6">
      <div className="grid gap-6">
        <section className="relative overflow-hidden rounded-4xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,250,249,0.92))] p-6 shadow-sm">
          <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle,rgba(14,165,233,0.12),transparent_60%)] lg:block" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300/60 bg-white/80 text-amber-700"
              >
                Admin analytics
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {t("admin.dashboard_title")}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t("admin.dashboard_description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-slate-900 text-white">
                {t("admin.generated_at", {
                  date: funnelSummary?.generated_at
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
          </div>
        </section>

        <Tabs
          value={tab}
          onValueChange={(value) =>
            navigate(
              value === "moderation" ? "/dashboard/moderation" : "/dashboard",
            )
          }
          className="gap-6"
        >
          <TabsList
            variant="line"
            className="w-full justify-start border-b border-border pb-3"
          >
            <TabsTrigger value="overview">
              {t("admin.overview_tab")}
            </TabsTrigger>
            <TabsTrigger value="moderation">
              {t("admin.moderation_tab")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "moderation" ? (
          <Card className="rounded-[28px] border-dashed bg-muted/25">
            <CardHeader>
              <CardTitle>{t("admin.moderation_title")}</CardTitle>
              <CardDescription>
                {t("admin.moderation_description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-border bg-background/80 p-6 text-sm text-muted-foreground">
                {t("admin.moderation_placeholder")}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Users}
                title={t("admin.total_users")}
                value={formatNumber(userSummary?.total_users)}
                hint={t("admin.onboarded_share", {
                  value: formatPercent(
                    userSummary && userSummary.total_users > 0
                      ? userSummary.onboarded_users / userSummary.total_users
                      : 0,
                  ),
                })}
              />
              <MetricCard
                icon={Sparkles}
                title={t("admin.matches_created")}
                value={formatNumber(funnelSummary?.totals.match_created)}
                hint={t("admin.match_rate", {
                  value: formatPercent(
                    funnelSummary?.conversions.match_rate_from_likes,
                  ),
                })}
              />
              <MetricCard
                icon={MessageCircleMore}
                title={t("admin.first_replies")}
                value={formatNumber(
                  funnelSummary?.totals.chat_first_reply_received,
                )}
                hint={t("admin.reply_rate", {
                  value: formatPercent(
                    funnelSummary?.conversions
                      .first_reply_rate_from_first_messages,
                  ),
                })}
              />
              <MetricCard
                icon={ShieldAlert}
                title={t("admin.safety_events")}
                value={formatNumber(
                  (funnelSummary?.totals.user_blocked ?? 0) +
                    (funnelSummary?.totals.user_reported ?? 0),
                )}
                hint={t("admin.negative_rate", {
                  value: formatPercent(
                    funnelSummary?.conversions
                      .negative_outcome_rate_from_matches,
                  ),
                })}
              />
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
              <Card className="rounded-[28px]">
                <CardHeader>
                  <CardTitle>{t("admin.activity_timeline")}</CardTitle>
                  <CardDescription>
                    {t("admin.activity_timeline_description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={overviewChartConfig}
                    className="h-80 w-full"
                  >
                    <AreaChart
                      data={dailyRows}
                      margin={{ left: 8, right: 8, top: 12 }}
                    >
                      <defs>
                        <linearGradient
                          id="registrationsFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
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
                        <linearGradient
                          id="feedServedFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--color-feedServed)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-feedServed)"
                            stopOpacity={0.03}
                          />
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
                        stroke="var(--color-feedServed)"
                        fill="url(#feedServedFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="rounded-[28px]">
                <CardHeader>
                  <CardTitle>{t("admin.quality_snapshot")}</CardTitle>
                  <CardDescription>
                    {t("admin.quality_snapshot_description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <QualityItem
                    label={t("admin.like_rate_label")}
                    value={formatPercent(funnelSummary?.conversions.like_rate)}
                  />
                  <QualityItem
                    label={t("admin.message_after_match")}
                    value={formatPercent(
                      funnelSummary?.conversions
                        .first_message_rate_from_matches,
                    )}
                  />
                  <QualityItem
                    label={t("admin.reply_after_message")}
                    value={formatPercent(
                      funnelSummary?.conversions
                        .first_reply_rate_from_first_messages,
                    )}
                  />
                  <QualityItem
                    label={t("admin.explanation_opens")}
                    value={formatNumber(
                      funnelSummary?.totals.feed_explanation_opened,
                    )}
                  />
                  <QualityItem
                    label={t("admin.banned_users")}
                    value={formatNumber(userSummary?.banned_users)}
                  />
                  <QualityItem
                    label={t("admin.registered_last_24h")}
                    value={formatNumber(userSummary?.registered_last_24h)}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_1fr]">
              <Card className="rounded-[28px]">
                <CardHeader>
                  <CardTitle>{t("admin.daily_funnel")}</CardTitle>
                  <CardDescription>
                    {t("admin.daily_funnel_description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={overviewChartConfig}
                    className="h-80 w-full"
                  >
                    <BarChart
                      data={dailyRows}
                      margin={{ left: 8, right: 8, top: 12 }}
                    >
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
                        fill="var(--color-firstMessages)"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="replies"
                        fill="var(--color-replies)"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="safetyEvents"
                        fill="var(--color-safetyEvents)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <SegmentCard
                  title={t("admin.by_source")}
                  description={t("admin.by_source_description")}
                  items={funnelSummary?.by_user_source ?? []}
                />
                <SegmentCard
                  title={t("admin.by_decision_mode")}
                  description={t("admin.by_decision_mode_description")}
                  items={funnelSummary?.by_decision_mode ?? []}
                />
              </div>
            </section>

            {isError ? (
              <Card className="rounded-[28px] border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle>{t("admin.partial_data_title")}</CardTitle>
                  <CardDescription>
                    {t("admin.partial_data_description")}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
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
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">
            {value}
          </CardTitle>
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

function SegmentCard({
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
    <Card className="rounded-[28px]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item, index) => {
          const label =
            item.user_source ?? item.decision_mode ?? `segment-${index}`;
          return (
            <div
              key={`${label}-${index}`}
              className="rounded-2xl border border-border/70 bg-background/90 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium capitalize">
                  {label.replace("_", " ")}
                </span>
                <Badge variant="outline">
                  {formatPercent(
                    item.conversions.first_reply_rate_from_first_messages,
                  )}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumber(item.counts.feed_served)}
                  </div>
                  <div>Feed</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumber(item.counts.match_created)}
                  </div>
                  <div>Matches</div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {formatNumber(item.counts.chat_first_reply_received)}
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
    <Card className="rounded-[28px]">
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
                {(item.user_source ?? "unknown").replace("_", " ")} x{" "}
                {(item.decision_mode ?? "unknown").replace("_", " ")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatNumber(item.counts.match_created)} matches /{" "}
                {formatNumber(item.counts.chat_first_message_sent)} first
                messages
              </div>
            </div>
            <Badge variant="outline">
              {formatNumber(
                item.counts.user_blocked + item.counts.user_reported,
              )}{" "}
              safety
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
