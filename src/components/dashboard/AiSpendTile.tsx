// CAREERFLOW: Phase 3 (PR #9) — AI spend tile. Shows the rolling 30-day spend
// from the AI audit log (data sourced from getUsageSummary in the server page).
"use client";

import { DollarSign } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export default function AiSpendTile({
  totalUsd,
  calls,
}: {
  totalUsd: number;
  calls: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" /> AI spend (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {calls === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI usage in the last 30 days.
          </p>
        ) : (
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tabular-nums">
              ${totalUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              across {calls} call{calls === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
