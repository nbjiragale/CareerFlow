// CAREERFLOW: Phase 1 — paginated thread list with optional inline label
// correction. Used by both the All Threads and Needs Review tabs.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";

import GmailThreadRow, { type ThreadRow } from "./GmailThreadRow";

interface GmailThreadListProps {
  needsReview?: boolean;
  allowCorrection?: boolean;
  emptyMessage: string;
}

interface ThreadsResponse {
  threads: ThreadRow[];
  nextCursor: string | null;
}

function GmailThreadList({
  needsReview,
  allowCorrection,
  emptyMessage,
}: GmailThreadListProps) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (resetCursor: string | null) => {
      const params = new URLSearchParams();
      if (needsReview) params.set("needsReview", "true");
      if (resetCursor) params.set("cursor", resetCursor);
      params.set("limit", "25");
      const res = await fetch(`/api/gmail/threads?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ThreadsResponse;
    },
    [needsReview],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage(null);
      setThreads(data.threads);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't load threads",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(cursor);
      setThreads((prev) => [...prev, ...data.threads]);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't load more",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCorrected = (updated: ThreadRow) => {
    if (needsReview && !updated.needsReview) {
      // Drop it from the Needs Review tab once corrected.
      setThreads((prev) => prev.filter((t) => t.id !== updated.id));
      return;
    }
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading threads…
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {threads.map((t) => (
        <GmailThreadRow
          key={t.id}
          thread={t}
          allowCorrection={allowCorrection}
          onCorrected={handleCorrected}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default GmailThreadList;
