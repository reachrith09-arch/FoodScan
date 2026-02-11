import type { HealthProfile, ProductResult, ScanResult } from "@/types/food";
import { searchProducts } from "@/lib/open-food-facts";
import { analyzeProduct } from "@/lib/scoring";

export interface SwapRecommendation {
  product: ProductResult;
  score: number;
  label: string;
}

/**
 * Fetch alternatives using Open Food Facts search and rank by our score.
 * This is a heuristic MVP: product-name search + score sort.
 */
export async function getSwapRecommendations(
  current: ProductResult,
  profile: HealthProfile | null,
  max = 3,
): Promise<SwapRecommendation[]> {
  const q = (current.product_name || "").trim();
  if (!q) return [];
  const results = await searchProducts(q, 15);
  const filtered = results.filter((p) => p.code && p.code !== current.code);
  const ranked = filtered
    .map((p) => {
      const analysis = analyzeProduct(profile, p);
      return { product: p, score: analysis.overallScore, label: analysis.overallLabel };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  return ranked;
}

export function makeSwapScanResult(
  product: ProductResult,
  profile: HealthProfile | null,
): ScanResult {
  const analysis = analyzeProduct(profile, product);
  return {
    id: `${Date.now()}-${product.code}`,
    timestamp: Date.now(),
    source: "search",
    barcode: product.code,
    product,
    healthRisks: analysis.healthRisks,
    analysis,
  };
}

