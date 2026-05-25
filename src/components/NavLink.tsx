import React, { ForwardRefExoticComponent, RefAttributes } from "react";
import Link from "next/link";

import { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  label: string;
  Icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  route: string;
  pathname: string;
}

function NavLink({ label, Icon, route, pathname }: NavLinkProps) {
  const isActive =
    route === pathname || pathname.startsWith(`${route}/dashboard`);
  return (
    <Link
      href={route}
      className={cn(
        "flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 text-sm transition-colors",
        isActive
          ? "border-primary bg-primary/5 font-semibold text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export default NavLink;
