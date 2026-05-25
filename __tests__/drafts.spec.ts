// CAREERFLOW: Phase 2 — unit tests for src/lib/ai/drafts.ts.
//
// generateReplyDraft should:
//   - 404 / throw when the EmailThread row doesn't exist for the user
//   - Refetch the Gmail body via getAuthorizedGmail + extractEmailBody
//   - Fall back gracefully (bodyWasAvailable=false) when Gmail is disconnected
//   - Resolve provider/model from UserSettings
//   - Call generateObject with the reply-draft system prompt
//   - Persist a row into AiDraft
//   - Write a success AiAuditLog row
//   - Write an error AiAuditLog + re-throw on LLM failure
//
// listDraftsForThread should query AiDraft scoped to the user + thread, desc.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    userSettings: { findUnique: vi.fn() },
    emailThread: { findFirst: vi.fn() },
    aiDraft: { create: vi.fn(), findMany: vi.fn() },
    aiAuditLog: { create: vi.fn() },
  },
}));

vi.mock("ai", () => {
  // Mirror the real exports so the structured-output helper can branch on
  // them. isInstance must return false for unrelated errors so they
  // propagate unchanged.
  class NoObjectGeneratedError extends Error {
    static isInstance(err: unknown): err is Error {
      return err instanceof NoObjectGeneratedError;
    }
  }
  class APICallError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = "AI_APICallError";
    }
    static isInstance(err: unknown): err is APICallError {
      return err instanceof APICallError;
    }
  }
  return {
    generateObject: vi.fn(),
    generateText: vi.fn(),
    NoObjectGeneratedError,
    APICallError,
  };
});

vi.mock("@/lib/ai/providers", () => ({
  getModel: vi.fn(),
}));

vi.mock("@/lib/gmail/client", () => {
  class GmailNotConnectedError extends Error {
    constructor() {
      super("Gmail is not connected for this user.");
      this.name = "GmailNotConnectedError";
    }
  }
  return {
    GmailNotConnectedError,
    getAuthorizedGmail: vi.fn(),
  };
});

vi.mock("@/lib/gmail/body", () => ({
  extractEmailBody: vi.fn(),
}));

import db from "@/lib/db";
import {
  generateObject,
  generateText,
  NoObjectGeneratedError,
  APICallError,
} from "ai";
import { getModel } from "@/lib/ai/providers";
import { getAuthorizedGmail, GmailNotConnectedError } from "@/lib/gmail/client";
import { extractEmailBody } from "@/lib/gmail/body";
import {
  generateReplyDraft,
  listDraftsForThread,
} from "@/lib/ai/drafts";
import { REPLY_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts/reply-draft";

const findSettings = db.userSettings.findUnique as unknown as ReturnType<
  typeof vi.fn
>;
const findThread = db.emailThread.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const createDraft = db.aiDraft.create as unknown as ReturnType<typeof vi.fn>;
const findManyDrafts = db.aiDraft.findMany as unknown as ReturnType<
  typeof vi.fn
>;
const createAudit = db.aiAuditLog.create as unknown as ReturnType<typeof vi.fn>;
const generateObjectMock = generateObject as unknown as ReturnType<typeof vi.fn>;
const generateTextMock = generateText as unknown as ReturnType<typeof vi.fn>;
const getModelMock = getModel as unknown as ReturnType<typeof vi.fn>;
const getAuthorizedGmailMock = getAuthorizedGmail as unknown as ReturnType<
  typeof vi.fn
>;
const extractEmailBodyMock = extractEmailBody as unknown as ReturnType<
  typeof vi.fn
>;

function settingsRow() {
  return {
    userId: "u1",
    settings: JSON.stringify({
      ai: { provider: "openai", model: "gpt-4o-mini" },
    }),
  };
}

function threadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-1",
    userId: "u1",
    gmailMessageId: "msg-1",
    subject: "Interview invite",
    snippet: "We'd like to schedule a chat.",
    fromAddress: "recruiter@acme.com",
    receivedAt: new Date("2026-05-20T15:00:00Z"),
    label: "Interview",
    jobId: "job-1",
    Job: {
      JobTitle: { label: "AI PM" },
      Company: { label: "Acme" },
      Status: { label: "interview" },
    },
    ...overrides,
  };
}

function draftObject(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Re: Interview invite",
    body:
      "Thanks for reaching out — Tuesday works on my end. Happy to confirm a time.",
    tone: "warm",
    ...overrides,
  };
}

