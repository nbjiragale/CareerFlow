// CAREERFLOW: Phase 3 (PR #9) — builds a single JSON export of every row owned
// by a user. Used by GET /api/settings/data-export.
//
// Completeness follows the same ownership tree as the PR #7 cascade graph: we
// load the user with a deep include covering every reachable table, then
// flatten it into one array per table.
//
// Secrets are NEVER exported: the User password hash is dropped, and the
// encrypted columns on ApiKey / OAuthToken are redacted (metadata kept, marked
// `_encrypted: true`). process.env (master key, SMTP creds) is never read.

import "server-only";

import db from "@/lib/db";

export const EXPORT_SCHEMA_VERSION = "phase-3";

// Every user-owned table that appears in the export. Kept as a constant so a
// test can fail loudly if a new model is added without an export entry (P3-R8).
export const EXPORTED_TABLES = [
  "user",
  "userSettings",
  "apiKeys",
  "oauthTokens",
  "profiles",
  "resumes",
  "coverLetters",
  "files",
  "contactInfos",
  "resumeSections",
  "summaries",
  "workExperiences",
  "educations",
  "licenseOrCertifications",
  "otherSections",
  "jobTitles",
  "locations",
  "companies",
  "jobSources",
  "contacts",
  "jobs",
  "interviews",
  "activityTypes",
  "activities",
  "tasks",
  "automations",
  "automationRuns",
  "notes",
  "tags",
  "questions",
  "emailThreads",
  "emailClassificationCorrections",
  "aiDrafts",
  "aiAuditLogs",
  "reminders",
  "emailLogs",
] as const;

type Row = Record<string, unknown>;

