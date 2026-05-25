"use client";
import Link from "next/link";

import { Settings } from "lucide-react";
import { SIDEBAR_LINKS } from "@/lib/constants";
import NavLink from "./NavLink";
import { usePathname } from "next/navigation";

function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-background sm:flex">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Link
          href="/"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold tracking-tight text-primary-foreground"
        >
          CF
        </Link>
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          CareerFlow
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {SIDEBAR_LINKS.map((item) => {
          // Only show dev-only items in development mode
          if (item.devOnly && process.env.NODE_ENV !== "development") {
            return null;
          }
          return (
            <NavLink
              key={item.label}
              label={item.label}
              Icon={item.icon}
              route={item.route}
              pathname={path}
            />
          );
        })}
      </nav>
      <nav className="mt-auto flex flex-col gap-1 border-t px-3 py-4">
        <NavLink
          label="Settings"
          Icon={Settings}
          route="/dashboard/settings"
          pathname={path}
        />
      </nav>
    </aside>
  );
}

export default Sidebar;
