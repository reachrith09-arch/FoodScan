import type { RiskSeverity, ScanResult } from "@/types/food";

export interface AdditiveExposure {
  key: string; // normalized additive key (e.g. "e211", "en:e322", etc.)
  count: number;
}

export interface DailySummary {
  dateKey: string; // YYYY-MM-DD (local)
  scansCount: number;

  // Nutrients (approx per 100g, depends on product data)
  sodiumMgTotal: number;
  sugarGTotal: number;
  caloriesKcalTotal: number;

  // Processing
  ultraProcessedScoreAvg: number; // 0-100 average

  // Alerts
  criticalAlertsCount: number;
  warningAlertsCount: number;

  additiveExposure: AdditiveExposure[];
  lastUpdatedAt: number;
}

export type SymptomSeverity = 1 | 2 | 3 | 4 | 5;

export interface ReactionLogEntry {
  id: string;
  timestamp: number;
  relatedScanId?: string;
  symptoms: string[]; // e.g. ["headache","bloating"]
  severity: SymptomSeverity;
  notes?: string;
}

export interface WeeklyReportCard {
  weekStartDateKey: string; // YYYY-MM-DD
  weekEndDateKey: string; // YYYY-MM-DD
  totalScans: number;
  avgOverallScore: number;
  avgUltraProcessed: number;
  totalCriticalAlerts: number;
  totalWarnings: number;
  topAdditives: AdditiveExposure[];
}

export function getAlertCountsFromScan(scan: ScanResult): { critical: number; warning: number } {
  const risks = scan.analysis?.healthRisks ?? scan.healthRisks;
  let critical = 0;
  let warning = 0;
  for (const r of risks) {
    const s = r.severity as RiskSeverity;
    if (s === "critical") critical += 1;
    if (s === "warning") warning += 1;
  }
  return { critical, warning };
}

