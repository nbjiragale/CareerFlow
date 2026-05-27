import "server-only";

import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  RESUME_TAILOR_SYSTEM_PROMPT,
  buildResumeTailorPrompt,
} from "@/lib/ai/prompts/resume-tailor";
import {
  ResumeTailorSchema,
  type ResumeTailorResponse,
} from "@/models/ai.schemas";
import { recordAiUsage } from "./audit";
import { SectionType } from "@/models/profile.model";

export interface RunResumeTailorArgs {
  userId: string;
  sourceResumeId: string;
  jobId: string;
}

export interface RunResumeTailorResult {
  newResumeId: string;
  newResumeTitle: string;
  tailored: ResumeTailorResponse;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

interface ResolvedAiSettings {
  provider: ProviderType;
  model: string;
}

async function resolveAiSettings(
  userId: string,
): Promise<ResolvedAiSettings> {
  const row = await db.userSettings.findUnique({ where: { userId } });
  if (!row) {
    throw new Error(
      "AI settings not configured. Pick a provider and model in Settings → AI Provider first.",
    );
  }
  let parsed: { ai?: { provider?: string; model?: string } };
  try {
    parsed = JSON.parse(row.settings);
  } catch {
    throw new Error("UserSettings JSON is corrupt; cannot resolve AI provider.");
  }
  const provider = parsed.ai?.provider as ProviderType | undefined;
  const model = parsed.ai?.model;
  if (!provider || !model) {
    throw new Error(
      "AI provider/model not selected. Pick one in Settings → AI Provider.",
    );
  }
  return { provider, model };
}

function extractJsonObject(text: string): unknown {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  return JSON.parse(candidate);
}

async function generateTailorObject(
  aiModel: Awaited<ReturnType<typeof getModel>>,
  system: string,
  prompt: string,
) {
  try {
    const { object, usage } = await generateObject({
      model: aiModel,
      schema: ResumeTailorSchema,
      system,
      prompt,
      temperature: 0.4,
    });
    return { object, usage };
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err)) throw err;

    const jsonSchema = z.toJSONSchema(ResumeTailorSchema);
    const { text, usage } = await generateText({
      model: aiModel,
      system,
      prompt: `${prompt}\n\nReturn ONLY a single valid JSON object — no markdown code fences, no commentary before or after — conforming exactly to this JSON Schema:\n${JSON.stringify(
        jsonSchema,
      )}`,
      temperature: 0.4,
    });
    let object: ResumeTailorResponse;
    try {
      object = ResumeTailorSchema.parse(extractJsonObject(text));
    } catch {
      throw new Error(
        "The selected model did not return a valid tailored resume. Try a model with stronger structured-output support (e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet).",
      );
    }
    return { object, usage };
  }
}

interface SourceExperience {
  id: string;
  companyId: string;
  jobTitleId: string;
  locationId: string;
  companyLabel: string;
  jobTitleLabel: string;
  locationLabel: string;
  startDate: Date;
  endDate: Date | null;
  description: string;
}

interface SourceEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  locationId: string;
}

interface SourceCertification {
  title: string;
  organization: string;
  issueDate: Date | null;
  expirationDate: Date | null;
  credentialUrl: string | null;
}

interface SourceResumeData {
  id: string;
  profileId: string;
  title: string;
  contact: {
    firstName: string;
    lastName: string;
    headline: string;
    email: string;
    phone: string;
    address: string | null;
  } | null;
  sections: {
    summary?: {
      sectionTitle: string;
      content: string;
    };
    experience?: {
      sectionTitle: string;
      experiences: SourceExperience[];
    };
    education?: {
      sectionTitle: string;
      educations: SourceEducation[];
    };
    certification?: {
      sectionTitle: string;
      sectionType: string;
      certifications: SourceCertification[];
    };
  };
}

