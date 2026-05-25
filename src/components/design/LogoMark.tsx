// CAREERFLOW: redesign — company initial tile.
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-[22px] w-[22px] rounded-[5px] text-[9.5px]",
  sm: "h-7 w-7 rounded-md text-[11px]",
  md: "h-9 w-9 rounded-lg text-[13px]",
  lg: "h-12 w-12 rounded-[10px] text-[17px]",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function LogoMark({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid flex-none place-items-center border border-border bg-secondary font-semibold tracking-tight text-foreground",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
