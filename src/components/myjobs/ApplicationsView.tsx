// CAREERFLOW: redesign — Applications page: header + Board/Table toggle. Board
// is the new Kanban view; Table is the existing JobsContainer (unchanged).
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Search, Table2 } from "lucide-react";

import SegmentedControl from "../design/SegmentedControl";
import ApplicationsBoard, { type BoardJobCard } from "./ApplicationsBoard";
import JobsContainer from "./JobsContainer";
import { AddJob } from "./AddJob";
import { Input } from "../ui/input";
import type {
  Company,
  JobLocation,
  JobSource,
  JobStatus,
  JobTitle,
  Tag,
} from "@/models/job.model";

type View = "board" | "table";

interface Props {
  boardJobs: BoardJobCard[];
  statuses: JobStatus[];
  companies: Company[];
  titles: JobTitle[];
  locations: JobLocation[];
  sources: JobSource[];
  tags: Tag[];
}

export default function ApplicationsView({
  boardJobs,
  statuses,
  companies,
  titles,
  locations,
  sources,
  tags,
}: Props) {
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // CAREERFLOW: the Topbar "Add" button deep-links here with ?new=1. Open the
  // Add Job dialog and strip the param so a later "Add" click re-triggers it.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      router.replace("/dashboard/myjobs");
    }
  }, [searchParams, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boardJobs;
    return boardJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q),
    );
  }, [boardJobs, query]);

  return (
    <div className="col-span-3 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {boardJobs.length} application{boardJobs.length === 1 ? "" : "s"} ·
            tracking across 6 stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl<View>
            value={view}
            onChange={setView}
            options={[
              {
                value: "board",
                label: "Board",
                icon: <LayoutGrid className="h-3.5 w-3.5" />,
              },
              {
                value: "table",
                label: "Table",
                icon: <Table2 className="h-3.5 w-3.5" />,
              },
            ]}
          />
          <AddJob
            jobStatuses={statuses}
            companies={companies}
            jobTitles={titles}
            locations={locations}
            jobSources={sources}
            tags={tags}
            editJob={null}
            resetEditJob={() => {}}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
        </div>
      </div>

      {view === "board" ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search company or role…"
              className="h-9 pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ApplicationsBoard jobs={filtered} />
        </>
      ) : (
        <JobsContainer
          statuses={statuses}
          companies={companies}
          titles={titles}
          locations={locations}
          sources={sources}
          tags={tags}
        />
      )}
    </div>
  );
}
