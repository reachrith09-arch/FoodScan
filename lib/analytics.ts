import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailySummary, WeeklyReportCard } from "@/types/analytics";
import { getAlertCountsFromScan } from "@/types/analytics";
import type { ScanResult } from "@/types/food";

const KEYS = {
  DAILY_SUMMARIES: "DAILY_SUMMARIES",
} as const;

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function addDays(dateKey: string, days: number): string {
  const dt = fromDateKey(dateKey);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt.getTime());
}

export function getTodayKey(): string {
  return toDateKey(Date.now());
}

async function loadSummariesMap(): Promise<Record<string, DailySummary>> {
  const raw = await AsyncStorage.getItem(KEYS.DAILY_SUMMARIES);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, DailySummary>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSummariesMap(map: Record<string, DailySummary>): Promise<void> {
  await AsyncStorage.setItem(KEYS.DAILY_SUMMARIES, JSON.stringify(map));
}

function sanitizeSummary(s: DailySummary): DailySummary {
  const n = (x: number) => (Number.isFinite(x) ? x : 0);
  return {
    ...s,
    sodiumMgTotal: n(s.sodiumMgTotal),
    sugarGTotal: n(s.sugarGTotal),
    caloriesKcalTotal: n(s.caloriesKcalTotal),
    ultraProcessedScoreAvg: n(s.ultraProcessedScoreAvg),
  };
}

export async function getDailySummary(dateKey: string): Promise<DailySummary> {
  const map = await loadSummariesMap();
  const existing = map[dateKey];
  if (existing) return sanitizeSummary(existing);
  return {
    dateKey,
    scansCount: 0,
    sodiumMgTotal: 0,
    sugarGTotal: 0,
    caloriesKcalTotal: 0,
    ultraProcessedScoreAvg: 0,
    criticalAlertsCount: 0,
    warningAlertsCount: 0,
    additiveExposure: [],
    lastUpdatedAt: Date.now(),
  };
}

export async function updateDailySummaryFromScan(scan: ScanResult): Promise<void> {
  const dateKey = toDateKey(scan.timestamp);
  const map = await loadSummariesMap();
  const current = map[dateKey] ?? (await getDailySummary(dateKey));

  const sodiumMg = Number(scan.product.nutriments?.sodium_100g ?? scan.product.nutriments?.sodium ?? 0) || 0;
  const sugarG = Number(scan.product.nutriments?.sugars_100g ?? scan.product.nutriments?.sugars ?? 0) || 0;
  const kcal = Number(scan.product.nutriments?.["energy-kcal_100g"] ?? scan.product.nutriments?.energy ?? 0) || 0;

  const { critical, warning } = getAlertCountsFromScan(scan);
  const upf = scan.analysis?.ultraProcessed.score ?? 0;

  // Update additive exposure counts
  const exposureMap = new Map<string, number>(
    current.additiveExposure.map((e) => [e.key, e.count]),
  );
  for (const k of scan.product.additives_tags ?? []) {
    const key = k.toLowerCase().replace(/^en:/, "");
    exposureMap.set(key, (exposureMap.get(key) ?? 0) + 1);
  }

  const scansCount = current.scansCount + 1;
  const ultraProcessedScoreAvg =
    scansCount === 1 ? upf : (current.ultraProcessedScoreAvg * current.scansCount + upf) / scansCount;

  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  const next: DailySummary = {
    ...current,
    scansCount,
    sodiumMgTotal: safe(current.sodiumMgTotal) + sodiumMg,
    sugarGTotal: safe(current.sugarGTotal) + sugarG,
    caloriesKcalTotal: safe(current.caloriesKcalTotal) + kcal,
    ultraProcessedScoreAvg,
    criticalAlertsCount: current.criticalAlertsCount + critical,
    warningAlertsCount: current.warningAlertsCount + warning,
    additiveExposure: Array.from(exposureMap.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50),
    lastUpdatedAt: Date.now(),
  };

  map[dateKey] = next;
  await saveSummariesMap(map);
}

export async function getLastNDaysSummaries(n: number): Promise<DailySummary[]> {
  const map = await loadSummariesMap();
  const today = getTodayKey();
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push(addDays(today, -i));
  return keys
    .map((k) => map[k])
    .filter(Boolean)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export async function getWeeklyReportCard(): Promise<WeeklyReportCard> {
  const summaries = await getLastNDaysSummaries(7);
  const totalScans = summaries.reduce((acc, s) => acc + s.scansCount, 0);
  const avgUltraProcessed =
    summaries.length === 0 ? 0 : summaries.reduce((acc, s) => acc + s.ultraProcessedScoreAvg, 0) / summaries.length;
  const totalCriticalAlerts = summaries.reduce((acc, s) => acc + s.criticalAlertsCount, 0);
  const totalWarnings = summaries.reduce((acc, s) => acc + s.warningAlertsCount, 0);

  // Without storing per-scan overall score aggregates yet, approximate with ultraProcessed inverse
  const avgOverallScore = clamp100(100 - avgUltraProcessed);

  const additiveMap = new Map<string, number>();
  for (const s of summaries) {
    for (const a of s.additiveExposure) {
      additiveMap.set(a.key, (additiveMap.get(a.key) ?? 0) + a.count);
    }
  }
  const topAdditives = Array.from(additiveMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const weekStartDateKey = summaries[0]?.dateKey ?? getTodayKey();
  const weekEndDateKey = summaries[summaries.length - 1]?.dateKey ?? getTodayKey();

  return {
    weekStartDateKey,
    weekEndDateKey,
    totalScans,
    avgOverallScore,
    avgUltraProcessed: Math.round(avgUltraProcessed),
    totalCriticalAlerts,
    totalWarnings,
    topAdditives,
  };
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

