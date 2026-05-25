// CAREERFLOW: redesign — dashboard stat card (eyebrow label, big value,
// optional sparkline, optional trend delta).
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card } from "../ui/card";
import { cn } from "@/lib/utils";
import Sparkline from "./Sparkline";

export default function StatCard({
  label,
  value,
  trend,
  trendLabel,
  series,
}: {
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  series?: number[];
}) {
  const hasTrend = trend != null && Number.isFinite(trend);
  const up = hasTrend && (trend as number) >= 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
        {series && series.length > 1 ? (
          <Sparkline data={series} stroke="var(--grade-a)" />
        ) : null}
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hasTrend ? (
        <div className="flex items-center gap-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              up ? "text-[color:var(--grade-a)]" : "text-[color:var(--grade-f)]",
            )}
          >
            {up ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(trend as number)}
            {typeof value === "string" && value.includes("%") ? "%" : ""}
          </span>
          {trendLabel ? (
            <span className="text-muted-foreground">{trendLabel}</span>
          ) : null}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </Card>
  );
}
