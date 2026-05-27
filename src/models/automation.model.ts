// Automation types and interfaces

export type AutomationStatus = "active" | "paused";
export type AutomationRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "completed_with_errors"
  | "blocked"
  | "rate_limited";
export type DiscoveryStatus = "new" | "accepted" | "dismissed";
export type JobBoard = "jsearch" | "remotive";

// CAREERFLOW: human-readable board names for the wizard, automation list, and
// run logs. Keep keys in sync with JobBoardSchema and the searchJobBoard switch.
export const JOB_BOARD_LABELS: Record<JobBoard, string> = {
  jsearch: "JSearch (Google Jobs)",
  remotive: "Remotive (Remote jobs)",
};

export interface Automation {
  id: string;
  userId: string;
  name: string;
  jobBoard: JobBoard;
  keywords: string;
  location: string;
  resumeId: string;
  matchThreshold: number;
  scheduleHour: number;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  status: AutomationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationWithResume extends Automation {
  resume: {
    id: string;
    title: string;
  };
}

export interface AutomationRun {
  id: string;
  automationId: string;
  jobsSearched: number;
  jobsDeduplicated: number;
  jobsProcessed: number;
  jobsMatched: number;
  jobsSaved: number;
  status: AutomationRunStatus;
  errorMessage: string | null;
  blockedReason: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface DiscoveredJob {
  id: string;
  userId: string;
  automationId: string;
  automation?: {
    id: string;
    name: string;
  };
  jobUrl: string | null;
  description: string;
  jobType: string;
  createdAt: Date;
  jobTitleId: string;
  companyId: string;
  locationId: string | null;
  matchScore: number;
  matchData: string | null;
  discoveryStatus: DiscoveryStatus;
  discoveredAt: Date;
  JobTitle: { label: string };
  Company: { label: string };
  Location?: { label: string } | null;
}

export interface ScrapedJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  sourceBoard: JobBoard;
}
