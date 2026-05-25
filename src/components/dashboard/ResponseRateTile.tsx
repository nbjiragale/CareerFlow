// CAREERFLOW: Phase 3 (PR #9) — response-rate tile. Shows the share of applied
// emails that got a positive reply within 30/60/90 days.
"use client";

import { MailCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { ResponseRateWindow } from "@/actions/dashboard.actions";

export default function ResponseRateTile({
  data,
}: {
  data: ResponseRateWindow[];
}) {
  const hasData = data.some((w) => w.appliedCount > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MailCheck className="h-4 w-4" /> Response rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            No application emails yet. Connect Gmail to track responses.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {data.map((w) => (
              <div key={w.windowDays} className="flex flex-col">
                <span className="text-2xl font-semibold tabular-nums">
                  {w.rate}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {w.windowDays}d
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {w.respondedCount}/{w.appliedCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
