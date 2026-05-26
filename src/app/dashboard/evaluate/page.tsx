// CAREERFLOW: Phase 2 — /dashboard/evaluate. Standalone JD evaluation surface.
// CAREERFLOW: redesign (PR D) — page header + max-width container.

import { Metadata } from "next";
import EvaluatePanel from "@/components/evaluate/EvaluatePanel";

export const metadata: Metadata = {
  title: "Evaluate JD",
};

export default function EvaluatePage() {
  return (
    <div className="col-span-3 mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          AI Tools
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Evaluate &amp; Tailor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a job description to grade it — or run Match &amp; Tailor to turn
          it into a tracked application, scored against a base resume with a
          tailored version generated in one step.
        </p>
      </header>
      <EvaluatePanel />
    </div>
  );
}
