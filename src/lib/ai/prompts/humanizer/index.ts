// CAREERFLOW: humanizer integration. Loads the ACTUAL vendored open-source
// "humanizer" skill (vendor/humanizer/SKILL.md — github.com/nbjiragale/humanizer,
// a fork of blader/humanizer, MIT, pinned in vendor/humanizer/SOURCE.md) and
// injects its real content into the reply-draft and follow-up-draft system
// prompts. This is the verbatim skill text, not a summary — the file is the
// source of truth and is read at runtime.
//
// The skill itself is an interactive, multi-pass Claude Code skill. We use it
// single-pass: its rules become a style reference inside one schema-bound draft
// call, so we strip the YAML frontmatter and tell the model to apply the
// principles to a short email and return only the final draft.

import "server-only";

import fs from "node:fs";
import path from "node:path";

function loadVendoredSkill(): string {
  const skillPath = path.join(
    process.cwd(),
    "vendor",
    "humanizer",
    "SKILL.md",
  );
  const raw = fs.readFileSync(skillPath, "utf8");
  // Drop the YAML frontmatter (name/version/allowed-tools/etc.) — metadata, not
  // writing guidance. Everything after it is kept verbatim.
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

// The verbatim body of the vendored SKILL.md (frontmatter removed).
export const HUMANIZER_SKILL = loadVendoredSkill();

// The block appended to the draft system prompts. Frames the verbatim skill for
// our single-pass, schema-bound email use.
export const HUMANIZER_GUIDANCE = `# Humanize this email (open-source "humanizer" skill, MIT)

Apply the humanization guide below so the email reads as human-written, not AI-generated. It was written for general prose — adapt it to a short email: ignore patterns about article headings, sections, and long-form structure, but strictly avoid the AI vocabulary, copula avoidance, rule-of-three, negative parallelism, em-dash overuse, hedging, promotional language, and chatbot artifacts it describes.

IMPORTANT: Do not output an analysis, multiple drafts, before/after comparisons, or the guide's interactive "what makes this AI" steps. Produce only the final email, matching the required schema.

--- BEGIN HUMANIZER GUIDE ---
${HUMANIZER_SKILL}
--- END HUMANIZER GUIDE ---`;
