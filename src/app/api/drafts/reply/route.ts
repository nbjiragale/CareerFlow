// CAREERFLOW: Phase 2 — POST /api/drafts/reply. Generates an AI reply draft
// for a Gmail thread and persists it as AiDraft. No autonomous send.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateReplyDraft } from "@/lib/ai/drafts";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import { ReplyDraftIntentSchema } from "@/models/ai.schemas";

const BodySchema = z.object({
  emailThreadId: z.string().min(1),
  intent: ReplyDraftIntentSchema,
  resumeSummary: z.string().optional().nullable(),
});

export const POST = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rate = checkRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${Math.ceil(rate.resetIn / 1000)}s.`,
      },
      { status: 429 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateReplyDraft({
      userId,
      emailThreadId: body.emailThreadId,
      intent: body.intent,
      resumeSummary: body.resumeSummary ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Draft generation failed";
    const lower = message.toLowerCase();
    let status = 500;
    if (lower.includes("not configured") || lower.includes("not selected")) {
      status = 412;
    } else if (lower.includes("thread not found")) {
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
};
