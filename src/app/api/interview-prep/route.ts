// CAREERFLOW: POST /api/interview-prep. Generates (or returns the cached) AI
// interview prep brief for a job. On-demand only — never called from the
// background sync — so token spend always follows an explicit user action.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { runInterviewPrep } from "@/lib/ai/interview-prep";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";

const BodySchema = z.object({
  jobId: z.string().min(1),
  force: z.boolean().optional(),
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
    const result = await runInterviewPrep({
      userId,
      jobId: body.jobId,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Interview prep failed";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not configured") || lower.includes("not selected")
        ? 412
        : lower.includes("not found") || lower.includes("no description")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
