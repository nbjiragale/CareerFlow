import {
  getActivityCalendarData,
  getActivityDataForPeriod,
  getFunnelForUser,
  getJobsActivityForPeriod,
  getJobsAppliedForPeriod,
  getRecentActivities,
  getRecentJobs,
  getResponseRateForUser,
  getTopActivityTypesByDuration,
} from "@/actions/dashboard.actions";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import NumberCardToggle from "@/components/dashboard/NumberCardToggle";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import TopActivitiesCard from "@/components/dashboard/TopActivitiesCard";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";
// CAREERFLOW: Phase 3 (PR #9) — analytics tiles.
import ResponseRateTile from "@/components/dashboard/ResponseRateTile";
import FunnelTile from "@/components/dashboard/FunnelTile";
import AiSpendTile from "@/components/dashboard/AiSpendTile";
import { getUsageSummary } from "@/lib/ai/usage";
import { getCurrentUser } from "@/utils/user.utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Dashboard() {
  // CAREERFLOW: Phase 3 (PR #9) — resolve the user once to feed the analytics tiles.
  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? "";

  const [
    { count: jobsAppliedLast7Days, trend: trendFor7Days },
    { count: jobsAppliedLast30Days, trend: trendFor30Days },
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,
    topActivities7Days,
    topActivities30Days,
    funnel,
    responseRate,
    usage,
  ] = await Promise.all([
    getJobsAppliedForPeriod(7),
    getJobsAppliedForPeriod(30),
    getRecentJobs(),
    getRecentActivities(),
    getJobsActivityForPeriod(),
    getActivityDataForPeriod(),
    getActivityCalendarData(),
    getTopActivityTypesByDuration(7),
    getTopActivityTypesByDuration(30),
    getFunnelForUser(userId),
    getResponseRateForUser(userId),
    getUsageSummary(userId, 30),
  ]);
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
    <>
      <div className="grid auto-rows-max items-start gap-2 md:gap-2 lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
          <JobsApplied />
          <NumberCardToggle
            data={[
              {
                label: "7d",
                num: jobsAppliedLast7Days,
                trend: trendFor7Days,
              },
              {
                label: "30d",
                num: jobsAppliedLast30Days,
                trend: trendFor30Days,
              },
            ]}
          />
          <TopActivitiesCard
            data={[
              { label: "7d", activities: topActivities7Days },
              { label: "30d", activities: topActivities30Days },
            ]}
          />
        </div>
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
        {/* CAREERFLOW: Phase 3 (PR #9) — analytics tiles. */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ResponseRateTile data={responseRate} />
          <FunnelTile data={funnel} />
          <AiSpendTile totalUsd={usage.totals.costUsd} calls={usage.totals.calls} />
        </div>
      </div>
      <div>
        <RecentCardToggle jobs={recentJobs} activities={recentActivities} />
      </div>
      <div className="w-full col-span-3">
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
    </>
  );
}
