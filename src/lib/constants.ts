import {
  LayoutDashboard,
  SquareCheckBig,
  BriefcaseBusiness,
  CalendarClock,
  UserRound,
  Sheet,
  Wrench,
  Zap,
  BookOpen,
  // CAREERFLOW: Phase 1 — Gmail tab icon.
  Mail,
  // CAREERFLOW: Phase 2 — JD evaluate tab icon.
  Sparkles,
} from "lucide-react";

export const APP_CONSTANTS = {
  RECORDS_PER_PAGE: 25,
  RECORDS_PER_PAGE_OPTIONS: [25, 50, 100],
  ACTIVITY_MAX_DURATION_MINUTES: 8 * 60, // 8 Hours
  ACTIVITY_MAX_DURATION_MS: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  RECENT_NUM_JOBS_ACTIVITIES: 7,
  AI_SLOW_RESPONSE_THRESHOLD_MS: 15_000, // 15 seconds
} as const;

export const SCHEDULER_CONSTANTS = {
  ENABLED: true,
  // CAREERFLOW: bumped from "0 * * * *" to "*/15 * * * *" for Phase 1
  // Gmail sync cadence. Automations still gate on nextRunAt, so a more
  // frequent tick is harmless for the JobSync side.
  CRON_EXPRESSION: "*/15 * * * *",
  // CAREERFLOW: Phase 3 — reminders need finer granularity than the 15-min
  // batch tick ("remind me in 1 hour"), so they run on their own 1-min cron.
  REMINDER_CRON_EXPRESSION: "* * * * *",
  // CAREERFLOW: Phase 3 — cap dispatch per tick so a backlog of overdue tasks
  // can't thrash the single-process server; spillover rolls to the next tick.
  MAX_REMINDERS_PER_TICK: 50,
} as const;

export const JOB_SOURCES = [
  { label: "Indeed", value: "indeed" },
  { label: "Linkedin", value: "linkedin" },
  { label: "Monster", value: "monster" },
  { label: "Glassdoor", value: "glassdoor" },
  { label: "Company Career page", value: "careerpage" },
  { label: "Google", value: "google" },
  { label: "ZipRecruiter", value: "ziprecruiter" },
  { label: "Job Street", value: "jobstreet" },
  { label: "Other", value: "other" },
] as const;

export const JOB_STATUSES = [
  { label: "Draft", value: "draft" },
  { label: "Applied", value: "applied" },
  { label: "Interview", value: "interview" },
  { label: "Offer", value: "offer" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
  { label: "Archived", value: "archived" },
] as const;

export const SIDEBAR_LINKS = [
  {
    icon: LayoutDashboard,
    route: "/dashboard",
    label: "Dashboard",
  },
  {
    icon: BriefcaseBusiness,
    route: "/dashboard/myjobs",
    label: "My Jobs",
  },
  // CAREERFLOW: Phase 1 — Gmail integration tab.
  {
    icon: Mail,
    route: "/dashboard/gmail",
    label: "Gmail",
  },
  // CAREERFLOW: Phase 2 — JD evaluation tab.
  {
    icon: Sparkles,
    route: "/dashboard/evaluate",
    label: "Evaluate JD",
  },
  {
    icon: Zap,
    route: "/dashboard/automations",
    label: "Automations",
  },
  {
    icon: SquareCheckBig,
    route: "/dashboard/tasks",
    label: "Tasks",
  },
  {
    icon: CalendarClock,
    route: "/dashboard/activities",
    label: "Activities",
  },
  {
    icon: BookOpen,
    route: "/dashboard/questions",
    label: "Question Bank",
  },
  {
    icon: UserRound,
    route: "/dashboard/profile",
    label: "Profile",
  },
  {
    icon: Sheet,
    route: "/dashboard/admin",
    label: "Administration",
  },
  {
    icon: Wrench,
    route: "/dashboard/developer",
    label: "Developer Options",
    devOnly: true,
  },
];
