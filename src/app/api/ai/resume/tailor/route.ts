import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { runResumeTailor } from "@/lib/ai/tailor";

const BodySchema = z.object({
  resumeId: z.string().min(1),
  jobId: z.string().min(1),
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
        error: `Rate limit exceeded. Try again in ${Math.ceil(
          rate.resetIn / 1000,
        )}s.`,
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
    const result = await runResumeTailor({
      userId,
      sourceResumeId: body.resumeId,
      jobId: body.jobId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailor failed";
    const status =
      message.toLowerCase().includes("not configured") ||
      message.toLowerCase().includes("not selected") ||
      message.toLowerCase().includes("no description") ||
      message.toLowerCase().includes("no experiences")
        ? 412
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
