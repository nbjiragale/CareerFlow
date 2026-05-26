import { APP_CONSTANTS } from "@/lib/constants";
import prisma from "@/lib/db";
import { calculatePercentageDifference, getLast7Days } from "@/lib/utils";
import { getCurrentUser } from "@/utils/user.utils";
import { Prisma } from "@prisma/client";
import { format, parseISO, subDays } from "date-fns";

export const getJobsAppliedForPeriod = async (
  daysAgo: number,
): Promise<any | undefined> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const startDate1 = subDays(new Date(), daysAgo);
    const startDate2 = subDays(new Date(), daysAgo * 2);
    const endDate = new Date();
    const query = (date: Date): Prisma.JobCountArgs => ({
      where: {
        userId: user.id,
        applied: true,
        appliedDate: {
          gte: date,
          lt: endDate,
        },
      },
    });

    const [count, count2] = await prisma.$transaction([
      prisma.job.count(query(startDate1)),
      prisma.job.count(query(startDate2)),
    ]);
    const difference = Math.abs(count2 - count);
    const trend = calculatePercentageDifference(difference, count);
    return { count, trend };
  } catch (error) {
    const msg = "Failed to calculate job count";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getRecentJobs = async (): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Not authenticated");
    }
    const list = await prisma.job.findMany({
      where: {
        userId: user.id,
        applied: true,
      },
      include: {
        JobSource: true,
        JobTitle: true,
        Company: true,
        Status: true,
        Location: true,
      },
      orderBy: {
        appliedDate: "desc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES,
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getActivityDataForPeriod = async (): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Not authenticated");
    }
    const now = new Date();
    // Use local time for date range to match grouping and getLast7Days
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0,
    );
    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        endTime: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
      select: {
        endTime: true,
        duration: true,
        activityType: {
          select: {
            label: true,
          },
        },
      },
      orderBy: {
        endTime: "asc",
      },
    });
    const groupedData = activities.reduce((acc: any, activity: any) => {
      // Use local date for grouping to match user's perception
      const activityDate = new Date(activity.endTime);
      const day = format(activityDate, "yyyy-MM-dd");
      const activityTypeLabel = activity.activityType?.label || "Unknown";

      if (!acc[day]) {
        acc[day] = {};
      }

      const durationInHours = (activity.duration || 0) / 60;
      acc[day][activityTypeLabel] =
        (acc[day][activityTypeLabel] || 0) + durationInHours;

      return acc;
    }, {});
    const last7Days = getLast7Days("yyyy-MM-dd");
    const result = last7Days.map((dateStr) => ({
      day: format(parseISO(dateStr), "EEE, MMM d"),
      ...groupedData[dateStr],
    }));
    return result;
  } catch (error) {
    const msg = "Failed to fetch activities data.";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getJobsActivityForPeriod = async (): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Not authenticated");
    }
    const now = new Date();
    // Use local time for date range to match grouping and getLast7Days
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0,
    );
    const jobData = await prisma.job.groupBy({
      by: "appliedDate",
      _count: {
        _all: true,
      },
      where: {
        userId: user.id,
        applied: true,
        appliedDate: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
      orderBy: {
        appliedDate: "asc",
      },
    });
    // Reduce to a format that groups by unique date (YYYY-MM-DD) using local time
    const groupedPosts = jobData.reduce((acc: any, post: any) => {
      if (!post.appliedDate) return acc;
      const date = format(new Date(post.appliedDate), "yyyy-MM-dd");
      acc[date] = (acc[date] || 0) + post._count._all;
      return acc;
    }, {});
    // Get the last 7 days in local time
    const last7Days = getLast7Days("yyyy-MM-dd");
    // Map to ensure all dates are represented with a count of 0 if necessary
    const result = last7Days.map((dateStr) => ({
      day: format(parseISO(dateStr), "EEE, MMM d"),
      value: groupedPosts[dateStr] || 0,
    }));

    return result;
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export interface TopActivityType {
  label: string;
  hours: number;
}

export const getTopActivityTypesByDuration = async (
  daysAgo: number,
): Promise<TopActivityType[]> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  try {
    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysAgo + 1,
      0,
      0,
      0,
      0,
    );

    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        endTime: {
          gte: startDate,
          lte: today,
        },
      },
      select: {
        duration: true,
        activityType: {
          select: {
            label: true,
          },
        },
      },
    });

    const groupedByType = activities.reduce(
      (acc: Record<string, number>, activity) => {
        const label = activity.activityType?.label || "Unknown";
        const durationInHours = (activity.duration || 0) / 60;
        acc[label] = (acc[label] || 0) + durationInHours;
        return acc;
      },
      {},
    );

    const sorted = Object.entries(groupedByType)
      .map(([label, hours]) => ({ label, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 3);

    return sorted;
  } catch (error) {
    const msg = "Failed to fetch top activity types";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getRecentActivities = async () => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Not authenticated");
    }
    const list = await prisma.activity.findMany({
      where: {
        userId: user.id,
        endTime: { not: null },
      },
      include: {
        activityType: true,
      },
      orderBy: {
        endTime: "desc",
      },
      take: APP_CONSTANTS.RECENT_NUM_JOBS_ACTIVITIES,
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch recent activities.";
    console.error(msg, error);
    throw new Error(msg);
  }
};

export const getActivityCalendarData = async (): Promise<any | undefined> => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Not authenticated");
    }
    const now = new Date();
    // Use local time for date range to match grouping
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const daysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 365,
      0,
      0,
      0,
      0,
    );
    const jobData = await prisma.job.groupBy({
      by: "appliedDate",
      _count: {
        _all: true,
      },
      where: {
        userId: user.id,
        applied: true,
        appliedDate: {
          gte: daysAgo,
          lte: today,
        },
      },
      orderBy: {
        appliedDate: "asc",
      },
    });

    const activityData = await prisma.activity.findMany({
      where: {
        userId: user.id,
        startTime: { gte: daysAgo, lte: today },
        duration: { not: null },
      },
      select: { startTime: true, duration: true },
    });

    const groupedJobs: Record<string, number> = jobData.reduce(
      (acc: Record<string, number>, job: any) => {
        if (!job.appliedDate) return acc;
        const date = format(new Date(job.appliedDate), "yyyy-MM-dd");
        acc[date] = (acc[date] || 0) + job._count._all;
        return acc;
      },
      {},
    );

    const groupedHours: Record<string, number> = activityData.reduce(
      (acc: Record<string, number>, activity) => {
        const date = format(new Date(activity.startTime), "yyyy-MM-dd");
        acc[date] = (acc[date] || 0) + (activity.duration || 0) / 60;
        return acc;
      },
      {},
    );

    const allDates = new Set([
      ...Object.keys(groupedJobs),
      ...Object.keys(groupedHours),
    ]);

    const groupedByYear = [...allDates].reduce(
      (acc: Record<string, any[]>, date) => {
        const year = date.split("-")[0];
        if (!acc[year]) acc[year] = [];
        acc[year].push({
          day: date,
          value: groupedJobs[date] || 0,
          hours: Math.round((groupedHours[date] || 0) * 10) / 10,
        });
        return acc;
      },
      {},
    );

    return groupedByYear;
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    console.error(msg, error);
    throw new Error(msg);
  }
};

