// CAREERFLOW: POST /api/drafts/outreach. Generates a recruiter / LinkedIn
// outreach message (connection request, InMail, referral ask, or follow-up
// nudge) for a targeted job. On-demand only; draft-only (never sends).

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateOutreachDraft } from "@/lib/ai/outreach";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import { OutreachIntentSchema } from "@/models/ai.schemas";

const BodySchema = z.object({
  jobId: z.string().min(1),
  intent: OutreachIntentSchema,
  recipientName: z.string().max(120).optional().nullable(),
  recipientRole: z.string().max(120).optional().nullable(),
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
    const result = await generateOutreachDraft({
      userId,
      jobId: body.jobId,
      intent: body.intent,
      recipientName: body.recipientName ?? null,
      recipientRole: body.recipientRole ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Outreach draft failed";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not configured") || lower.includes("not selected")
        ? 412
        : lower.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
