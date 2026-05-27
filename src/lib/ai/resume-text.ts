// CAREERFLOW: resolves the best available plain text for a resume so AI
// features work on BOTH structured resumes and uploaded files. Prefers
// structured sections; otherwise uses the uploaded file's extracted text,
// lazily backfilling it for files uploaded before extraction existed.

import "server-only";

import db from "@/lib/db";
import type { Resume } from "@/models/profile.model";
import { extractTextFromFile } from "@/lib/files/extract-text";
import {
  convertResumeToText,
  preprocessResumeText,
  type PreprocessingResult,
} from "./tools/preprocessing";

function hasStructuredSections(resume: Resume): boolean {
  return (resume?.ResumeSections?.length ?? 0) > 0;
}

/**
 * Return the best text for a resume: structured content when present, else the
 * uploaded file's extracted text (backfilled on first use), else whatever
 * structured conversion yields (likely just the title — preprocessing rejects it).
 */
export async function resolveResumeText(resume: Resume): Promise<string> {
  if (!resume) return "";

  if (hasStructuredSections(resume)) {
    return (await convertResumeToText(resume)).trim();
  }

  const file = resume.File;
  if (file?.id) {
    let text = (file.extractedText ?? "").trim();

    // Lazy backfill for files uploaded before extraction existed. extractedAt
    // marks "we already tried" so scanned/text-less files aren't reparsed forever.
    if (!text && !file.extractedAt && file.filePath) {
      const extracted = await extractTextFromFile(file.filePath, file.fileName);
      text = extracted.trim();
      try {
        await db.file.update({
          where: { id: file.id },
          data: { extractedText: extracted || null, extractedAt: new Date() },
        });
      } catch {
        // best-effort backfill; ignore write failures
      }
    }

    if (text) {
      const title = resume.title ? `# ${resume.title}` : "";
      return [title, text].filter(Boolean).join("\n\n");
    }
  }

  // Nothing usable from a file; fall back to structured conversion.
  return (await convertResumeToText(resume)).trim();
}

/**
 * Resolve resume text (structured or uploaded-file) and run the normalize +
 * validate pipeline. Drop-in replacement for preprocessResume() in AI routes
 * that should also accept uploaded resumes.
 */
export async function preprocessResumeWithFile(
  resume: Resume,
): Promise<PreprocessingResult> {
  const text = await resolveResumeText(resume);
  return preprocessResumeText(text);
}
