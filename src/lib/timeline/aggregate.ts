// CAREERFLOW: Phase 3 — unified per-job timeline. Merges three independent
// sources (Activity, EmailThread, AiDraft) into one chronological stream.
//
// The mappers are pure and structurally typed so they can be unit-tested
// without Prisma. The route (src/app/api/jobs/[id]/timeline/route.ts) fetches
// each source scoped to the job + user, maps, sorts (occurredAt DESC), and
// paginates in-memory with an opaque cursor.

import "server-only";

export type TimelineEventSource = "activity" | "email" | "ai_draft";

export interface TimelineEvent {
  // Globally unique within the stream: "<source>:<rowId>". Used as the
  // pagination tiebreaker so the order is stable across inserts.
  id: string;
  source: TimelineEventSource;
  // Source-specific subtype: Activity.source, EmailThread.label, AiDraft.draftType.
  kind: string;
  title: string;
  description: string | null;
  occurredAt: string; // ISO-8601 UTC
  metadata: Record<string, unknown>;
}

// Minimal structural shapes — a subset of each Prisma row. Keeping these local
// avoids coupling the aggregator to the generated Prisma types.
export interface ActivityRow {
  id: string;
  activityName: string;
  description?: string | null;
  source?: string | null;
  metadataJson?: string | null;
  startTime: Date | string;
}

export interface EmailThreadRow {
  id: string;
  label: string;
  confidence: number;
  subject: string;
  snippet: string;
  fromAddress: string;
  receivedAt: Date | string;
}

export interface AiDraftRow {
  id: string;
  draftType: string;
  subject?: string | null;
  content: string;
  createdAt: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function fromActivity(row: ActivityRow): TimelineEvent {
  let metadata: Record<string, unknown> = {};
  if (row.metadataJson) {
    try {
      const parsed = JSON.parse(row.metadataJson);
      if (parsed && typeof parsed === "object") {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      metadata = {};
    }
  }
  return {
    id: `activity:${row.id}`,
    source: "activity",
    kind: row.source || "manual",
    title: row.activityName,
    description: row.description ?? null,
    occurredAt: toIso(row.startTime),
    metadata,
  };
}

export function fromEmailThread(row: EmailThreadRow): TimelineEvent {
  return {
    id: `email:${row.id}`,
    source: "email",
    kind: row.label,
    title: row.subject,
    description: row.snippet,
    occurredAt: toIso(row.receivedAt),
    metadata: {
      emailThreadId: row.id,
      fromAddress: row.fromAddress,
      label: row.label,
      confidence: row.confidence,
    },
  };
}

export function fromAiDraft(row: AiDraftRow): TimelineEvent {
  return {
    id: `ai_draft:${row.id}`,
    source: "ai_draft",
    kind: row.draftType,
    title: row.subject ?? `AI ${row.draftType} draft`,
    description: row.content,
    occurredAt: toIso(row.createdAt),
    metadata: {
      aiDraftId: row.id,
      draftType: row.draftType,
    },
  };
}

// DESC by occurredAt; ties broken by id DESC so equal-timestamp rows keep a
// deterministic order (required for stable cursor pagination).
export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) {
      return a.occurredAt < b.occurredAt ? 1 : -1;
    }
    if (a.id !== b.id) {
      return a.id < b.id ? 1 : -1;
    }
    return 0;
  });
}

export interface DecodedCursor {
  occurredAt: string;
  id: string;
}

export function encodeCursor(event: TimelineEvent): string {
  return Buffer.from(`${event.occurredAt}|${event.id}`, "utf-8").toString("base64url");
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const sep = raw.indexOf("|");
    if (sep === -1) return null;
    return { occurredAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
  } catch {
    return null;
  }
}

export interface TimelinePage {
  events: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Paginates an already-sorted (DESC) list. The cursor points at the last event
// of the previous page; we return the events strictly after it in DESC order.
export function paginateTimeline(
  sorted: TimelineEvent[],
  limit: number,
  cursor?: string | null,
): TimelinePage {
  let start = 0;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const idx = sorted.findIndex(
        (e) =>
          e.occurredAt < decoded.occurredAt ||
          (e.occurredAt === decoded.occurredAt && e.id < decoded.id),
      );
      start = idx === -1 ? sorted.length : idx;
    }
  }

  const events = sorted.slice(start, start + limit);
  const hasMore = start + limit < sorted.length;
  const nextCursor =
    hasMore && events.length > 0 ? encodeCursor(events[events.length - 1]) : null;

  return { events, nextCursor, hasMore };
}
