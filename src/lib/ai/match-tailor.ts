// CAREERFLOW: one-shot "Match & Tailor" orchestrator. Turns a pasted JD into a
// tracked application, then runs evaluate → match → tailor against the user's
// chosen base resume in a single request. Each sub-step persists its own result
// (Job.evaluationGrade/Json, Job.matchScore/matchData, a new linked Resume
// version) and records its own AiAuditLog row, so this layer only sequences
// them and aggregates cost. AI settings are resolved up front so we fail fast
// (no orphan Job) when no provider/model is configured.

import "server-only";

import db from "@/lib/db";
import type { ProviderType } from "@/lib/ai/providers";
import {
  JOB_TYPE_DEFAULT,
  CAREERFLOW_SOURCE_LABEL,
  CAREERFLOW_SOURCE_VALUE,
  DEFAULT_STATUS_VALUE,
} from "./match-tailor.constants";
import { resolveUserAiSettings } from "./resolve-settings";
import { runJdEvaluation } from "./evaluate";
import { runJobMatch } from "./match";
import { runResumeTailor } from "./tailor";
import { StructuredOutputUnsupportedError } from "./structured";
import type {
  JdEvaluationResponse,
  JobMatchResponse,
  Archetype,
} from "@/models/ai.schemas";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function findOrCreateCompany(
  label: string,
  userId: string,
): Promise<string> {
  const value = normalize(label);
  const existing = await db.company.findFirst({
    where: { value, createdBy: userId },
  });
  if (existing) return existing.id;
  return (
    await db.company.create({
      data: { label: titleCase(label), value, createdBy: userId },
    })
  ).id;
}

async function findOrCreateJobTitle(
  label: string,
  userId: string,
): Promise<string> {
  const value = normalize(label);
  const existing = await db.jobTitle.findFirst({
    where: { value, createdBy: userId },
  });
  if (existing) return existing.id;
  return (
    await db.jobTitle.create({
      data: { label: titleCase(label), value, createdBy: userId },
    })
  ).id;
}

async function findOrCreateSource(userId: string): Promise<string> {
  const existing = await db.jobSource.findFirst({
    where: { value: CAREERFLOW_SOURCE_VALUE, createdBy: userId },
  });
  if (existing) return existing.id;
  return (
    await db.jobSource.create({
      data: {
        label: CAREERFLOW_SOURCE_LABEL,
        value: CAREERFLOW_SOURCE_VALUE,
        createdBy: userId,
      },
    })
  ).id;
}

async function resolveDefaultStatusId(): Promise<string> {
  // JobStatus rows are seeded globally on signup; tolerate a missing row.
  const existing = await db.jobStatus.findFirst({
    where: { value: DEFAULT_STATUS_VALUE },
  });
  if (existing) return existing.id;
  return (
    await db.jobStatus.create({
      data: { label: titleCase(DEFAULT_STATUS_VALUE), value: DEFAULT_STATUS_VALUE },
    })
  ).id;
}

interface CreateJobFromJdArgs {
  userId: string;
  jdText: string;
  company: string;
  role: string;
}

async function createJobFromJd(args: CreateJobFromJdArgs): Promise<string> {
  const { userId, jdText, company, role } = args;

  const [companyId, jobTitleId, jobSourceId, statusId] = await Promise.all([
    findOrCreateCompany(company, userId),
    findOrCreateJobTitle(role, userId),
    findOrCreateSource(userId),
    resolveDefaultStatusId(),
  ]);

  const job = await db.job.create({
    data: {
      userId,
      jobTitleId,
      companyId,
      jobSourceId,
      statusId,
      description: jdText,
      jobType: JOB_TYPE_DEFAULT,
      applied: false,
      createdAt: new Date(),
    },
  });

  return job.id;
}

export interface RunMatchAndTailorArgs {
  userId: string;
  jdText: string;
  company: string;
  role: string;
  baseResumeId: string;
  archetypeHint?: Archetype | "auto-detect";
}

export interface RunMatchAndTailorResult {
  jobId: string;
  evaluation: JdEvaluationResponse | null;
  evaluationError?: string;
  match: JobMatchResponse | null;
  matchError?: string;
  tailoredResumeId: string | null;
  tailoredResumeTitle: string | null;
  tailorError?: string;
  provider: ProviderType;
  model: string;
  totalCostUsd: number;
  msElapsed: number;
}

/**
 * Orchestrate the full Match & Tailor flow. Resolves AI settings first (throws
 * before any DB write when unconfigured), creates a tracked Job from the JD,
 * then runs evaluate → match → tailor. Evaluate is run first because a model
 * that cannot return structured output will fail here — we re-throw that one
 * case so the route can surface an actionable 422; every other per-step failure
 * is captured so the user still gets the steps that did succeed.
 */
export async function runMatchAndTailor(
  args: RunMatchAndTailorArgs,
): Promise<RunMatchAndTailorResult> {
  const { userId, jdText, company, role, baseResumeId, archetypeHint } = args;

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  const jobId = await createJobFromJd({ userId, jdText, company, role });

  const result: RunMatchAndTailorResult = {
    jobId,
    evaluation: null,
    match: null,
    tailoredResumeId: null,
    tailoredResumeTitle: null,
    provider,
    model,
    totalCostUsd: 0,
    msElapsed: 0,
  };

  // Step 1 — evaluate (persists grade onto the Job).
  try {
    const evalRes = await runJdEvaluation({
      userId,
      jdText,
      archetypeHint,
      jobId,
    });
    result.evaluation = evalRes.evaluation;
    result.totalCostUsd += evalRes.costUsd;
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) throw err;
    result.evaluationError =
      err instanceof Error ? err.message : "Evaluation failed";
  }

  // Step 2 — match (persists matchScore/matchData onto the Job).
  try {
    const matchRes = await runJobMatch({
      userId,
      resumeId: baseResumeId,
      jobId,
    });
    result.match = matchRes.match;
    result.totalCostUsd += matchRes.costUsd;
  } catch (err) {
    result.matchError = err instanceof Error ? err.message : "Match failed";
  }

  // Step 3 — tailor (creates a new Resume version, links it to the Job).
  try {
    const tailorRes = await runResumeTailor({
      userId,
      sourceResumeId: baseResumeId,
      jobId,
    });
    result.tailoredResumeId = tailorRes.newResumeId;
    result.tailoredResumeTitle = tailorRes.newResumeTitle;
    result.totalCostUsd += tailorRes.costUsd;
  } catch (err) {
    result.tailorError = err instanceof Error ? err.message : "Tailor failed";
  }

  result.msElapsed = Date.now() - startedAt;
  return result;
}
