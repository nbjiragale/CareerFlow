// CAREERFLOW: Phase 2 — usage summary aggregator. Reads AiAuditLog rows and
// produces the data shape consumed by Settings → Usage:
//
//   { totals, daily, byModel, byFeature }
//
// Day buckets are computed in UTC; the UI is free to re-bucket locally.

import "server-only";

import db from "@/lib/db";

export interface UsageDailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  calls: number;
  costUsd: number;
  successCount: number;
  errorCount: number;
}

export interface UsageByModelRow {
  provider: string;
  model: string;
  calls: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
}

export interface UsageByFeatureRow {
  feature: string;
  calls: number;
  costUsd: number;
}

export interface UsageSummary {
  rangeDays: number;
  totals: {
    calls: number;
    costUsd: number;
    successCount: number;
    errorCount: number;
    promptTokens: number;
    completionTokens: number;
  };
  daily: UsageDailyPoint[];
  byModel: UsageByModelRow[];
  byFeature: UsageByFeatureRow[];
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getUsageSummary(
  userId: string,
  days: number,
): Promise<UsageSummary> {
  const rangeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const rows = await db.aiAuditLog.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const totals = {
    calls: 0,
    costUsd: 0,
    successCount: 0,
    errorCount: 0,
    promptTokens: 0,
    completionTokens: 0,
  };

  const dailyMap = new Map<string, UsageDailyPoint>();
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = ymd(d);
    dailyMap.set(key, {
      date: key,
      calls: 0,
      costUsd: 0,
      successCount: 0,
      errorCount: 0,
    });
  }

  const modelMap = new Map<string, UsageByModelRow>();
  const featureMap = new Map<string, UsageByFeatureRow>();

  for (const r of rows) {
    totals.calls += 1;
    totals.costUsd += r.costUsd;
    totals.promptTokens += r.promptTokens;
    totals.completionTokens += r.completionTokens;
    if (r.status === "success") totals.successCount += 1;
    else totals.errorCount += 1;

    const dayKey = ymd(r.createdAt);
    const day = dailyMap.get(dayKey) ?? {
      date: dayKey,
      calls: 0,
      costUsd: 0,
      successCount: 0,
      errorCount: 0,
    };
    day.calls += 1;
    day.costUsd += r.costUsd;
    if (r.status === "success") day.successCount += 1;
    else day.errorCount += 1;
    dailyMap.set(dayKey, day);

    const modelKey = `${r.provider}::${r.model}`;
    const mRow =
      modelMap.get(modelKey) ?? {
        provider: r.provider,
        model: r.model,
        calls: 0,
        costUsd: 0,
        promptTokens: 0,
        completionTokens: 0,
      };
    mRow.calls += 1;
    mRow.costUsd += r.costUsd;
    mRow.promptTokens += r.promptTokens;
    mRow.completionTokens += r.completionTokens;
    modelMap.set(modelKey, mRow);

    const fRow =
      featureMap.get(r.feature) ?? {
        feature: r.feature,
        calls: 0,
        costUsd: 0,
      };
    fRow.calls += 1;
    fRow.costUsd += r.costUsd;
    featureMap.set(r.feature, fRow);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const byModel = Array.from(modelMap.values()).sort(
    (a, b) => b.costUsd - a.costUsd || b.calls - a.calls,
  );
  const byFeature = Array.from(featureMap.values()).sort(
    (a, b) => b.costUsd - a.costUsd,
  );

  return { rangeDays, totals, daily, byModel, byFeature };
}
