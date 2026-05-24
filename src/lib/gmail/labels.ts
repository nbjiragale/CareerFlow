// CAREERFLOW: canonical classifier labels used by the HuggingFace Space
// (CareerSync's classifier) and the built-in keyword fallback. The five
// job-related labels map to JobSync's seeded JobStatus values.

export const JOB_LABELS = [
  "Applied",
  "Interview",
  "NextPhase",
  "Offer",
  "Rejected",
] as const;

export type ClassifierLabel = (typeof JOB_LABELS)[number] | "NotJobRelated";

// Map classifier label -> JobStatus.value seeded in src/actions/auth.actions.ts.
// JobSync ships statuses: draft, applied, interview, offer, rejected, expired,
// archived. We map NextPhase -> interview as the closest existing bucket.
export const LABEL_TO_JOB_STATUS: Record<ClassifierLabel, string | null> = {
  Applied: "applied",
  Interview: "interview",
  NextPhase: "interview",
  Offer: "offer",
  Rejected: "rejected",
  NotJobRelated: null,
};

export function normalizeLabel(raw: string): ClassifierLabel {
  const lower = raw.trim().toLowerCase();
  if (lower === "applied") return "Applied";
  if (lower === "interview" || lower === "interviewing") return "Interview";
  if (
    lower === "next-phase" ||
    lower === "next_phase" ||
    lower === "nextphase" ||
    lower === "next phase"
  ) {
    return "NextPhase";
  }
  if (lower === "offer") return "Offer";
  if (lower === "rejected" || lower === "rejection") return "Rejected";
  return "NotJobRelated";
}

export function isJobRelatedLabel(label: ClassifierLabel): boolean {
  return label !== "NotJobRelated";
}
