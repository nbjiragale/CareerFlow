"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreateResume from "./CreateResume";
import CreateCoverLetter from "./CreateCoverLetter";
import { Card, CardContent, CardHeader } from "../ui/card";
import { getResumeList } from "@/actions/profile.actions";
import { getCoverLetterList } from "@/actions/coverLetter.actions";
import {
  CoverLetter,
  ProfileDocument,
  Resume,
} from "@/models/profile.model";
import { APP_CONSTANTS } from "@/lib/constants";
import Loading from "../Loading";
import DocumentTable from "./ResumeTable";
import { toast } from "../ui/use-toast";
import { ChevronDown, PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { RecordsPerPageSelector } from "../RecordsPerPageSelector";
import { RecordsCount } from "../RecordsCount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
// CAREERFLOW: redesign (PR E) — surface the Resumes page name + a
// presentational filter chip strip (All / Resumes / Cover letters).
import SegmentedControl, {
  type SegmentOption,
} from "@/components/design/SegmentedControl";

type ResumesFilter = "all" | "resume" | "cover-letter";

const FILTER_OPTIONS: SegmentOption<ResumesFilter>[] = [
  { value: "all", label: "All" },
  { value: "resume", label: "Resumes" },
  { value: "cover-letter", label: "Cover letters" },
];

const ProfileContainer = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [coverLetterDialogOpen, setCoverLetterDialogOpen] = useState(false);

  const [resumeToEdit, setResumeToEdit] = useState<Resume | null>(null);
  const [coverLetterToEdit, setCoverLetterToEdit] =
    useState<CoverLetter | null>(null);
  const [totalResumes, setTotalResumes] = useState<number>(0);
  const [totalCoverLetters, setTotalCoverLetters] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(
    APP_CONSTANTS.RECORDS_PER_PAGE,
  );

  const loadResumes = useCallback(
    async (page: number) => {
      const { data, total, success, message } = await getResumeList(
        page,
        recordsPerPage,
      );
      if (success && data) {
        setResumes((prev) => (page === 1 ? data : [...prev, ...data]));
        setTotalResumes(total);
        setPage(page);
      } else {
        toast({
          variant: "destructive",
          title: "Error!",
          description: message,
        });
      }
    },
    [recordsPerPage],
  );

  const loadCoverLetters = useCallback(async () => {
    const { data, total, success, message } = await getCoverLetterList(
      1,
      100,
    );
    if (success && data) {
      setCoverLetters(data);
      setTotalCoverLetters(total);
    } else {
      toast({
        variant: "destructive",
        title: "Error!",
        description: message,
      });
    }
  }, []);

  const loadDocuments = useCallback(
    async (page: number) => {
      setLoading(true);
      await Promise.all([loadResumes(page), loadCoverLetters()]);
      setLoading(false);
    },
    [loadResumes, loadCoverLetters],
  );

  const reloadDocuments = useCallback(async () => {
    await loadDocuments(1);
  }, [loadDocuments]);

  useEffect(() => {
    (async () => await loadDocuments(1))();
  }, [loadDocuments, recordsPerPage]);

  const documents: ProfileDocument[] = useMemo(() => {
    const resumeDocs: ProfileDocument[] = resumes.map((r) => ({
      id: r.id!,
      title: r.title,
      type: "resume" as const,
      createdAt: r.createdAt!,
      updatedAt: r.updatedAt!,
      jobCount: r._count?.Job ?? 0,
      FileId: r.FileId,
    }));
    const coverLetterDocs: ProfileDocument[] = coverLetters.map((cl) => ({
      id: cl.id!,
      title: cl.title,
      type: "cover-letter" as const,
      createdAt: cl.createdAt!,
      updatedAt: cl.updatedAt!,
      jobCount: cl._count?.Job ?? 0,
      content: cl.content,
    }));
    return [...resumeDocs, ...coverLetterDocs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [resumes, coverLetters]);

  const totalDocuments = totalResumes + totalCoverLetters;

  // CAREERFLOW: redesign (PR E) — presentational filter over the already
  // loaded `documents` array. No server-side change.
  const [filter, setFilter] = useState<ResumesFilter>("all");
  const visibleDocuments = useMemo(
    () =>
      filter === "all"
        ? documents
        : documents.filter((d) => d.type === filter),
    [documents, filter],
  );
  const jobsCovered = useMemo(
    () => documents.reduce((sum, d) => sum + (d.jobCount ?? 0), 0),
    [documents],
  );

  const createResume = () => {
    setResumeToEdit(null);
    setResumeDialogOpen(true);
  };

  const createCoverLetter = () => {
    setCoverLetterToEdit(null);
    setCoverLetterDialogOpen(true);
  };

  const onEditResume = (doc: ProfileDocument) => {
    setResumeToEdit({
      id: doc.id,
      title: doc.title,
      FileId: doc.FileId,
    });
    setResumeDialogOpen(true);
  };

  const onEditCoverLetter = (doc: ProfileDocument) => {
    setCoverLetterToEdit({
      id: doc.id,
      title: doc.title,
      content: doc.content ?? "",
    });
    setCoverLetterDialogOpen(true);
  };

  // CAREERFLOW: redesign (PR E) — summary line per mockup:
  // "N versions · X resumes, Y cover letters · used across K applications".
  const summary = (() => {
    if (loading && documents.length === 0) return "Loading documents…";
    if (documents.length === 0) {
      return "No documents yet — add your first resume or cover letter.";
    }
    const versions = `${totalDocuments} version${totalDocuments === 1 ? "" : "s"}`;
    const mix = `${totalResumes} resume${totalResumes === 1 ? "" : "s"}, ${totalCoverLetters} cover letter${totalCoverLetters === 1 ? "" : "s"}`;
    const coverage = `used across ${jobsCovered} application${jobsCovered === 1 ? "" : "s"}`;
    return `${versions} · ${mix} · ${coverage}`;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* CAREERFLOW: redesign (PR E) — page-level header outside the card so
          the title doesn't compete with the table header for visual weight. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Resumes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl<ResumesFilter>
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  New
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={createResume}
              >
                Add New Resume
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={createCoverLetter}
              >
                Add New Cover Letter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <CreateResume
            resumeDialogOpen={resumeDialogOpen}
            setResumeDialogOpen={setResumeDialogOpen}
            reloadResumes={reloadDocuments}
            resumeToEdit={resumeToEdit}
          />
          <CreateCoverLetter
            dialogOpen={coverLetterDialogOpen}
            setDialogOpen={setCoverLetterDialogOpen}
            coverLetterToEdit={coverLetterToEdit}
            reloadDocuments={reloadDocuments}
          />
        </div>
      </div>
      <Card className="density-card p-0">
        <CardHeader className="density-card-header sr-only">
          <span>Documents</span>
        </CardHeader>
        <CardContent className="density-card-content p-0 pt-0">
          {loading && documents.length === 0 && <Loading />}
          {visibleDocuments.length > 0 ? (
            <>
              <DocumentTable
                documents={visibleDocuments}
                editResume={onEditResume}
                editCoverLetter={onEditCoverLetter}
                reloadDocuments={reloadDocuments}
              />
              <div className="flex items-center justify-between mt-4 p-4">
                <RecordsCount
                  count={visibleDocuments.length}
                  total={
                    filter === "all"
                      ? totalDocuments
                      : visibleDocuments.length
                  }
                  label="documents"
                />
                {totalDocuments > APP_CONSTANTS.RECORDS_PER_PAGE && (
                  <RecordsPerPageSelector
                    value={recordsPerPage}
                    onChange={setRecordsPerPage}
                  />
                )}
              </div>
            </>
          ) : (
            !loading && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {filter === "all"
                  ? "No documents yet — add your first resume or cover letter."
                  : filter === "resume"
                    ? "No resumes match this filter."
                    : "No cover letters match this filter."}
              </div>
            )
          )}
          {resumes.length < totalResumes && (
            <div className="flex justify-center p-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadDocuments(page + 1)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileContainer;
