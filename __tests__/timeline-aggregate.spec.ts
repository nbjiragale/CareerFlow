// CAREERFLOW: Phase 3 — unit tests for the unified timeline aggregator.

import { describe, expect, it } from "vitest";

import {
  decodeCursor,
  encodeCursor,
  fromActivity,
  fromAiDraft,
  fromEmailThread,
  paginateTimeline,
  sortTimelineEvents,
  type TimelineEvent,
} from "@/lib/timeline/aggregate";

describe("timeline mappers", () => {
  it("maps an Activity row, parsing metadataJson", () => {
    const event = fromActivity({
      id: "a1",
      activityName: "Applied via referral",
      description: "note",
      source: "scheduler",
      metadataJson: '{"jobId":"j1","foo":42}',
      startTime: "2026-01-01T10:00:00.000Z",
    });
    expect(event.id).toBe("activity:a1");
    expect(event.source).toBe("activity");
    expect(event.kind).toBe("scheduler");
    expect(event.title).toBe("Applied via referral");
    expect(event.occurredAt).toBe("2026-01-01T10:00:00.000Z");
    expect(event.metadata).toEqual({ jobId: "j1", foo: 42 });
  });

  it("defaults Activity kind to manual and tolerates bad metadata", () => {
    const event = fromActivity({
      id: "a2",
      activityName: "x",
      metadataJson: "not json",
      startTime: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(event.kind).toBe("manual");
    expect(event.metadata).toEqual({});
  });

  it("maps an EmailThread row", () => {
    const event = fromEmailThread({
      id: "t1",
      label: "Interview",
      confidence: 0.91,
      subject: "Next steps",
      snippet: "We'd love to chat",
      fromAddress: "recruiter@acme.com",
      receivedAt: "2026-01-03T12:00:00.000Z",
    });
    expect(event.id).toBe("email:t1");
    expect(event.source).toBe("email");
    expect(event.kind).toBe("Interview");
    expect(event.title).toBe("Next steps");
    expect(event.metadata).toMatchObject({
      emailThreadId: "t1",
      fromAddress: "recruiter@acme.com",
      confidence: 0.91,
    });
  });

  it("maps an AiDraft row and falls back to a synthetic title", () => {
    const withSubject = fromAiDraft({
      id: "d1",
      draftType: "reply",
      subject: "Re: Next steps",
      content: "Hi there",
      createdAt: "2026-01-04T09:00:00.000Z",
    });
    expect(withSubject.id).toBe("ai_draft:d1");
    expect(withSubject.title).toBe("Re: Next steps");

    const noSubject = fromAiDraft({
      id: "d2",
      draftType: "follow-up",
      content: "Following up",
      createdAt: "2026-01-04T09:00:00.000Z",
    });
    expect(noSubject.title).toBe("AI follow-up draft");
  });
});

describe("sortTimelineEvents", () => {
  it("sorts by occurredAt DESC with id DESC tiebreak", () => {
    const events: TimelineEvent[] = [
      mk("a:1", "2026-01-01T00:00:00.000Z"),
      mk("a:3", "2026-01-03T00:00:00.000Z"),
      mk("a:2a", "2026-01-02T00:00:00.000Z"),
      mk("a:2b", "2026-01-02T00:00:00.000Z"),
    ];
    const sorted = sortTimelineEvents(events).map((e) => e.id);
    expect(sorted).toEqual(["a:3", "a:2b", "a:2a", "a:1"]);
  });

  it("does not mutate the input", () => {
    const events = [mk("a:1", "2026-01-01T00:00:00.000Z"), mk("a:2", "2026-01-02T00:00:00.000Z")];
    const copy = [...events];
    sortTimelineEvents(events);
    expect(events).toEqual(copy);
  });
});

describe("cursor + pagination", () => {
  it("round-trips a cursor", () => {
    const event = mk("email:abc", "2026-01-05T00:00:00.000Z");
    const decoded = decodeCursor(encodeCursor(event));
    expect(decoded).toEqual({ occurredAt: "2026-01-05T00:00:00.000Z", id: "email:abc" });
  });

  it("returns null when the decoded cursor has no separator", () => {
    expect(decodeCursor(Buffer.from("nopipe", "utf-8").toString("base64url"))).toBeNull();
  });

  it("paginates a sorted list and exposes the next cursor", () => {
    const sorted = sortTimelineEvents([
      mk("a:1", "2026-01-01T00:00:00.000Z"),
      mk("a:2", "2026-01-02T00:00:00.000Z"),
      mk("a:3", "2026-01-03T00:00:00.000Z"),
      mk("a:4", "2026-01-04T00:00:00.000Z"),
      mk("a:5", "2026-01-05T00:00:00.000Z"),
    ]);

    const first = paginateTimeline(sorted, 2);
    expect(first.events.map((e) => e.id)).toEqual(["a:5", "a:4"]);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).not.toBeNull();

    const second = paginateTimeline(sorted, 2, first.nextCursor);
    expect(second.events.map((e) => e.id)).toEqual(["a:3", "a:2"]);
    expect(second.hasMore).toBe(true);

    const third = paginateTimeline(sorted, 2, second.nextCursor);
    expect(third.events.map((e) => e.id)).toEqual(["a:1"]);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeNull();
  });

  it("handles the empty case", () => {
    const page = paginateTimeline([], 20);
    expect(page.events).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

function mk(id: string, occurredAt: string): TimelineEvent {
  return {
    id,
    source: "activity",
    kind: "manual",
    title: id,
    description: null,
    occurredAt,
    metadata: {},
  };
}
