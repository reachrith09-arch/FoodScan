import { getLastNDaysSummaries } from "@/lib/analytics";
import { getPatternHints } from "@/lib/reactions";
import type { ProductResult } from "@/types/food";

export interface LongTermExposureSummary {
  topAdditivesThisWeek: { key: string; count: number }[];
  flaggedAdditives: string[]; // additives in this product that appear in high-reaction patterns
  daysWithScans: number;
}

/**
 * Get long-term exposure summary for display on the result page.
 * Flags additives in the current product that appear in high-severity reaction logs.
 */
export async function getLongTermExposureSummary(
  product: ProductResult
): Promise<LongTermExposureSummary> {
  const [summaries, patternHints] = await Promise.all([
    getLastNDaysSummaries(7),
    getPatternHints(),
  ]);

  const additiveMap = new Map<string, number>();
  for (const s of summaries) {
    for (const a of s.additiveExposure) {
      additiveMap.set(a.key, (additiveMap.get(a.key) ?? 0) + a.count);
    }
  }
  const topAdditivesThisWeek = Array.from(additiveMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const productAdditives = new Set(
    (product.additives_tags ?? []).map((a) => a.toLowerCase().replace(/^en:/, ""))
  );
  const patternAdditiveKeys = new Set(
    patternHints
      .filter((p) => p.label.includes("correlation:") || p.label.includes("Possible correlation"))
      .map((p) => {
        const m = p.label.match(/correlation:\s*(\S+)/i);
        return m ? m[1].toLowerCase() : "";
      })
      .filter(Boolean)
  );

  const flaggedAdditives: string[] = [];
  for (const key of productAdditives) {
    if (patternAdditiveKeys.has(key)) flaggedAdditives.push(key);
    // Also check if this product's additive is in top reaction-linked additives
    const hint = patternHints.find((h) => h.label.toLowerCase().includes(key));
    if (hint) flaggedAdditives.push(key);
  }

  const daysWithScans = summaries.filter((s) => s.scansCount > 0).length;

  return {
    topAdditivesThisWeek,
    flaggedAdditives: [...new Set(flaggedAdditives)],
    daysWithScans,
  };
}
