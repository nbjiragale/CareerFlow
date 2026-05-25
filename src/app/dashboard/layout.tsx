import Sidebar, { type SidebarData } from "@/components/Sidebar";
import Topbar from "@/components/shell/Topbar";
import { Toaster } from "@/components/ui/toaster";
import { ActivityProvider } from "@/context/ActivityContext";
import { GlobalActivityBanner } from "@/components/activities/GlobalActivityBanner";
// CAREERFLOW: Phase 3 — app-wide reminder SSE subscription.
import ReminderListener from "@/components/notifications/ReminderListener";
// CAREERFLOW: redesign — live sidebar data (counts, connection, AI spend).
import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { getUsageSummary } from "@/lib/ai/usage";
import { getUserSettings } from "@/actions/userSettings.actions";

async function getSidebarData(
  userId: string | undefined,
): Promise<SidebarData> {
  if (!userId) return {};
  try {
    const [applications, inbox, token, usage, settings] = await Promise.all([
      db.job.count({ where: { userId } }),
      db.emailThread.count({ where: { userId, needsReview: true } }),
      db.oAuthToken.findFirst({
        where: { userId, provider: "google" },
        select: { id: true },
      }),
      getUsageSummary(userId, 30),
      getUserSettings(),
    ]);
    const ai = settings?.data?.settings?.ai;
    const aiLabel = ai?.model || ai?.provider || null;
    return {
      counts: { applications, inbox },
      gmailConnected: Boolean(token),
      aiLabel,
      aiSpend: usage?.totals?.costUsd ?? 0,
    };
  } catch {
    return {};
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const sidebarData = await getSidebarData(user?.id);

  return (
    <ActivityProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Sidebar {...sidebarData} />
        <div className="flex flex-1 flex-col sm:pl-[232px]">
          <Topbar user={user} />
          <GlobalActivityBanner />
          <ReminderListener />
          <main className="flex-1 md:block lg:grid items-start gap-4 p-4 sm:px-6 sm:py-5 md:gap-4 lg:grid-cols-3 xl:grid-cols-3">
            {children}
          </main>
          <Toaster />
        </div>
      </div>
    </ActivityProvider>
  );
}
