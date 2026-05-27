// CAREERFLOW: tests for extractTextFromFile. The unsupported-extension path
// returns "" without touching the filesystem; parse failures degrade to "".

import { describe, expect, it } from "vitest";
import { extractTextFromFile } from "@/lib/files/extract-text";

describe("extractTextFromFile", () => {
  it("returns empty string for legacy .doc (unsupported)", async () => {
    expect(await extractTextFromFile("/data/resume.doc", "resume.doc")).toBe("");
  });

  it("returns empty string for unknown extensions", async () => {
    expect(await extractTextFromFile("/data/notes.txt")).toBe("");
  });

  it("never throws on a missing PDF file (degrades to empty)", async () => {
    const out = await extractTextFromFile(
      "/data/does-not-exist.pdf",
      "does-not-exist.pdf",
    );
    expect(out).toBe("");
  });
});
