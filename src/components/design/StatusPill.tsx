// CAREERFLOW: redesign — status pill primitive. Maps a job/application status
// to the design system's color-tinted pill.
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  wishlist: "pill-wishlist",
  draft: "pill-wishlist",
  applied: "pill-applied",
  screening: "pill-screening",
  interview: "pill-interview",
  offer: "pill-offer",
  rejected: "pill-rejected",
  expired: "pill-rejected",
  archived: "pill-rejected",
};

export default function StatusPill({
  status,
  label,
  withDot = true,
  className,
}: {
  status: string;
  label?: string;
  withDot?: boolean;
  className?: string;
}) {
  const key = status?.toLowerCase?.() ?? "";
  return (
    <span className={cn("pill capitalize", STATUS_CLASS[key], className)}>
      {withDot && STATUS_CLASS[key] ? <span className="pill-dot" /> : null}
      {label ?? status}
    </span>
  );
}
