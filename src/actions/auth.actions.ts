"use server";
import { AuthError } from "next-auth";
import { signIn } from "../auth";
import { delay } from "@/utils/delay";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignupFormSchema } from "@/models/signupForm.schema";
import { JOB_SOURCES, JOB_STATUSES } from "@/lib/constants";
import { getCurrentUser } from "@/utils/user.utils";

// CAREERFLOW: Phase 3 (PR #9) — exposes the signed-in user's email to client
// components (the account-deletion confirmation gate). No SessionProvider is
// wired, so client components read it via this server action.
export async function getCurrentUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email ?? null;
}

export async function signup(formData: {
  name: string;
  email: string;
  password: string;
}) {
  const parsed = SignupFormSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: "Invalid form data." };
  }

  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  await prisma.jobSource.createMany({
    data: JOB_SOURCES.map((source) => ({
      label: source.label,
      value: source.value,
      createdBy: newUser.id,
    })),
  });

  for (const status of JOB_STATUSES) {
    await prisma.jobStatus.upsert({
      where: { value: status.value },
      update: {},
      create: status,
    });
  }

  // Create default UserSettings so AI settings resolver finds a row on first use.
  // Provider is ollama (local, no key required) with no model selected — the
  // user will be prompted to pick one in Settings → AI Provider before the first
  // AI call, but the row existing prevents the harder-to-diagnose
  // "AI settings not configured" error path.
  await prisma.userSettings.create({
    data: {
      userId: newUser.id,
      settings: JSON.stringify({
        ai: { provider: "ollama", model: undefined },
        display: { theme: "system", density: "comfortable" },
        notifications: { browserEnabled: true, emailEnabled: false, defaultLeadMinutes: 60 },
      }),
    },
  });

  return { success: true };
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await delay(1000);
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
