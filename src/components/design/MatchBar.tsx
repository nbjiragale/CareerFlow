// CAREERFLOW: redesign — thin "MATCH NN%" bar used on application + resume cards.
import { cn } from "@/lib/utils";

function barColor(value: number): string {
  if (value >= 85) return "var(--grade-a)";
  if (value >= 70) return "var(--grade-b)";
  if (value >= 55) return "var(--grade-c)";
  if (value >= 40) return "var(--grade-d)";
  return "var(--grade-f)";
}

export default function MatchBar({
  value,
  label = "MATCH",
  className,
}: {
  value: number | null | undefined;
  label?: string;
  className?: string;
}) {
  if (value == null) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, background: barColor(clamped) }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums">{clamped}%</span>
    </div>
  );
}
