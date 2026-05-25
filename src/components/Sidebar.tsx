// CAREERFLOW: redesign — sidebar matching the design mockup: brand, search,
// sectioned nav (with AI Tools), live counts, and a footer showing the Gmail
// connection + AI provider/spend.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";

import { SIDEBAR_SECTIONS, type SidebarCountKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface SidebarData {
  counts?: Partial<Record<SidebarCountKey, number>>;
  gmailConnected?: boolean;
  aiLabel?: string | null;
  aiSpend?: number | null;
}

function isActive(pathname: string, route: string): boolean {
  if (route === "/dashboard") return pathname === "/dashboard";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function Sidebar({
  counts = {},
  gmailConnected = false,
  aiLabel = null,
  aiSpend = null,
}: SidebarData) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[232px] flex-col gap-3 border-r border-border bg-background px-2 py-3 sm:flex">
      {/* brand */}
      <Link href="/dashboard" className="flex h-8 items-center gap-2 px-2">
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-md bg-primary text-[12px] font-bold tracking-tighter text-primary-foreground">
          C
        </span>
        <span className="text-sm font-semibold tracking-tight">CareerFlow</span>
        <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Beta
        </span>
      </Link>

      {/* search (visual) */}
      <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-secondary px-2.5 text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate text-[13px]">Search applications…</span>
        <kbd className="rounded border border-border bg-card px-1 font-mono text-[10.5px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {SIDEBAR_SECTIONS.map((section, i) => (
          <div key={section.label ?? `s${i}`} className="flex flex-col gap-0.5">
            {section.label && (
              <span className="px-3 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </span>
            )}
            {section.items
              .filter(
                (item) =>
                  !item.devOnly || process.env.NODE_ENV === "development",
              )
              .map((item) => {
                const active = isActive(pathname, item.route);
                const count = item.countKey ? counts[item.countKey] : undefined;
                return (
                  <Link
                    key={item.route}
                    href={item.route}
                    className={cn(
                      "flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-foreground/70 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 flex-none",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count ? (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* footer: connection + AI spend */}
      <div className="flex flex-col gap-2 px-1">
        <div className="rounded-md border border-border bg-secondary px-2.5 py-2 text-[11px] leading-relaxed">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  gmailConnected ? "bg-status-offer" : "bg-muted-foreground",
                )}
              />
              {gmailConnected ? "Connected" : "Not connected"}
            </span>
            <span className="text-muted-foreground">Gmail</span>
          </div>
          {(aiLabel || aiSpend != null) && (
            <div className="mt-1 flex items-center justify-between text-muted-foreground">
              <span className="truncate">AI · {aiLabel ?? "—"}</span>
              {aiSpend != null && (
                <span className="tabular-nums">${aiSpend.toFixed(2)}</span>
              )}
            </div>
          )}
        </div>

        <Link
          href="/dashboard/settings"
          className={cn(
            "flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
            isActive(pathname, "/dashboard/settings")
              ? "bg-accent font-medium text-foreground"
              : "text-foreground/70 hover:bg-accent hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4 flex-none text-muted-foreground" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
