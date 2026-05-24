// CAREERFLOW: GET / PUT the current user's Gmail integration settings
// (classification threshold + excluded email list). Stored in the
// UserSettings JSON blob via @/lib/gmail/settings (no Prisma migration).

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getGmailSettings,
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  updateGmailSettings,
} from "@/lib/gmail/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }
  const settings = await getGmailSettings(session.user.id);
  return NextResponse.json({ settings });
}

interface PutBody {
  classificationThreshold?: number;
  excludedEmails?: string[];
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.classificationThreshold !== undefined) {
    if (
      typeof body.classificationThreshold !== "number" ||
      Number.isNaN(body.classificationThreshold) ||
      body.classificationThreshold < MIN_THRESHOLD ||
      body.classificationThreshold > MAX_THRESHOLD
    ) {
      return NextResponse.json(
        {
          error: `classificationThreshold must be a number between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`,
        },
        { status: 400 },
      );
    }
  }

  if (body.excludedEmails !== undefined) {
    if (
      !Array.isArray(body.excludedEmails) ||
      !body.excludedEmails.every((v) => typeof v === "string")
    ) {
      return NextResponse.json(
        { error: "excludedEmails must be an array of strings." },
        { status: 400 },
      );
    }
  }

  const settings = await updateGmailSettings(session.user.id, {
    ...(body.classificationThreshold !== undefined
      ? { classificationThreshold: body.classificationThreshold }
      : {}),
    ...(body.excludedEmails !== undefined
      ? { excludedEmails: body.excludedEmails }
      : {}),
  });

  return NextResponse.json({ settings });
}
