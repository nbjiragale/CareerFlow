// CAREERFLOW: "Edge" win-loop — the deterministic core. Turns the user's own
// application history into hard, auditable funnel statistics. These numbers are
// computed here (never by the LLM); the LLM only narrates them downstream. That
// separation is the whole point: the insights are grounded in the user's real
// outcomes and can always be traced back to a count.

// Outcome of a single application, derived from the authoritative Job.Status
// pipeline stage (not email guesses):
//   positive — reached interview or offer (you got past the screen)
//   negative — rejected or expired
//   pending  — still open (wishlist / draft / applied / screening / archived)
export type EdgeOutcome = "positive" | "negative" | "pending";

const POSITIVE_STATUSES = new Set(["interview", "offer"]);
const NEGATIVE_STATUSES = new Set(["rejected", "expired"]);

// How many *decided* (positive + negative) applications we need before insights
// are statistically worth surfacing. Below this we stay in "learning" mode and
// never spend an LLM call. Tunable — deliberately low enough to be reachable.
export const EDGE_MIN_DECIDED = 8;

// Only surface a cohort (archetype / grade / resume / band) in insights once it
// has at least this many decided applications, so we don't over-read noise.
export const EDGE_MIN_COHORT_DECIDED = 2;

// A follow-up sent within this many days of applying counts as "prompt"; later
// is "delayed". Lets Edge test whether following up *quickly* matters for you.
export const EDGE_PROMPT_FOLLOW_UP_DAYS = 7;

export interface EdgeApplication {
  id: string;
  company: string | null;
  role: string | null;
  statusValue: string;
  archetype: string | null; // detectedArchetype from the JD evaluation
  grade: string | null; // A–F evaluation grade
  matchScore: number | null; // 0–100 resume↔JD match
  resumeTitle: string | null; // which resume version was attached
  followedUp: boolean; // did the user send a follow-up draft for this job?
  // Days between applying and the first follow-up. null when they didn't follow
  // up, or when we can't date it (no applied date on record).
  followUpDelayDays: number | null;
}

export function outcomeOf(statusValue: string): EdgeOutcome {
  if (POSITIVE_STATUSES.has(statusValue)) return "positive";
  if (NEGATIVE_STATUSES.has(statusValue)) return "negative";
  return "pending";
}

export interface EdgeCohort {
  key: string;
  label: string;
  total: number;
  decided: number;
  positive: number;
  rate: number; // positive / decided, as a 0–100 percent (0 when decided === 0)
}

export interface EdgeFacts {
  totals: {
    total: number;
    decided: number;
    positive: number;
    negative: number;
    pending: number;
    rate: number; // overall interview+ rate over decided applications
  };
  byArchetype: EdgeCohort[];
  byGrade: EdgeCohort[];
  byMatchBand: EdgeCohort[];
  byResume: EdgeCohort[];
  followUp: {
    followedUp: EdgeCohort;
    notFollowedUp: EdgeCohort;
  };
  // Among applications the user followed up on (and that we can date), did
  // following up promptly correlate with better outcomes?
  followUpTiming: {
    withinWeek: EdgeCohort;
    afterWeek: EdgeCohort;
  };
  hasEnoughData: boolean;
  decidedNeeded: number; // how many more decided apps until insights unlock
}

function pct(positive: number, decided: number): number {
  return decided === 0 ? 0 : Math.round((positive / decided) * 100);
}

function buildCohort(
  key: string,
  label: string,
  apps: EdgeApplication[],
): EdgeCohort {
  let decided = 0;
  let positive = 0;
  for (const a of apps) {
    const o = outcomeOf(a.statusValue);
    if (o === "pending") continue;
    decided += 1;
    if (o === "positive") positive += 1;
  }
  return { key, label, total: apps.length, decided, positive, rate: pct(positive, decided) };
}

function groupBy(
  apps: EdgeApplication[],
  keyOf: (a: EdgeApplication) => string | null,
  labelOf: (key: string) => string = (k) => k,
): EdgeCohort[] {
  const groups = new Map<string, EdgeApplication[]>();
  for (const a of apps) {
    const key = keyOf(a);
    if (key == null) continue;
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  return Array.from(groups.entries())
    .map(([key, arr]) => buildCohort(key, labelOf(key), arr))
    .sort((a, b) => b.decided - a.decided || b.rate - a.rate);
}

const MATCH_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "85+", label: "Strong match (85+)", min: 85, max: 101 },
  { key: "70-84", label: "Good match (70–84)", min: 70, max: 85 },
  { key: "50-69", label: "Partial match (50–69)", min: 50, max: 70 },
  { key: "<50", label: "Weak match (<50)", min: -1, max: 50 },
];

function matchBandOf(score: number): { key: string; label: string } {
  const band = MATCH_BANDS.find((b) => score >= b.min && score < b.max);
  return band ?? { key: "<50", label: "Weak match (<50)" };
}

/**
 * Pure rollup over normalized application records. No I/O — fully unit-testable.
 */
export function buildEdgeFacts(apps: EdgeApplication[]): EdgeFacts {
  let positive = 0;
  let negative = 0;
  let pending = 0;
  for (const a of apps) {
    const o = outcomeOf(a.statusValue);
    if (o === "positive") positive += 1;
    else if (o === "negative") negative += 1;
    else pending += 1;
  }
  const decided = positive + negative;

  const byMatchBand = (() => {
    const scored = apps.filter((a) => typeof a.matchScore === "number");
    const groups = new Map<string, EdgeApplication[]>();
    for (const a of scored) {
      const { key } = matchBandOf(a.matchScore as number);
      const arr = groups.get(key) ?? [];
      arr.push(a);
      groups.set(key, arr);
    }
    return MATCH_BANDS.filter((b) => groups.has(b.key))
      .map((b) => buildCohort(b.key, b.label, groups.get(b.key)!))
      .sort((a, b) => b.decided - a.decided || b.rate - a.rate);
  })();

  return {
    totals: {
      total: apps.length,
      decided,
      positive,
      negative,
      pending,
      rate: pct(positive, decided),
    },
    byArchetype: groupBy(apps, (a) => a.archetype),
    byGrade: groupBy(
      apps,
      (a) => a.grade,
      (k) => `Grade ${k}`,
    ),
    byMatchBand,
    byResume: groupBy(apps, (a) => a.resumeTitle),
    followUp: {
      followedUp: buildCohort(
        "followed-up",
        "Followed up",
        apps.filter((a) => a.followedUp),
      ),
      notFollowedUp: buildCohort(
        "no-follow-up",
        "No follow-up",
        apps.filter((a) => !a.followedUp),
      ),
    },
    followUpTiming: {
      withinWeek: buildCohort(
        "follow-up-within-week",
        `Followed up within ${EDGE_PROMPT_FOLLOW_UP_DAYS} days`,
        apps.filter(
          (a) =>
            a.followUpDelayDays != null &&
            a.followUpDelayDays <= EDGE_PROMPT_FOLLOW_UP_DAYS,
        ),
      ),
      afterWeek: buildCohort(
        "follow-up-after-week",
        `Followed up after ${EDGE_PROMPT_FOLLOW_UP_DAYS} days`,
        apps.filter(
          (a) =>
            a.followUpDelayDays != null &&
            a.followUpDelayDays > EDGE_PROMPT_FOLLOW_UP_DAYS,
        ),
      ),
    },
    hasEnoughData: decided >= EDGE_MIN_DECIDED,
    decidedNeeded: Math.max(0, EDGE_MIN_DECIDED - decided),
  };
}
