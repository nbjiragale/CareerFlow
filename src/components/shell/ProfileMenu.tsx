// CAREERFLOW: redesign — topbar avatar + account menu (client; signs out via
// next-auth/react so the topbar can stay a client component).
"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Info, PowerIcon, Settings } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SupportDialog } from "../SupportDialog";

export interface ProfileMenuUser {
  name?: string | null;
  email?: string | null;
}

function initials(user: ProfileMenuUser): string {
  const base = user.name || user.email || "?";
  return base.trim().charAt(0).toUpperCase();
}

export default function ProfileMenu({ user }: { user: ProfileMenuUser | null }) {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="grid h-[26px] w-[26px] place-items-center rounded-full bg-brand text-[11px] font-semibold tracking-tight text-brand-foreground"
          aria-label="Account menu"
        >
          {user ? initials(user) : "?"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email ?? "My Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSupportOpen(true)}
            className="cursor-pointer"
          >
            <Info className="mr-2 h-4 w-4" />
            Support
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="cursor-pointer"
          >
            <PowerIcon className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
