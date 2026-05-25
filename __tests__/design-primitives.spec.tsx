// CAREERFLOW: redesign — render tests for the design-system primitives.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import StatusPill from "@/components/design/StatusPill";
import GradeChip from "@/components/design/GradeChip";
import MatchBar from "@/components/design/MatchBar";
import LogoMark from "@/components/design/LogoMark";
import Sparkline from "@/components/design/Sparkline";

describe("StatusPill", () => {
  it("renders the label with the status tint class", () => {
    const { container } = render(<StatusPill status="interview" />);
    expect(screen.getByText("interview")).toBeInTheDocument();
    expect(container.querySelector(".pill-interview")).toBeTruthy();
  });
});

describe("GradeChip", () => {
  it("renders the grade letter with its class", () => {
    const { container } = render(<GradeChip grade="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(container.querySelector(".grade-a")).toBeTruthy();
  });
  it("renders nothing when grade is missing", () => {
    const { container } = render(<GradeChip grade={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("MatchBar", () => {
  it("renders the clamped percentage", () => {
    render(<MatchBar value={92} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });
  it("renders nothing when value is null", () => {
    const { container } = render(<MatchBar value={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("LogoMark", () => {
  it("renders initials from a company name", () => {
    render(<LogoMark name="Vercel Labs" />);
    expect(screen.getByText("VL")).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("renders an svg for a data series", () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 6, 3]} />);
    expect(container.querySelector("svg polyline")).toBeTruthy();
  });
});
