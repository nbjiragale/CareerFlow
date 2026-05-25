// CAREERFLOW: Phase 2 — POST /api/evaluate. Runs a JD evaluation against the
// user's configured AI provider/model and (optionally) persists the result on
// a Job row.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { runJdEvaluation } from "@/lib/ai/evaluate";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import { ArchetypeSchema } from "@/models/ai.schemas";

const BodySchema = z.object({
  jdText: z.string().min(20, "jdText is too short"),
  archetypeHint: z.union([ArchetypeSchema, z.literal("auto-detect")]).optional(),
  resumeSummary: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
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
    const result = await runJdEvaluation({
      userId,
      jdText: body.jdText,
      archetypeHint: body.archetypeHint,
      resumeSummary: body.resumeSummary ?? null,
      jobId: body.jobId ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Evaluation failed";
    const status =
      message.toLowerCase().includes("not configured") ||
      message.toLowerCase().includes("not selected")
        ? 412
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
