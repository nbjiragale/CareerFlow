// CAREERFLOW: redesign — top bar matching the design mockup.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, PanelLeft, Plus, RefreshCw, Sun } from "lucide-react";

import { SIDEBAR_SECTIONS } from "@/lib/constants";
import { useReminders } from "@/context/ReminderContext";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { toast } from "../ui/use-toast";
import ProfileMenu, { type ProfileMenuUser } from "./ProfileMenu";

function crumbForPath(pathname: string): string {
  let best = "";
  let bestLabel = "Dashboard";
  for (const section of SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      if (
        (pathname === item.route || pathname.startsWith(`${item.route}/`)) &&
        item.route.length > best.length
      ) {
        best = item.route;
        bestLabel = item.label;
      }
    }
  }
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return bestLabel;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid h-[30px] w-[30px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Topbar({ user }: { user: ProfileMenuUser | null }) {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const { unreadCount, clearUnread } = useReminders();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast({ variant: "success", title: "Gmail synced" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[52px] flex-none items-center gap-3 border-b border-border bg-background px-4 sm:px-5">
      {/* mobile nav */}
      <Sheet>
        <SheetTrigger
          className="grid h-[30px] w-[30px] place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:hidden"
          aria-label="Open menu"
        >
          <PanelLeft className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <nav className="flex flex-col gap-4">
            {SIDEBAR_SECTIONS.map((section, i) => (
              <div key={section.label ?? `s${i}`} className="flex flex-col gap-1">
                {section.label && (
                  <span className="px-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {section.label}
                  </span>
                )}
                {section.items
                  .filter(
                    (it) => !it.devOnly || process.env.NODE_ENV === "development",
                  )
                  .map((item) => (
                    <SheetClose asChild key={item.route}>
                      <Link
                        href={item.route}
                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-accent"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground">
          {crumbForPath(pathname)}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          Sync Gmail
        </button>

        <Link
          href="/dashboard/tasks"
          onClick={clearUnread}
          aria-label={
            unreadCount > 0
              ? `Reminders (${unreadCount} new)`
              : "Reminders"
          }
          className="relative grid h-[30px] w-[30px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <ThemeToggle />

        <Link
          href="/dashboard/myjobs?new=1"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Link>

        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
