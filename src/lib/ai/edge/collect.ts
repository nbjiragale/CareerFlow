// CAREERFLOW: "Edge" win-loop — data collection. Reads the user's Jobs with the
// context that predicts outcomes (JD evaluation archetype/grade, resume version,
// match score, whether they followed up) and normalizes them into the flat
// EdgeApplication shape the pure aggregator consumes.

import "server-only";

import db from "@/lib/db";
import type { EdgeApplication } from "./aggregate";

function archetypeFromEvaluation(evaluationJson: string | null): string | null {
  if (!evaluationJson) return null;
  try {
    const parsed = JSON.parse(evaluationJson) as { detectedArchetype?: string };
    return parsed.detectedArchetype ?? null;
  } catch {
    return null;
  }
}

export async function collectApplications(
  userId: string,
): Promise<EdgeApplication[]> {
  const jobs = await db.job.findMany({
    where: { userId },
    select: {
      id: true,
      matchScore: true,
      evaluationGrade: true,
      evaluationJson: true,
      Status: { select: { value: true } },
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      Resume: { select: { title: true } },
      AiDraft: {
        where: { draftType: "follow-up" },
        select: { id: true },
        take: 1,
      },
    },
  });

  return jobs.map((j) => ({
    id: j.id,
    company: j.Company?.label ?? null,
    role: j.JobTitle?.label ?? null,
    statusValue: j.Status?.value ?? "draft",
    archetype: archetypeFromEvaluation(j.evaluationJson),
    grade: j.evaluationGrade ?? null,
    matchScore: typeof j.matchScore === "number" ? j.matchScore : null,
    resumeTitle: j.Resume?.title ?? null,
    followedUp: j.AiDraft.length > 0,
  }));
}
