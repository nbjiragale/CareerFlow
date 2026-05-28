// CAREERFLOW: POST /api/edge — generate the "Edge" win-loop insights from the
// user's own application funnel. Returns { status: "learning" } cheaply (no LLM)
// when there isn't enough decided data yet; otherwise spends one structured call.

import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateCareerEdge } from "@/lib/ai/edge";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";

export const POST = async () => {
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

  try {
    const result = await generateCareerEdge(userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StructuredOutputUnsupportedError) {
      return NextResponse.json(
        { error: err.message, code: "structured_output_unsupported" },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Edge generation failed";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not configured") || lower.includes("not selected")
        ? 412
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