async function loadSource(
  resumeId: string,
  userId: string,
): Promise<SourceResumeData> {
  const resume = await db.resume.findUnique({
    where: { id: resumeId, profile: { userId } },
    include: {
      ContactInfo: true,
      ResumeSections: {
        include: {
          summary: true,
          workExperiences: {
            include: { jobTitle: true, Company: true, location: true },
          },
          educations: { include: { location: true } },
          licenseOrCertifications: true,
        },
      },
    },
  });
  if (!resume) throw new Error("Source resume not found.");

  const sections: SourceResumeData["sections"] = {};
  for (const s of resume.ResumeSections) {
    if (s.sectionType === SectionType.SUMMARY && s.summary) {
      sections.summary = {
        sectionTitle: s.sectionTitle,
        content: s.summary.content,
      };
    } else if (s.sectionType === SectionType.EXPERIENCE) {
      sections.experience = {
        sectionTitle: s.sectionTitle,
        experiences: s.workExperiences.map((w) => ({
          id: w.id,
          companyId: w.companyId,
          jobTitleId: w.jobTitleId,
          locationId: w.locationId,
          companyLabel: w.Company.label,
          jobTitleLabel: w.jobTitle.label,
          locationLabel: w.location.label,
          startDate: w.startDate,
          endDate: w.endDate,
          description: w.description,
        })),
      };
    } else if (s.sectionType === SectionType.EDUCATION) {
      sections.education = {
        sectionTitle: s.sectionTitle,
        educations: s.educations.map((e) => ({
          institution: e.institution,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          startDate: e.startDate,
          endDate: e.endDate,
          description: e.description,
          locationId: e.locationId,
        })),
      };
    } else if (
      s.sectionType === SectionType.CERTIFICATION ||
      s.sectionType === SectionType.LICENSE
    ) {
      sections.certification = {
        sectionTitle: s.sectionTitle,
        sectionType: s.sectionType,
        certifications: s.licenseOrCertifications.map((c) => ({
          title: c.title,
          organization: c.organization,
          issueDate: c.issueDate,
          expirationDate: c.expirationDate,
          credentialUrl: c.credentialUrl,
        })),
      };
    }
  }

  return {
    id: resume.id,
    profileId: resume.profileId,
    title: resume.title,
    contact: resume.ContactInfo
      ? {
          firstName: resume.ContactInfo.firstName,
          lastName: resume.ContactInfo.lastName,
          headline: resume.ContactInfo.headline,
          email: resume.ContactInfo.email,
          phone: resume.ContactInfo.phone,
          address: resume.ContactInfo.address,
        }
      : null,
    sections,
  };
}

function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function persistTailoredResume(
  source: SourceResumeData,
  job: { jobTitle: string; company: string },
  tailored: ResumeTailorResponse,
  jobId: string,
): Promise<{ newResumeId: string; newTitle: string }> {
  const newTitle = `${source.title} — ${tailored.titleSuffix}`.slice(0, 255);

  const tailoredByExpId = new Map(
    tailored.experiences.map((e) => [e.id, e.description]),
  );

  return db.$transaction(async (tx) => {
    const newResume = await tx.resume.create({
      data: { profileId: source.profileId, title: newTitle },
    });

    if (source.contact) {
      await tx.contactInfo.create({
        data: {
          resumeId: newResume.id,
          firstName: source.contact.firstName,
          lastName: source.contact.lastName,
          headline: source.contact.headline,
          email: source.contact.email,
          phone: source.contact.phone,
          address: source.contact.address ?? undefined,
        },
      });
    }

    if (source.sections.summary) {
      const summary = await tx.summary.create({
        data: { content: tailored.summary },
      });
      await tx.resumeSection.create({
        data: {
          resumeId: newResume.id,
          sectionTitle: source.sections.summary.sectionTitle,
          sectionType: SectionType.SUMMARY,
          summaryId: summary.id,
        },
      });
    }

    if (source.sections.experience) {
      const expSection = await tx.resumeSection.create({
        data: {
          resumeId: newResume.id,
          sectionTitle: source.sections.experience.sectionTitle,
          sectionType: SectionType.EXPERIENCE,
        },
      });
      for (const w of source.sections.experience.experiences) {
        await tx.workExperience.create({
          data: {
            companyId: w.companyId,
            jobTitleId: w.jobTitleId,
            locationId: w.locationId,
            startDate: w.startDate,
            endDate: w.endDate ?? undefined,
            description: tailoredByExpId.get(w.id) ?? w.description,
            resumeSectionId: expSection.id,
          },
        });
      }
    }

    if (source.sections.education) {
      const eduSection = await tx.resumeSection.create({
        data: {
          resumeId: newResume.id,
          sectionTitle: source.sections.education.sectionTitle,
          sectionType: SectionType.EDUCATION,
        },
      });
      for (const e of source.sections.education.educations) {
        await tx.education.create({
          data: {
            institution: e.institution,
            degree: e.degree,
            fieldOfStudy: e.fieldOfStudy,
            startDate: e.startDate,
            endDate: e.endDate ?? undefined,
            description: e.description ?? undefined,
            locationId: e.locationId,
            resumeSectionId: eduSection.id,
          },
        });
      }
    }

    if (source.sections.certification) {
      const certSection = await tx.resumeSection.create({
        data: {
          resumeId: newResume.id,
          sectionTitle: source.sections.certification.sectionTitle,
          sectionType: source.sections.certification.sectionType,
        },
      });
      for (const c of source.sections.certification.certifications) {
        await tx.licenseOrCertification.create({
          data: {
            title: c.title,
            organization: c.organization,
            issueDate: c.issueDate ?? undefined,
            expirationDate: c.expirationDate ?? undefined,
            credentialUrl: c.credentialUrl ?? undefined,
            resumeSectionId: certSection.id,
          },
        });
      }
    }

    await tx.job.update({
      where: { id: jobId },
      data: { resumeId: newResume.id },
    });

    return { newResumeId: newResume.id, newTitle };
  });
}

