// CAREERFLOW: POST /api/match-tailor. One-shot evaluate → match → tailor against
// a base resume, auto-creating a tracked application from the pasted JD.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { runMatchAndTailor } from "@/lib/ai/match-tailor";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import { ArchetypeSchema } from "@/models/ai.schemas";

const BodySchema = z.object({
  jdText: z.string().min(20, "jdText is too short"),
  company: z.string().min(1, "company is required").max(200),
  role: z.string().min(1, "role is required").max(200),
  baseResumeId: z.string().min(1, "baseResumeId is required"),
  archetypeHint: z
    .union([ArchetypeSchema, z.literal("auto-detect")])
    .optional(),
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
    const result = await runMatchAndTailor({
      userId,
      jdText: body.jdText,
      company: body.company,
      role: body.role,
      baseResumeId: body.baseResumeId,
      archetypeHint: body.archetypeHint,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Match & Tailor failed";
    const status =
      message.toLowerCase().includes("not configured") ||
      message.toLowerCase().includes("not selected")
        ? 412
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
