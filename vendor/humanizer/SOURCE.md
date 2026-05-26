# Vendored: humanizer

These files are vendored **verbatim** from the open-source `humanizer` skill and
used by CareerFlow's AI draft generators (reply + follow-up) to make drafts read
as human-written rather than AI-generated.

- **Source:** https://github.com/nbjiragale/humanizer
  (a fork of https://github.com/blader/humanizer)
- **Pinned commit:** `8b3a17889fbf12bedae20974a3c9f9de746ed754`
- **License:** MIT (see `LICENSE` in this directory)
- **Skill version:** 2.5.1 (per `SKILL.md` frontmatter)
- **Upstream basis:** Wikipedia "Signs of AI writing" (WikiProject AI Cleanup)

`SKILL.md` is the source of truth: `src/lib/ai/prompts/humanizer/index.ts` reads
it at runtime and injects its content into the draft system prompts. Do not edit
these files by hand — to update, re-pull from upstream and bump the commit above.
