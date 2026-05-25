// CAREERFLOW: Phase 3 — unified per-job timeline. Fetches
// GET /api/jobs/:id/timeline and renders Activity + EmailThread + AiDraft
// events chronologically with cursor pagination. Renders nothing when the
// job has zero events (avoids an empty card on brand-new jobs).
"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "../ui/use-toast";
import TimelineEventRow from "./TimelineEventRow";
import type { TimelineEvent } from "@/lib/timeline/aggregate";

interface TimelineResponse {
  events: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export default function JobTimeline({ jobId }: { jobId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (nextCursor: string | null) => {
      try {
        const url = new URL(
          `/api/jobs/${jobId}/timeline`,
          window.location.origin,
        );
        if (nextCursor) url.searchParams.set("cursor", nextCursor);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TimelineResponse = await res.json();
        setEvents((prev) =>
          nextCursor ? [...prev, ...data.events] : data.events,
        );
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Couldn't load timeline",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [jobId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    load(null).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  };

  // Empty state: render nothing so new jobs aren't cluttered (D12).
  if (!loading && events.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {events.map((event) => (
                <TimelineEventRow key={event.id} event={event} />
              ))}
            </ul>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load more
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
