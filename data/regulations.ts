import type { RegionCode, RegulationComparison, RegulationStatus } from "@/types/food";

/**
 * Very small seed dataset for regulation comparison.
 * IMPORTANT: Regulations change over time and depend on use-case and dosage.
 * Treat this as "informational" and allow expanding/replacing with a proper dataset later.
 */

export interface RegulationRule {
  ingredientKey: string; // normalized key (e.g. "e110", "bha", "e320")
  displayName: string;
  statusByRegion: Record<RegionCode, RegulationStatus>;
  note?: string;
}

export const REGULATION_RULES: RegulationRule[] = [
  {
    ingredientKey: "e110",
    displayName: "Sunset Yellow FCF (E110)",
    statusByRegion: { US: "allowed", EU: "restricted", UK: "restricted", CA: "allowed" },
    note:
      "Some regions require warning labels for certain artificial colors. Rules vary by country and product category.",
  },
  {
    ingredientKey: "e102",
    displayName: "Tartrazine (E102)",
    statusByRegion: { US: "allowed", EU: "restricted", UK: "restricted", CA: "allowed" },
    note:
      "EU/UK may require additional labeling for some artificial colors. This does not necessarily mean unsafe at permitted levels.",
  },
  {
    ingredientKey: "e320",
    displayName: "BHA (E320)",
    statusByRegion: { US: "allowed", EU: "restricted", UK: "restricted", CA: "allowed" },
    note:
      "Permitted levels differ; some consumers prefer to avoid antioxidant preservatives like BHA/BHT.",
  },
  {
    ingredientKey: "e321",
    displayName: "BHT (E321)",
    statusByRegion: { US: "allowed", EU: "restricted", UK: "restricted", CA: "allowed" },
    note: "Often regulated by food category and maximum allowed concentration.",
  },
];

function normalizeKey(key: string): string {
  return key.toLowerCase().trim();
}

export function getRegulationComparisons(keys: string[]): RegulationComparison[] {
  const normKeys = new Set(keys.map(normalizeKey));
  return REGULATION_RULES.filter((r) => normKeys.has(normalizeKey(r.ingredientKey))).map((r) => ({
    ingredientKey: r.ingredientKey,
    displayName: r.displayName,
    statusByRegion: r.statusByRegion,
    note: r.note,
  }));
}

