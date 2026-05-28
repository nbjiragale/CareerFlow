// CAREERFLOW: shared "live progress" panel shown while an LLM request is in
// flight. The phases are client-side and time-driven — a non-blocking progress
// affordance, not real streamed events — so a long round-trip doesn't make the
// UI look frozen. Callers pass the phase labels and the active index; the panel
// renders the active phase, a checklist, and an elapsed-seconds counter.
"use client";

import { useEffect, useState } from "react";
import { Check, Circle, CircleDot, Loader2 } from "lucide-react";

export const AI_PROGRESS_PHASE_MS = 1_400;

/**
 * Advance through `phaseCount` phases on a fixed interval while `active`,
 * stopping on (and holding) the final phase rather than looping. Returns the
 * current phase index and a setter to reset it (call on each new request).
 */
export function useAiProgressPhase(active: boolean, phaseCount: number) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setPhaseIndex((prev) => (prev < phaseCount - 1 ? prev + 1 : prev));
    }, AI_PROGRESS_PHASE_MS);
    return () => window.clearInterval(id);
  }, [active, phaseCount]);

  return [phaseIndex, setPhaseIndex] as const;
}

interface AiProgressStatusProps {
  phases: string[];
  currentIndex: number;
  startedAt: number | null;
}

export function AiProgressStatus({
  phases,
  currentIndex,
  startedAt,
}: AiProgressStatusProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    setElapsedMs(Date.now() - startedAt);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const safeIndex = Math.min(Math.max(currentIndex, 0), phases.length - 1);
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm animate-in fade-in duration-300"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium">{phases[safeIndex]}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {elapsedSeconds}s
        </span>
      </div>
      <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
        {phases.map((phase, idx) => {
          const status =
            idx < safeIndex ? "done" : idx === safeIndex ? "active" : "pending";
          const Icon =
            status === "done" ? Check : status === "active" ? CircleDot : Circle;
          return (
            <li
              key={phase}
              className={`flex items-center gap-2 ${
                status === "active"
                  ? "text-foreground"
                  : status === "done"
                    ? "opacity-60 line-through"
                    : "opacity-50"
              }`}
            >
              <Icon
                className={`h-3 w-3 flex-none ${
                  status === "active" ? "text-primary" : ""
                }`}
              />
              <span>{phase}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
