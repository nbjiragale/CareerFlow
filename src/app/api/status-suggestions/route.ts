// CAREERFLOW: POST /api/status-suggestions — apply or dismiss an inbox-derived
// status suggestion for an application. Confirm-first: invoked only by an
// explicit user click in the dashboard card.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  applyStatusSuggestion,
  dismissStatusSuggestion,
} from "@/lib/gmail/status-suggestions";

const BodySchema = z.object({
  threadId: z.string().min(1),
  action: z.enum(["apply", "dismiss"]),
});

export const POST = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    const result =
      body.action === "apply"
        ? await applyStatusSuggestion(userId, body.threadId)
        : await dismissStatusSuggestion(userId, body.threadId);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Status update failed";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
