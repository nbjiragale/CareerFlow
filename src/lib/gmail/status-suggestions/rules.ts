// CAREERFLOW: status-suggestion rules — the pure decision core. Given a single
// classified email and the current state of its linked application, decide
// whether (and to what) we should suggest advancing the application's status.
// No I/O here, so it is fully unit-testable; the server layer in ./index.ts
// wraps it with Prisma reads/writes.

import { JOB_STATUSES } from "@/lib/data/jobStatusesData";

// Below this classifier confidence we defer to the existing manual-review loop
// rather than nudging the user to change a status.
export const STATUS_SUGGESTION_MIN_CONFIDENCE = 0.7;

// Email classifier labels → the Job status value they imply.
// "Applied" is the baseline (linking already implies it) and "NotJobRelated"
// is meaningless here, so neither maps to a suggestion.
export const LABEL_TO_STATUS_VALUE: Record<string, string> = {
  Interview: "interview",
  NextPhase: "interview",
  Offer: "offer",
  Rejected: "rejected",
};

// Pipeline ordering used for "only ever move forward" logic. Terminal stages
// are intentionally absent — they're handled separately.
const STATUS_RANK: Record<string, number> = {
  wishlist: 0,
  draft: 1,
  applied: 2,
  screening: 3,
  interview: 4,
  offer: 5,
};

const TERMINAL_STATUSES = new Set(["rejected", "expired", "archived"]);

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  JOB_STATUSES.map((s) => [s.value, s.label]),
);

export function statusLabel(value: string): string {
  return STATUS_LABEL[value] ?? value;
}

export interface SuggestionInput {
  emailLabel: string;
  currentStatusValue: string;
  confidence: number;
  needsReview: boolean;
}

/**
 * Decide the status an inbound classified email suggests for its linked
 * application, or null when no suggestion is warranted.
 *
 * Guarantees:
 *  - respects the classifier's review flag and a confidence floor
 *  - never resurrects a closed (terminal) application
 *  - a "Rejected" email can land from any active stage
 *  - otherwise only ever moves an application FORWARD in the pipeline
 */
export function suggestedStatusValue(input: SuggestionInput): string | null {
  const { emailLabel, currentStatusValue, confidence, needsReview } = input;

  if (needsReview) return null;
  if (confidence < STATUS_SUGGESTION_MIN_CONFIDENCE) return null;

  const target = LABEL_TO_STATUS_VALUE[emailLabel];
  if (!target) return null;

  // Don't reopen something the user has already closed out.
  if (TERMINAL_STATUSES.has(currentStatusValue)) return null;

  // Already in the target stage — nothing to suggest.
  if (target === currentStatusValue) return null;

  // A rejection can arrive at any point in an active search.
  if (target === "rejected") return "rejected";

  // Forward-only: never suggest stepping a status backward.
  const currentRank = STATUS_RANK[currentStatusValue] ?? -1;
  const targetRank = STATUS_RANK[target] ?? -1;
  return targetRank > currentRank ? target : null;
}

export interface StatusSuggestion {
  threadId: string;
  jobId: string;
  company: string;
  role: string;
  currentStatusValue: string;
  currentStatusLabel: string;
  suggestedStatusValue: string;
  suggestedStatusLabel: string;
  emailLabel: string;
  emailSubject: string;
  receivedAt: string; // ISO
  confidence: number;
}
