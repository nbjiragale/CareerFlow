// CAREERFLOW: tests for resolveResumeText / preprocessResumeWithFile — the
// fallback that lets AI features read uploaded resume files, not just
// structured sections.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: { file: { update: vi.fn() } },
}));
vi.mock("@/lib/files/extract-text", () => ({
  extractTextFromFile: vi.fn(),
}));

import db from "@/lib/db";
import { extractTextFromFile } from "@/lib/files/extract-text";
import {
  resolveResumeText,
  preprocessResumeWithFile,
} from "@/lib/ai/resume-text";

const mc = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const fileUpdate = mc((db as unknown as { file: { update: unknown } }).file.update);
const extract = mc(extractTextFromFile);

const LONG_TEXT =
  "Senior Backend Engineer with 8 years building payment APIs in Go and " +
  "Postgres. Led migrations, scaled services to millions of requests, and " +
  "mentored engineers across multiple teams on distributed systems design.";

function fileResume(file: Record<string, unknown> | null) {
  return {
    id: "r1",
    title: "My Resume",
    ResumeSections: [],
    FileId: file ? "f1" : undefined,
    File: file as never,
  } as never;
}

describe("resolveResumeText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses already-extracted file text without re-parsing or writing", async () => {
    const text = await resolveResumeText(
      fileResume({
        id: "f1",
        fileName: "cv.pdf",
        filePath: "/data/cv.pdf",
        extractedText: LONG_TEXT,
        extractedAt: new Date(),
      }),
    );

    expect(text).toContain(LONG_TEXT);
    expect(text).toContain("My Resume");
    expect(extract).not.toHaveBeenCalled();
    expect(fileUpdate).not.toHaveBeenCalled();
  });

  it("lazily backfills extracted text for files that were never parsed", async () => {
    extract.mockResolvedValue(LONG_TEXT);

    const text = await resolveResumeText(
      fileResume({
        id: "f1",
        fileName: "cv.pdf",
        filePath: "/data/cv.pdf",
        extractedText: null,
        extractedAt: null,
      }),
    );

    expect(extract).toHaveBeenCalledWith("/data/cv.pdf", "cv.pdf");
    expect(text).toContain(LONG_TEXT);
    const writeArg = fileUpdate.mock.calls[0][0];
    expect(writeArg.where).toEqual({ id: "f1" });
    expect(writeArg.data.extractedText).toBe(LONG_TEXT);
    expect(writeArg.data.extractedAt).toBeInstanceOf(Date);
  });

  it("does not re-parse a file already attempted with no text", async () => {
    const text = await resolveResumeText(
      fileResume({
        id: "f1",
        fileName: "scan.pdf",
        filePath: "/data/scan.pdf",
        extractedText: null,
        extractedAt: new Date(), // already tried; image-only PDF
      }),
    );

    expect(extract).not.toHaveBeenCalled();
    // Falls back to structured conversion (title only) — too short for AI.
    expect(text).not.toContain(LONG_TEXT);
  });
});

describe("preprocessResumeWithFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds for an uploaded resume with enough extracted text", async () => {
    const result = await preprocessResumeWithFile(
      fileResume({
        id: "f1",
        fileName: "cv.pdf",
        filePath: "/data/cv.pdf",
        extractedText: LONG_TEXT,
        extractedAt: new Date(),
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.normalizedText).toContain("payment APIs");
    }
  });

  it("returns a clear empty/too-short error for a text-less uploaded file", async () => {
    const result = await preprocessResumeWithFile(
      fileResume({
        id: "f1",
        fileName: "scan.pdf",
        filePath: "/data/scan.pdf",
        extractedText: null,
        extractedAt: new Date(),
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(["NO_CONTENT", "TOO_SHORT"]).toContain(result.error.code);
    }
  });
});
