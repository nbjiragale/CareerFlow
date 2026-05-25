import {
  getActiveApplicationsCount,
  getActivityCalendarData,
  getActivityDataForPeriod,
  getFunnelForUser,
  getJobsActivityForPeriod,
  getJobsAppliedForPeriod,
  getRecentActivities,
  getRecentJobs,
  getResponseRateForUser,
} from "@/actions/dashboard.actions";
import Link from "next/link";
import { format } from "date-fns";
import { Download, Sparkles } from "lucide-react";

import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";
// CAREERFLOW: Phase 3 (PR #9) — analytics tiles.
import ResponseRateTile from "@/components/dashboard/ResponseRateTile";
import FunnelTile from "@/components/dashboard/FunnelTile";
import AiSpendTile from "@/components/dashboard/AiSpendTile";
// CAREERFLOW: redesign — dashboard stat cards.
import StatCard from "@/components/design/StatCard";
import { getUsageSummary } from "@/lib/ai/usage";
import { getCurrentUser } from "@/utils/user.utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Dashboard() {
  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? "";
  const firstName = (currentUser?.name ?? "there").split(/\s+/)[0];

  const [
    { count: jobsAppliedLast30Days, trend: trendFor30Days },
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,
    funnel,
    responseRate,
    usage,
    activeCount,
  ] = await Promise.all([
    getJobsAppliedForPeriod(30),
    getRecentJobs(),
    getRecentActivities(),
    getJobsActivityForPeriod(),
    getActivityDataForPeriod(),
    getActivityCalendarData(),
    getFunnelForUser(userId),
    getResponseRateForUser(userId),
    getUsageSummary(userId, 30),
    getActiveApplicationsCount(userId),
  ]);

  const interviewCount = funnel.find((s) => s.stage === "interview")?.count ?? 0;
  const offerCount = funnel.find((s) => s.stage === "offer")?.count ?? 0;
  const rate30 = responseRate.find((r) => r.windowDays === 30)?.rate ?? 0;
  const appliedSeries = (weeklyData as { value: number }[]).map((d) => d.value);

  const activityCalendarDataKeys = Object.keys(activityCalendarData);
  const activitiesDataKeys = (data: string[]) =>
    Array.from(
      new Set(
        data.flatMap((entry) =>
          Object.keys(entry).filter((key) => key !== "day"),
        ),
      ),
    );

  return (
    <div className="col-span-3 mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      {/* greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {format(new Date(), "EEEE · MMM d")}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have{" "}
            <span className="font-medium text-foreground">{activeCount}</span>{" "}
            active application{activeCount === 1 ? "" : "s"}
            {offerCount > 0 ? (
              <>
                {" "}
                and{" "}
                <span className="font-medium text-foreground">
                  {offerCount} offer{offerCount === 1 ? "" : "s"}
                </span>{" "}
                in your pipeline.
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/jobs/export"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
          <Link
            href="/dashboard/evaluate"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" /> Evaluate a JD
          </Link>
        </div>
      </header>

      {/* stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={activeCount} />
        <StatCard
          label="Applied (30d)"
          value={jobsAppliedLast30Days}
          trend={trendFor30Days}
          trendLabel="vs 30d prior"
          series={appliedSeries}
        />
        <StatCard label="In interview" value={interviewCount} />
        <StatCard label="Response rate" value={`${rate30}%`} />
      </div>

      {/* weekly activity */}
      <WeeklyBarChartToggle
        charts={[
          {
            label: "Jobs",
            data: weeklyData,
            keys: ["value"],
            axisLeftLegend: "JOBS APPLIED",
          },
          {
            label: "Activities",
            data: activitiesData,
            keys: activitiesDataKeys(activitiesData),
            groupMode: "stacked",
            axisLeftLegend: "TIME SPENT (Hours)",
          },
        ]}
      />

      {/* analytics tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ResponseRateTile data={responseRate} />
        <FunnelTile data={funnel} />
        <AiSpendTile totalUsd={usage.totals.costUsd} calls={usage.totals.calls} />
      </div>

      {/* recent */}
      <RecentCardToggle jobs={recentJobs} activities={recentActivities} />

      {/* activity calendar */}
      <Tabs defaultValue={activityCalendarDataKeys.at(-1)}>
        <TabsList>
          {activityCalendarDataKeys.map((year) => (
            <TabsTrigger key={year} value={year}>
              {year}
            </TabsTrigger>
          ))}
        </TabsList>
        {activityCalendarDataKeys.map((year) => (
          <TabsContent key={year} value={year}>
            <ActivityCalendar year={year} data={activityCalendarData[year]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
