// CAREERFLOW: Phase 3 (PR #9) — render tests for the analytics tiles.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub the Nivo chart so jsdom (no layout) doesn't choke on ResponsiveBar.
vi.mock("@nivo/bar", () => ({ ResponsiveBar: () => null }));

import ResponseRateTile from "@/components/dashboard/ResponseRateTile";
import FunnelTile from "@/components/dashboard/FunnelTile";
import AiSpendTile from "@/components/dashboard/AiSpendTile";

describe("ResponseRateTile", () => {
  it("renders rates when there is data", () => {
    render(
      <ResponseRateTile
        data={[
          { windowDays: 30, appliedCount: 4, respondedCount: 1, rate: 25 },
          { windowDays: 60, appliedCount: 4, respondedCount: 2, rate: 50 },
          { windowDays: 90, appliedCount: 4, respondedCount: 3, rate: 75 },
        ]}
      />,
    );
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("shows an empty state when there are no applied emails", () => {
    render(
      <ResponseRateTile
        data={[{ windowDays: 30, appliedCount: 0, respondedCount: 0, rate: 0 }]}
      />,
    );
    expect(screen.getByText(/No application emails/i)).toBeInTheDocument();
  });
});

describe("FunnelTile", () => {
  it("renders stage counts when there is data", () => {
    render(
      <FunnelTile
        data={[
          { stage: "applied", label: "Applied", count: 5 },
          { stage: "interview", label: "Interview", count: 3 },
          { stage: "offer", label: "Offer", count: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows an empty state when all stages are zero", () => {
    render(
      <FunnelTile
        data={[
          { stage: "applied", label: "Applied", count: 0 },
          { stage: "interview", label: "Interview", count: 0 },
          { stage: "offer", label: "Offer", count: 0 },
        ]}
      />,
    );
    expect(screen.getByText(/No jobs yet/i)).toBeInTheDocument();
  });
});

describe("AiSpendTile", () => {
  it("renders the spend when there are calls", () => {
    render(<AiSpendTile totalUsd={1.5} calls={12} />);
    expect(screen.getByText("$1.50")).toBeInTheDocument();
    expect(screen.getByText(/12 calls/i)).toBeInTheDocument();
  });

  it("shows an empty state when there is no usage", () => {
    render(<AiSpendTile totalUsd={0} calls={0} />);
    expect(screen.getByText(/No AI usage/i)).toBeInTheDocument();
  });
});
