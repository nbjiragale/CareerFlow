// CAREERFLOW: render tests for the shared AI progress panel + phase hook.

import { describe, expect, it, vi } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";

import {
  AiProgressStatus,
  useAiProgressPhase,
  AI_PROGRESS_PHASE_MS,
} from "@/components/common/AiProgressStatus";

const PHASES = ["First phase", "Second phase", "Third phase"];

describe("AiProgressStatus", () => {
  it("renders the active phase prominently and lists every phase", () => {
    render(
      <AiProgressStatus phases={PHASES} currentIndex={1} startedAt={Date.now()} />,
    );
    // The active phase appears twice (header + checklist); others once.
    expect(screen.getAllByText("Second phase").length).toBe(2);
    for (const phase of PHASES) {
      expect(screen.getAllByText(phase).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exposes a polite live region for screen readers", () => {
    render(
      <AiProgressStatus phases={PHASES} currentIndex={0} startedAt={Date.now()} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("clamps an out-of-range index to the last phase", () => {
    render(
      <AiProgressStatus phases={PHASES} currentIndex={99} startedAt={null} />,
    );
    // Header shows the last phase rather than crashing on undefined.
    expect(screen.getAllByText("Third phase").length).toBeGreaterThanOrEqual(1);
  });
});

describe("useAiProgressPhase", () => {
  it("starts at 0 and does not advance while inactive", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAiProgressPhase(false, PHASES.length));
    expect(result.current[0]).toBe(0);
    act(() => {
      vi.advanceTimersByTime(AI_PROGRESS_PHASE_MS * 3);
    });
    expect(result.current[0]).toBe(0);
    vi.useRealTimers();
  });

  it("advances on each interval while active and holds on the last phase", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAiProgressPhase(true, PHASES.length));
    expect(result.current[0]).toBe(0);
    act(() => {
      vi.advanceTimersByTime(AI_PROGRESS_PHASE_MS);
    });
    expect(result.current[0]).toBe(1);
    act(() => {
      vi.advanceTimersByTime(AI_PROGRESS_PHASE_MS);
    });
    expect(result.current[0]).toBe(2);
    // Already on the final phase — further ticks must not overflow.
    act(() => {
      vi.advanceTimersByTime(AI_PROGRESS_PHASE_MS * 5);
    });
    expect(result.current[0]).toBe(PHASES.length - 1);
    vi.useRealTimers();
  });
});
