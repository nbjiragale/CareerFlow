// CAREERFLOW: redesign — Applications Kanban board. Groups job cards into the
// design's pipeline stages. Read-only for now (cards link to the detail page);
// drag-and-drop is deferred (see docs/redesign-plan.md §7).
"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";

import LogoMark from "../design/LogoMark";
import MatchBar from "../design/MatchBar";
import GradeChip from "../design/GradeChip";

export interface BoardJobCard {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  matchScore: number | null;
  grade: string | null;
  source: string | null;
  createdAt: Date | string;
}

interface BoardColumn {
  key: string;
  label: string;
  statuses: string[];
  color: string;
}

// The board's six pipeline columns map 1:1 to the seeded JobStatus values
// (wishlist/applied/screening/interview/offer/rejected). Legacy statuses, which
// have no column of their own, fold into the nearest stage so no job disappears
// from the board: `draft` (pre-application) -> Wishlist, `expired`/`archived` ->
// Rejected. See docs/redesign-plan.md §5.
const COLUMNS: BoardColumn[] = [
  { key: "wishlist", label: "Wishlist", statuses: ["wishlist", "draft"], color: "var(--st-wishlist)" },
  { key: "applied", label: "Applied", statuses: ["applied"], color: "var(--st-applied)" },
  { key: "screening", label: "Screening", statuses: ["screening"], color: "var(--st-screening)" },
  { key: "interview", label: "Interview", statuses: ["interview"], color: "var(--st-interview)" },
  { key: "offer", label: "Offer", statuses: ["offer"], color: "var(--st-offer)" },
  { key: "rejected", label: "Rejected", statuses: ["rejected", "expired", "archived"], color: "var(--st-rejected)" },
];

function age(date: Date | string): string {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" months", "mo")
      .replace(" month", "mo");
  } catch {
    return "";
  }
}

export default function ApplicationsBoard({ jobs }: { jobs: BoardJobCard[] }) {
  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: jobs.filter((j) => col.statuses.includes(j.status?.toLowerCase?.())),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {grouped.map((col) => (
        <div key={col.key} className="flex w-[280px] flex-none flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: col.color }}
            />
            <span className="text-sm font-medium">{col.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {col.items.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {col.items.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/myjobs/${job.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start gap-2.5">
                  <LogoMark name={job.company || job.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  {job.grade ? <GradeChip grade={job.grade} /> : null}
                </div>

                {job.matchScore != null && <MatchBar value={job.matchScore} />}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">{job.source ?? "—"}</span>
                  <span className="tabular-nums">{age(job.createdAt)}</span>
                </div>
              </Link>
            ))}
            {col.items.length === 0 && (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
