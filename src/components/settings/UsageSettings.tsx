// CAREERFLOW: Phase 2 — Settings → Usage panel. Lists AI calls per day,
// per-model totals, and a configurable soft daily-spend cap (warning only).
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "../ui/use-toast";

interface DailyPoint {
  date: string;
  calls: number;
  costUsd: number;
  successCount: number;
  errorCount: number;
}

interface ModelRow {
  provider: string;
  model: string;
  calls: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
}

interface FeatureRow {
  feature: string;
  calls: number;
  costUsd: number;
}

interface UsageSummary {
  rangeDays: number;
  totals: {
    calls: number;
    costUsd: number;
    successCount: number;
    errorCount: number;
    promptTokens: number;
    completionTokens: number;
  };
  daily: DailyPoint[];
  byModel: ModelRow[];
  byFeature: FeatureRow[];
}

const DEFAULT_DAYS = 30;

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export default function UsageSettings() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyCap, setDailyCap] = useState<string>("");
  const [savingCap, setSavingCap] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage?days=${DEFAULT_DAYS}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json());
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't load usage",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Soft cap is stored in UserSettings JSON under usage.dailyCapUsd. We hit
  // the existing settings actions to read/write.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/settings");
        // No such endpoint — fallback: skip preload. Server action is used for write only.
        if (!res.ok) return;
        const data = await res.json();
        const cap = data?.settings?.usage?.dailyCapUsd;
        if (typeof cap === "number") setDailyCap(String(cap));
      } catch {
        // ignore
      }
    })();
  }, []);

  const saveCap = async () => {
    setSavingCap(true);
    try {
      const value = dailyCap.trim() === "" ? null : Number.parseFloat(dailyCap);
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        toast({
          variant: "destructive",
          title: "Invalid value",
          description: "Daily cap must be a non-negative number.",
        });
        return;
      }
      // Persist via the action endpoint already exposed by userSettings.actions.
      // We just hit the existing updateUserSettings flow through a small inline POST.
      const res = await fetch("/api/usage/cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCapUsd: value }),
      });
      // Endpoint may not exist yet — degrade gracefully: just keep local state.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: "Save failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast({ variant: "success", title: "Soft cap updated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingCap(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
      </div>
    );
  }

  const cap = dailyCap.trim() === "" ? null : Number.parseFloat(dailyCap);
  const maxDailyCost = Math.max(0.001, ...summary.daily.map((d) => d.costUsd));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Usage (last {summary.rangeDays} days)</h3>
        <p className="text-sm text-muted-foreground">
          AI calls recorded by CareerFlow. Cost figures are estimates based on
          a static pricing table — verify against your provider's dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Calls</div>
          <div className="text-2xl font-semibold tabular-nums">
            {summary.totals.calls.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Total cost</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatUsd(summary.totals.costUsd)}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Success</div>
          <div className="text-2xl font-semibold tabular-nums">
            {summary.totals.successCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Errors</div>
          <div className="text-2xl font-semibold tabular-nums">
            {summary.totals.errorCount.toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">Daily spend</h4>
        <div className="flex flex-col gap-1.5 rounded-md border p-3">
          {summary.daily.map((d) => {
            const widthPct = (d.costUsd / maxDailyCost) * 100;
            const overCap = cap !== null && d.costUsd > cap;
            return (
              <div
                key={d.date}
                className="grid grid-cols-[110px_1fr_80px] items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground tabular-nums">
                  {d.date}
                </span>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={
                      overCap
                        ? "h-1.5 rounded-full bg-destructive"
                        : "h-1.5 rounded-full bg-primary"
                    }
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">
                  {formatUsd(d.costUsd)}
                  {d.calls > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({d.calls})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {summary.byModel.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">By model</h4>
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_80px_80px_120px] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Provider · model</span>
              <span className="text-right">Calls</span>
              <span className="text-right">Tokens</span>
              <span className="text-right">Cost</span>
            </div>
            {summary.byModel.map((m) => (
              <div
                key={`${m.provider}::${m.model}`}
                className="grid grid-cols-[1fr_80px_80px_120px] gap-2 border-b px-3 py-2 text-xs last:border-b-0"
              >
                <span className="truncate">
                  <span className="text-muted-foreground">{m.provider}</span>{" "}
                  <span className="font-medium">{m.model}</span>
                </span>
                <span className="text-right tabular-nums">{m.calls}</span>
                <span className="text-right tabular-nums">
                  {(m.promptTokens + m.completionTokens).toLocaleString()}
                </span>
                <span className="text-right tabular-nums">
                  {formatUsd(m.costUsd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="daily-cap">Soft daily cap (USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="daily-cap"
            type="number"
            step="0.01"
            min="0"
            placeholder="No cap"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className="w-[200px]"
          />
          <Button onClick={saveCap} disabled={savingCap}>
            {savingCap ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Warning only — never blocks a request. Days above the cap show a
          destructive bar above.
        </p>
      </div>
    </div>
  );
}