describe("generateReplyDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModelMock.mockResolvedValue({ id: "fake-model" });
    createAudit.mockResolvedValue({ id: "audit-row" });
    createDraft.mockResolvedValue({ id: "draft-row" });
    getAuthorizedGmailMock.mockResolvedValue({
      gmail: {
        users: {
          messages: {
            get: vi.fn().mockResolvedValue({
              data: { payload: { body: { data: "fake-base64" } } },
            }),
          },
        },
      },
      email: "user@example.com",
    });
    extractEmailBodyMock.mockReturnValue("Full email body re-fetched from Gmail.");
  });

  it("throws when the thread row is missing", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(null);
    await expect(
      generateReplyDraft({
        userId: "u1",
        emailThreadId: "missing",
        intent: "reply",
      }),
    ).rejects.toThrow(/thread not found/i);
  });

  it("looks up the thread scoped to the userId", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });

    expect(findThread).toHaveBeenCalledTimes(1);
    const arg = findThread.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "thread-1", userId: "u1" });
  });

  it("calls generateObject with the reply-draft system prompt", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "thank-you",
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0];
    expect(call.system).toBe(REPLY_DRAFT_SYSTEM_PROMPT);
    expect(call.schema).toBeDefined();
    expect(call.prompt).toContain("Intent: thank-you");
  });

  it("flags bodyWasAvailable=true when Gmail body fetch succeeds", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const result = await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });
    expect(result.bodyWasAvailable).toBe(true);
  });

  it("falls back gracefully (bodyWasAvailable=false) when Gmail is disconnected", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    getAuthorizedGmailMock.mockRejectedValue(new GmailNotConnectedError());
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "confirm",
    });

    expect(result.bodyWasAvailable).toBe(false);
    expect(createDraft).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully on any other Gmail fetch error", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    getAuthorizedGmailMock.mockRejectedValue(new Error("network blip"));
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 50, outputTokens: 25 },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "follow-up",
    });

    expect(result.bodyWasAvailable).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("persists the draft into AiDraft with the correct shape", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockResolvedValue({
      object: draftObject({ subject: "Re: Interview invite", tone: "warm" }),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });

    expect(createDraft).toHaveBeenCalledTimes(1);
    const data = createDraft.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.emailThreadId).toBe("thread-1");
    expect(data.jobId).toBe("job-1");
    expect(data.draftType).toBe("reply");
    expect(data.subject).toBe("Re: Interview invite");
    expect(data.content).toMatch(/Tuesday works/);
    expect(data.tone).toBe("warm");
  });

  it("writes a success AiAuditLog row tagged feature=reply-draft", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockResolvedValue({
      object: draftObject(),
      usage: { inputTokens: 400, outputTokens: 200 },
    });

    await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });

    expect(createAudit).toHaveBeenCalledTimes(1);
    const data = createAudit.mock.calls[0][0].data;
    expect(data.feature).toBe("reply-draft");
    expect(data.status).toBe("success");
    expect(data.promptTokens).toBe(400);
    expect(data.completionTokens).toBe(200);
    expect(data.emailThreadId).toBe("thread-1");
    expect(data.jobId).toBe("job-1");
  });

  it("writes an error AiAuditLog row and re-throws on LLM failure", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockRejectedValue(new Error("provider 502"));

    await expect(
      generateReplyDraft({
        userId: "u1",
        emailThreadId: "thread-1",
        intent: "reply",
      }),
    ).rejects.toThrow("provider 502");

    expect(createAudit).toHaveBeenCalledTimes(1);
    const data = createAudit.mock.calls[0][0].data;
    expect(data.feature).toBe("reply-draft");
    expect(data.status).toBe("error");
    expect(data.errorMessage).toBe("provider 502");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("throws when AI provider/model not selected in UserSettings", async () => {
    findSettings.mockResolvedValue({
      userId: "u1",
      settings: JSON.stringify({ ai: {} }),
    });
    findThread.mockResolvedValue(threadRow());
    await expect(
      generateReplyDraft({
        userId: "u1",
        emailThreadId: "thread-1",
        intent: "reply",
      }),
    ).rejects.toThrow(/provider\/model not selected/);
  });

  // CAREERFLOW: structured-output fallback. Smaller / non-tool-calling models
  // (common on OpenRouter and Ollama) return prose instead of structured
  // output, so generateObject throws NoObjectGeneratedError. The helper
  // retries via generateText + JSON Schema and we should still ship a draft.
  it("falls back to generateText on NoObjectGeneratedError", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockRejectedValue(
      new (NoObjectGeneratedError as any)("no object"),
    );
    generateTextMock.mockResolvedValue({
      text:
        "```json\n" +
        JSON.stringify(draftObject({ tone: "brief" })) +
        "\n```",
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(result.draft.tone).toBe("brief");
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(createAudit.mock.calls[0][0].data.status).toBe("success");
  });

  it("falls back to generateText on APICallError statusCode=400", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockRejectedValue(
      new (APICallError as any)("Schema not supported", 400),
    );
    generateTextMock.mockResolvedValue({
      text: JSON.stringify(draftObject({ tone: "professional" })),
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await generateReplyDraft({
      userId: "u1",
      emailThreadId: "thread-1",
      intent: "reply",
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(result.draft.tone).toBe("professional");
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(createAudit.mock.calls[0][0].data.status).toBe("success");
  });

  // 401 / 429 / 5xx are real auth/quota/transport problems — the helper must
  // NOT mask them with a retry. The error bubbles up unchanged so the user
  // sees the actual provider error in Settings -> Usage.
  it("does NOT fall back on APICallError statusCode=401 (auth)", async () => {
    findSettings.mockResolvedValue(settingsRow());
    findThread.mockResolvedValue(threadRow());
    generateObjectMock.mockRejectedValue(
      new (APICallError as any)("Incorrect API key", 401),
    );

    await expect(
      generateReplyDraft({
        userId: "u1",
        emailThreadId: "thread-1",
        intent: "reply",
      }),
    ).rejects.toThrow("Incorrect API key");

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
    expect(createAudit.mock.calls[0][0].data.status).toBe("error");
    expect(createAudit.mock.calls[0][0].data.errorMessage).toBe(
      "Incorrect API key",
    );
  });
});

describe("listDraftsForThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries AiDraft scoped to user + thread and orders by createdAt desc", async () => {
    findManyDrafts.mockResolvedValue([{ id: "d1" }, { id: "d2" }]);
    const rows = await listDraftsForThread("u1", "thread-1");
    expect(rows).toHaveLength(2);
    const arg = findManyDrafts.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: "u1", emailThreadId: "thread-1" });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });
});
