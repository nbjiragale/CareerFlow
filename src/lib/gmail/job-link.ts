// CAREERFLOW: given a classification result, find an existing Job for
// the user that matches the extracted company (and optionally role); if
// no match, auto-create a Job using JobSync's existing entities. Returns
// the resolved jobId or null when auto-create is not appropriate (e.g.
// NotJobRelated or missing company).

import "server-only";

import db from "@/lib/db";

import {
  isJobRelatedLabel,
  LABEL_TO_JOB_STATUS,
  type ClassifierLabel,
} from "./labels";

const CAREERFLOW_GMAIL_SOURCE = "gmail";

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
  const normalized = normalize(label);

  const existing = await db.company.findFirst({
    where: { value: normalized, createdBy: userId },
  });
  if (existing) return existing.id;

  const created = await db.company.create({
    data: {
      label: titleCase(label),
      value: normalized,
      createdBy: userId,
    },
  });
  return created.id;
}

async function findOrCreateJobTitle(
  label: string,
  userId: string,
): Promise<string> {
  const normalized = normalize(label);

  const existing = await db.jobTitle.findFirst({
    where: { value: normalized, createdBy: userId },
  });
  if (existing) return existing.id;

  const created = await db.jobTitle.create({
    data: {
      label: titleCase(label),
      value: normalized,
      createdBy: userId,
    },
  });
  return created.id;
}

async function findOrCreateGmailSource(userId: string): Promise<string> {
  const existing = await db.jobSource.findFirst({
    where: { value: CAREERFLOW_GMAIL_SOURCE, createdBy: userId },
  });
  if (existing) return existing.id;

  return (
    await db.jobSource.create({
      data: {
        label: "Gmail",
        value: CAREERFLOW_GMAIL_SOURCE,
        createdBy: userId,
      },
    })
  ).id;
}

async function resolveStatusId(label: ClassifierLabel): Promise<string | null> {
  const value = LABEL_TO_JOB_STATUS[label];
  if (!value) return null;

  // JobSync seeds JobStatus rows on signup (see src/actions/auth.actions.ts),
  // but we tolerate a missing row by creating it on demand.
  const existing = await db.jobStatus.findFirst({ where: { value } });
  if (existing) return existing.id;

  return (
    await db.jobStatus.create({
      data: { label: titleCase(value), value },
    })
  ).id;
}

export interface LinkInput {
  userId: string;
  label: ClassifierLabel;
  confidence: number;
  threshold: number;
  extractedCompany?: string;
  extractedRole?: string;
  subject: string;
  receivedAt: Date;
}

export interface LinkResult {
  jobId: string | null;
  created: boolean;
}

export async function findOrCreateJobForClassification(
  input: LinkInput,
): Promise<LinkResult> {
  if (!isJobRelatedLabel(input.label)) {
    return { jobId: null, created: false };
  }
  if (input.confidence < input.threshold) {
    return { jobId: null, created: false };
  }
  if (!input.extractedCompany) {
    return { jobId: null, created: false };
  }

  const companyNormalized = normalize(input.extractedCompany);
  if (!companyNormalized) return { jobId: null, created: false };

  // Try to find an existing Job for this user/company. Prefer a role match
  // when available.
  const candidates = await db.job.findMany({
    where: {
      userId: input.userId,
      Company: { value: companyNormalized, createdBy: input.userId },
    },
    include: { JobTitle: true },
    orderBy: { createdAt: "desc" },
  });

  if (candidates.length > 0) {
    if (input.extractedRole) {
      const roleNormalized = normalize(input.extractedRole);
      const roleMatch = candidates.find(
        (c) =>
          c.JobTitle?.value === roleNormalized ||
          c.JobTitle?.value.includes(roleNormalized) ||
          roleNormalized.includes(c.JobTitle?.value ?? ""),
      );
      if (roleMatch) {
        return { jobId: roleMatch.id, created: false };
      }
    }
    // Fall back to the most recent job for this company.
    return { jobId: candidates[0].id, created: false };
  }

  // Auto-create. Requires JobTitle, Company, Status. Role defaults to
  // the email subject when the classifier didn't extract one.
  const statusId = await resolveStatusId(input.label);
  if (!statusId) return { jobId: null, created: false };

  const titleSource =
    input.extractedRole && input.extractedRole.trim().length > 0
      ? input.extractedRole
      : input.subject.replace(/^(re|fwd?):\s*/i, "").trim() || "Job Application";

  const [companyId, jobTitleId, jobSourceId] = await Promise.all([
    findOrCreateCompany(input.extractedCompany, input.userId),
    findOrCreateJobTitle(titleSource, input.userId),
    findOrCreateGmailSource(input.userId),
  ]);

  const created = await db.job.create({
    data: {
      userId: input.userId,
      jobTitleId,
      companyId,
      jobSourceId,
      statusId,
      description: input.subject,
      jobType: "other",
      createdAt: new Date(),
      applied: true,
      appliedDate: input.receivedAt,
    },
  });

  return { jobId: created.id, created: true };
}
