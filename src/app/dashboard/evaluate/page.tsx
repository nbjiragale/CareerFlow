// CAREERFLOW: Phase 2 — /dashboard/evaluate. Standalone JD evaluation surface.

import { Metadata } from "next";
import EvaluatePanel from "@/components/evaluate/EvaluatePanel";

export const metadata: Metadata = {
  title: "Evaluate JD",
};

export default function EvaluatePage() {
  return (
    <div className="col-span-3">
      <EvaluatePanel />
    </div>
  );
}
