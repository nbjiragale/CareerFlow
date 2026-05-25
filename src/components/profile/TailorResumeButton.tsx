"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wand2, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "../ui/use-toast";
import { getResumeList } from "@/actions/profile.actions";
import type { Resume } from "@/models/profile.model";

interface TailorResult {
  newResumeId: string;
  newResumeTitle: string;
  tailored: { notes?: string[] };
}

export function TailorResumeButton({
  jobId,
  defaultResumeId,
}: {
  jobId: string;
  defaultResumeId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>(
    defaultResumeId ?? undefined,
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TailorResult | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await getResumeList(1, 100);
      if (res?.success && res.data) {
        setResumes(res.data as Resume[]);
        if (!selectedResumeId && res.data.length > 0) {
          setSelectedResumeId(res.data[0].id);
        }
      }
    })();
  }, [open, selectedResumeId]);

  const runTailor = useCallback(async () => {
    if (!selectedResumeId) {
      toast({
        variant: "destructive",
        title: "Pick a resume",
        description: "Select which resume to tailor first.",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: selectedResumeId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Tailor failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setResult(data as TailorResult);
      toast({
        variant: "success",
        title: "Tailored resume ready",
        description: data.newResumeTitle,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Tailor failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [jobId, selectedResumeId]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Wand2 className="h-3.5 w-3.5" /> Tailor to JD
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tailor resume to this JD</DialogTitle>
            <DialogDescription>
              The AI rewrites your Summary and each experience&apos;s bullets to
              emphasize JD-relevant skills, then saves the result as a NEW
              resume version. Your original resume is not modified.
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">
                Source resume
                <Select
                  value={selectedResumeId}
                  onValueChange={setSelectedResumeId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a resume…" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id!}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <p className="text-xs text-muted-foreground">
                The new resume will be linked to this job automatically.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Created <span className="font-medium">{result.newResumeTitle}</span>.
                It&apos;s now attached to this job.
              </p>
              {result.tailored.notes && result.tailored.notes.length > 0 ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {result.tailored.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              ) : null}
              <Link
                href={`/dashboard/profile/resume/${result.newResumeId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open tailored resume
              </Link>
            </div>
          )}

          <DialogFooter>
            {!result ? (
              <Button
                type="button"
                onClick={runTailor}
                disabled={loading || !selectedResumeId}
                className="gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {loading ? "Tailoring…" : "Tailor with AI"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setOpen(false);
                }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TailorResumeButton;
