// CAREERFLOW: Phase 3 (PR #9) — application funnel tile (Applied → Interview →
// Offer) from the authoritative Job.Status. Renders a Nivo bar plus a textual
// breakdown (the breakdown is the accessible/testable source of truth).
"use client";

import { ResponsiveBar } from "@nivo/bar";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { FunnelStage } from "@/actions/dashboard.actions";

export default function FunnelTile({ data }: { data: FunnelStage[] }) {
  const hasData = data.some((s) => s.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Application funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            No jobs yet. Add jobs to see your Applied → Interview → Offer funnel.
          </p>
        ) : (
          <>
            <div className="h-[160px]">
              <ResponsiveBar
                data={data as unknown as Record<string, string | number>[]}
                keys={["count"]}
                indexBy="label"
                margin={{ top: 10, right: 10, bottom: 28, left: 30 }}
                padding={0.4}
                colors="#2a7ef0"
                enableGridX={false}
                enableGridY={false}
                axisTop={null}
                axisRight={null}
                valueFormat={(v) => v.toFixed(0)}
                motionConfig="gentle"
              />
            </div>
            <ul className="mt-2 flex justify-between text-xs text-muted-foreground">
              {data.map((s) => (
                <li key={s.stage} className="flex flex-col items-center">
                  <span className="font-medium text-foreground tabular-nums">
                    {s.count}
                  </span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