// CAREERFLOW: Phase 3 (PR #9) — analytics tiles.

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

const FUNNEL_STAGES: { stage: string; label: string }[] = [
  { stage: "applied", label: "Applied" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
];

// Snapshot funnel: how many of the user's jobs are currently in each stage,
// keyed off the authoritative Job.Status (not email classifications).
export const getFunnelForUser = async (
  userId: string,
): Promise<FunnelStage[]> => {
  const counts = await prisma.$transaction(
    FUNNEL_STAGES.map((s) =>
      prisma.job.count({ where: { userId, Status: { value: s.stage } } }),
    ),
  );
  return FUNNEL_STAGES.map((s, i) => ({ ...s, count: counts[i] ?? 0 }));
};

export interface ResponseRateWindow {
  windowDays: number;
  appliedCount: number;
  respondedCount: number;
  rate: number; // 0–100, percent of applied threads that got a response
}

const POSITIVE_LABELS = new Set(["Interview", "Offer", "NextPhase"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// Recruiter responsiveness: of the user's "Applied"-classified email threads,
// what share saw a positive reply (Interview/Offer/NextPhase) for the SAME job
// within N days. Threads not linked to a job are excluded.
export const getResponseRateForUser = async (
  userId: string,
  windows: number[] = [30, 60, 90],
): Promise<ResponseRateWindow[]> => {
  const threads = await prisma.emailThread.findMany({
    where: { userId, jobId: { not: null } },
    select: { jobId: true, label: true, receivedAt: true },
  });

  const byJob = new Map<string, { applied: number[]; positive: number[] }>();
  for (const t of threads) {
    if (!t.jobId) continue;
    const entry = byJob.get(t.jobId) ?? { applied: [], positive: [] };
    const ts = new Date(t.receivedAt).getTime();
    if (t.label === "Applied") entry.applied.push(ts);
    else if (POSITIVE_LABELS.has(t.label)) entry.positive.push(ts);
    byJob.set(t.jobId, entry);
  }

  return windows.map((windowDays) => {
    let appliedCount = 0;
    let respondedCount = 0;
    for (const { applied, positive } of byJob.values()) {
      for (const appliedAt of applied) {
        appliedCount++;
        const deadline = appliedAt + windowDays * DAY_MS;
        if (positive.some((p) => p >= appliedAt && p <= deadline)) {
          respondedCount++;
        }
      }
    }
    const rate =
      appliedCount === 0
        ? 0
        : Math.round((respondedCount / appliedCount) * 100);
    return { windowDays, appliedCount, respondedCount, rate };
  });
};

// CAREERFLOW: redesign — count of applications still in an active stage
// (anything not rejected/expired/archived). Powers the dashboard "Active" tile.
const INACTIVE_STAGES = ["rejected", "expired", "archived"];

export const getActiveApplicationsCount = async (
  userId: string,
): Promise<number> => {
  return prisma.job.count({
    where: { userId, Status: { value: { notIn: INACTIVE_STAGES } } },
  });
};

// CAREERFLOW: proactive follow-up nudge. Surfaces applications still in the
// "applied" stage that the user applied to FOLLOW_UP_AFTER_DAYS+ ago and hasn't
// followed up on recently (no follow-up draft in that window). Computed only —
// no LLM call here; the draft is generated on demand from the dashboard.
const FOLLOW_UP_AFTER_DAYS = 7;

export interface FollowUpDue {
  id: string;
  company: string;
  role: string;
  appliedDate: Date | null;
  daysSince: number;
}

export const getFollowUpsDue = async (
  userId: string,
): Promise<FollowUpDue[]> => {
  if (!userId) return [];
  const cutoff = subDays(new Date(), FOLLOW_UP_AFTER_DAYS);

  const jobs = await prisma.job.findMany({
    where: {
      userId,
      Status: { value: "applied" },
      OR: [
        { appliedDate: { lte: cutoff } },
        { appliedDate: null, createdAt: { lte: cutoff } },
      ],
      // Skip anything already nudged within the window so we don't nag.
      AiDraft: {
        none: { draftType: "follow-up", createdAt: { gte: cutoff } },
      },
    },
    select: {
      id: true,
      appliedDate: true,
      createdAt: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
    },
    orderBy: [{ appliedDate: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  const now = Date.now();
  return jobs.map((j) => {
    const ref = j.appliedDate ?? j.createdAt;
    return {
      id: j.id,
      company: j.Company?.label ?? "",
      role: j.JobTitle?.label ?? "Untitled role",
      appliedDate: j.appliedDate ?? null,
      daysSince: Math.floor((now - ref.getTime()) / (1000 * 60 * 60 * 24)),
    };
  });
};