export async function runResumeTailor(
  args: RunResumeTailorArgs,
): Promise<RunResumeTailorResult> {
  const { userId, sourceResumeId, jobId } = args;

  const { provider, model } = await resolveAiSettings(userId);
  const startedAt = Date.now();

  try {
    const [source, job] = await Promise.all([
      loadSource(sourceResumeId, userId),
      db.job.findUnique({
        where: { id: jobId, userId },
        include: { JobTitle: true, Company: true },
      }),
    ]);

    if (!job) throw new Error("Job not found.");
    if (!job.description?.trim()) {
      throw new Error(
        "This job has no description — add a JD before tailoring.",
      );
    }
    if (
      !source.sections.experience ||
      source.sections.experience.experiences.length === 0
    ) {
      throw new Error(
        "Tailoring needs a structured resume with work experience to rewrite. This resume has no structured experience (an uploaded file can't be tailored) — add experience sections, or build a structured resume first.",
      );
    }

    const aiModel = await getModel(provider, model, userId);

    const candidateName = source.contact
      ? `${source.contact.firstName} ${source.contact.lastName}`.trim()
      : "Candidate";

    const promptInput = {
      resumeTitle: source.title,
      candidateName,
      currentSummary: stripHtmlToText(source.sections.summary?.content),
      experiences: source.sections.experience.experiences.map((e) => ({
        id: e.id,
        company: e.companyLabel,
        jobTitle: e.jobTitleLabel,
        location: e.locationLabel,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : "Present",
        description: stripHtmlToText(e.description),
      })),
      jdText: job.description,
      jobTitleLabel: job.JobTitle?.label,
      companyLabel: job.Company?.label,
    };

    const { object: tailored, usage } = await generateTailorObject(
      aiModel,
      RESUME_TAILOR_SYSTEM_PROMPT,
      buildResumeTailorPrompt(promptInput),
    );

    const sourceIds = new Set(
      source.sections.experience.experiences.map((e) => e.id),
    );
    const validExperiences = tailored.experiences.filter((e) =>
      sourceIds.has(e.id),
    );
    if (validExperiences.length === 0) {
      throw new Error(
        "Tailor output did not reference any source experience ids — the model hallucinated identifiers. Try a different model.",
      );
    }
    const normalized: ResumeTailorResponse = {
      ...tailored,
      experiences: validExperiences,
    };

    const persisted = await persistTailoredResume(
      source,
      {
        jobTitle: job.JobTitle?.label ?? "",
        company: job.Company?.label ?? "",
      },
      normalized,
      jobId,
    );

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "resume-tailor",
      provider,
      model,
      usage: {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
      },
      msElapsed,
      status: "success",
      jobId,
    });

    return {
      newResumeId: persisted.newResumeId,
      newResumeTitle: persisted.newTitle,
      tailored: normalized,
      provider,
      model,
      costUsd: audit?.costUsd ?? 0,
      warning: audit?.warning,
      msElapsed,
    };
  } catch (err) {
    const msElapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordAiUsage({
      userId,
      feature: "resume-tailor",
      provider,
      model,
      msElapsed,
      status: "error",
      errorMessage: message,
      jobId,
    });
    throw err;
  }
}
