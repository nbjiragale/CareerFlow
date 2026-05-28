// CAREERFLOW: "Edge" win-loop — data collection. Reads the user's Jobs with the
// context that predicts outcomes (JD evaluation archetype/grade, resume version,
// match score, whether they followed up) and normalizes them into the flat
// EdgeApplication shape the pure aggregator consumes.

import "server-only";

import db from "@/lib/db";
import type { EdgeApplication } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

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
      appliedDate: true,
      createdAt: true,
      Status: { select: { value: true } },
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      Resume: { select: { title: true } },
      AiDraft: {
        where: { draftType: "follow-up" },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  return jobs.map((j) => {
    const firstFollowUp = j.AiDraft[0]?.createdAt ?? null;
    const appliedAt = j.appliedDate ?? j.createdAt ?? null;
    let followUpDelayDays: number | null = null;
    if (firstFollowUp && appliedAt) {
      const days = Math.round(
        (firstFollowUp.getTime() - appliedAt.getTime()) / DAY_MS,
      );
      // Guard against drafts dated before the applied date (data quirks).
      followUpDelayDays = Math.max(0, days);
    }

    return {
      id: j.id,
      company: j.Company?.label ?? null,
      role: j.JobTitle?.label ?? null,
      statusValue: j.Status?.value ?? "draft",
      archetype: archetypeFromEvaluation(j.evaluationJson),
      grade: j.evaluationGrade ?? null,
      matchScore: typeof j.matchScore === "number" ? j.matchScore : null,
      resumeTitle: j.Resume?.title ?? null,
      followedUp: firstFollowUp != null,
      followUpDelayDays,
    };
  });
}