function omit<T extends Row>(row: T, keys: string[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

// Strip included relation objects/arrays so a flattened table holds only its
// own row fields.
function stripRelations<T extends Row>(row: T, relationKeys: string[]): Row {
  return omit(row, relationKeys);
}

function redactApiKey(row: Row): Row {
  return { ...omit(row, ["encryptedKey", "iv"]), _encrypted: true };
}

function redactOAuthToken(row: Row): Row {
  return {
    ...omit(row, [
      "encryptedRefreshToken",
      "refreshTokenIv",
      "encryptedAccessToken",
      "accessTokenIv",
    ]),
    _encrypted: true,
  };
}

const USER_INCLUDE = {
  Settings: true,
  ApiKey: true,
  OAuthToken: true,
  JobTitle: true,
  Location: true,
  Company: true,
  JobSource: true,
  Contact: true,
  ActivityType: true,
  Activity: true,
  Task: true,
  Note: true,
  Tag: true,
  Question: true,
  EmailThread: true,
  EmailClassificationCorrection: true,
  AiDraft: true,
  AiAuditLog: true,
  Reminder: true,
  EmailLog: true,
  jobsApplied: { include: { Interview: true } },
  Automation: { include: { runs: true } },
  Profile: {
    include: {
      coverLetters: true,
      resumes: {
        include: {
          File: true,
          ContactInfo: true,
          ResumeSections: {
            include: {
              summary: true,
              workExperiences: true,
              educations: true,
              licenseOrCertifications: true,
              others: true,
            },
          },
        },
      },
    },
  },
} as const;

export interface UserExport {
  _meta: {
    exportedAt: string;
    schemaVersion: string;
    userId: string;
    note: string;
  };
  [table: string]: unknown;
}

export async function collectUserExport(
  userId: string,
): Promise<UserExport | null> {
  const user = (await db.user.findUnique({
    where: { id: userId },
    include: USER_INCLUDE,
  })) as Row | null;

  if (!user) return null;

  const profiles = (user.Profile as Row[]) ?? [];
  const resumes = profiles.flatMap((p) => (p.resumes as Row[]) ?? []);
  const resumeSections = resumes.flatMap(
    (r) => (r.ResumeSections as Row[]) ?? [],
  );
  const jobs = (user.jobsApplied as Row[]) ?? [];
  const automations = (user.Automation as Row[]) ?? [];

  const export_: UserExport = {
    _meta: {
      exportedAt: new Date().toISOString(),
      schemaVersion: EXPORT_SCHEMA_VERSION,
      userId,
      note: "Secrets (API key / OAuth token ciphertext) are redacted and the password hash is omitted. Server env vars (master key, SMTP) are never included.",
    },

    user: omit(user, [
      "password",
      // included relations — flattened into their own keys below
      "Settings",
      "ApiKey",
      "OAuthToken",
      "JobTitle",
      "Location",
      "Company",
      "JobSource",
      "Contact",
      "ActivityType",
      "Activity",
      "Task",
      "Note",
      "Tag",
      "Question",
      "EmailThread",
      "EmailClassificationCorrection",
      "AiDraft",
      "AiAuditLog",
      "Reminder",
      "EmailLog",
      "jobsApplied",
      "Automation",
      "Profile",
    ]),

    userSettings: user.Settings ? [user.Settings as Row] : [],
    apiKeys: ((user.ApiKey as Row[]) ?? []).map(redactApiKey),
    oauthTokens: ((user.OAuthToken as Row[]) ?? []).map(redactOAuthToken),

    profiles: profiles.map((p) => stripRelations(p, ["resumes", "coverLetters"])),
    resumes: resumes.map((r) =>
      stripRelations(r, ["File", "ContactInfo", "ResumeSections"]),
    ),
    coverLetters: profiles.flatMap((p) => (p.coverLetters as Row[]) ?? []),
    files: resumes.map((r) => r.File as Row | null).filter(Boolean) as Row[],
    contactInfos: resumes
      .map((r) => r.ContactInfo as Row | null)
      .filter(Boolean) as Row[],
    resumeSections: resumeSections.map((s) =>
      stripRelations(s, [
        "summary",
        "workExperiences",
        "educations",
        "licenseOrCertifications",
        "others",
      ]),
    ),
    summaries: resumeSections
      .map((s) => s.summary as Row | null)
      .filter(Boolean) as Row[],
    workExperiences: resumeSections.flatMap(
      (s) => (s.workExperiences as Row[]) ?? [],
    ),
    educations: resumeSections.flatMap((s) => (s.educations as Row[]) ?? []),
    licenseOrCertifications: resumeSections.flatMap(
      (s) => (s.licenseOrCertifications as Row[]) ?? [],
    ),
    otherSections: resumeSections.flatMap((s) => (s.others as Row[]) ?? []),

    jobTitles: (user.JobTitle as Row[]) ?? [],
    locations: (user.Location as Row[]) ?? [],
    companies: (user.Company as Row[]) ?? [],
    jobSources: (user.JobSource as Row[]) ?? [],
    contacts: (user.Contact as Row[]) ?? [],

    jobs: jobs.map((j) => stripRelations(j, ["Interview"])),
    interviews: jobs.flatMap((j) => (j.Interview as Row[]) ?? []),

    activityTypes: (user.ActivityType as Row[]) ?? [],
    activities: (user.Activity as Row[]) ?? [],
    tasks: (user.Task as Row[]) ?? [],

    automations: automations.map((a) => stripRelations(a, ["runs"])),
    automationRuns: automations.flatMap((a) => (a.runs as Row[]) ?? []),

    notes: (user.Note as Row[]) ?? [],
    tags: (user.Tag as Row[]) ?? [],
    questions: (user.Question as Row[]) ?? [],

    emailThreads: (user.EmailThread as Row[]) ?? [],
    emailClassificationCorrections:
      (user.EmailClassificationCorrection as Row[]) ?? [],
    aiDrafts: (user.AiDraft as Row[]) ?? [],
    aiAuditLogs: (user.AiAuditLog as Row[]) ?? [],
    reminders: (user.Reminder as Row[]) ?? [],
    emailLogs: (user.EmailLog as Row[]) ?? [],
  };

  return export_;
}
