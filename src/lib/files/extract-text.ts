// CAREERFLOW: plain-text extraction from uploaded resume files so AI features
// (review, match) can operate on uploaded PDFs/DOCX, not just structured
// resumes. PDF via unpdf, DOCX via mammoth — both pure-JS, no native deps.
// Legacy .doc and image-only/scanned PDFs (no text layer) return "".
// Dynamic imports keep these heavy parsers out of the client/edge bundle.

import "server-only";

import { readFile } from "fs/promises";
import path from "path";

/**
 * Extract plain text from a resume file on disk. Returns a trimmed string, or
 * "" when the file type is unsupported or has no extractable text layer.
 * Never throws — extraction failures degrade to "" so callers can surface a
 * graceful "couldn't read text" message instead of a 500.
 */
export async function extractTextFromFile(
  filePath: string,
  fileName?: string,
): Promise<string> {
  const ext = path.extname(fileName || filePath).toLowerCase();

  try {
    if (ext === ".pdf") {
      const buffer = await readFile(filePath);
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const merged = Array.isArray(text) ? text.join("\n") : text;
      return (merged ?? "").trim();
    }

    if (ext === ".docx") {
      const buffer = await readFile(filePath);
      type ExtractRawText = (input: {
        buffer: Buffer;
      }) => Promise<{ value: string }>;
      const mod = (await import("mammoth")) as unknown as {
        extractRawText?: ExtractRawText;
        default?: { extractRawText: ExtractRawText };
      };
      const extractRawText = mod.extractRawText ?? mod.default?.extractRawText;
      if (!extractRawText) return "";
      const { value } = await extractRawText({ buffer });
      return (value ?? "").trim();
    }

    // .doc (legacy binary) and any other type: not supported for text extraction.
    return "";
  } catch (err) {
    console.warn(
      "[careerflow] extractTextFromFile failed for",
      filePath,
      "-",
      err instanceof Error ? err.message : err,
    );
    return "";
  }
}
