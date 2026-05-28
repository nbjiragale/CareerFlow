// CAREERFLOW: "Edge" win-loop — user prompt builder. Serializes the
// deterministic EdgeFacts into a compact, readable stat block. Cohorts with too
// little signal are dropped here (not sent to the model) so it can't over-read
// noise. Numbers in = numbers out: the model is told to cite only these.

import "server-only";

import {
  EDGE_MIN_COHORT_DECIDED,
  type EdgeCohort,
  type EdgeFacts,
} from "@/lib/ai/edge/aggregate";

function cohortLine(c: EdgeCohort): string {
  return `- ${c.label}: ${c.rate}% interview+ (${c.positive}/${c.decided} decided, ${c.total} total)`;
}

function section(title: string, cohorts: EdgeCohort[]): string {
  const meaningful = cohorts.filter((c) => c.decided >= EDGE_MIN_COHORT_DECIDED);
  if (meaningful.length === 0) {
    return `${title}:\n- (not enough decided applications to compare)`;
  }
  return [title + ":", ...meaningful.map(cohortLine)].join("\n");
}

export function buildCareerEdgePrompt(facts: EdgeFacts): string {
  const { totals, followUp } = facts;

  const followUpLines = [followUp.followedUp, followUp.notFollowedUp]
    .filter((c) => c.decided >= EDGE_MIN_COHORT_DECIDED)
    .map(cohortLine);

  return [
    "=== OVERALL FUNNEL ===",
    `Total applications: ${totals.total}`,
    `Decided: ${totals.decided} (positive: ${totals.positive}, negative: ${totals.negative})`,
    `Still open: ${totals.pending}`,
    `Overall interview+ rate: ${totals.rate}% (${totals.positive}/${totals.decided})`,
    "",
    section("=== BY JD ARCHETYPE ===", facts.byArchetype),
    "",
    section("=== BY EVALUATION GRADE ===", facts.byGrade),
    "",
    section("=== BY MATCH SCORE BAND ===", facts.byMatchBand),
    "",
    section("=== BY RESUME VERSION ===", facts.byResume),
    "",
    "=== FOLLOW-UP BEHAVIOR ===",
    ...(followUpLines.length > 0
      ? followUpLines
      : ["- (not enough decided applications to compare)"]),
    "",
    "Analyze the stats above and produce the CareerEdgeSchema. Cite only these numbers.",
  ].join("\n");
}
