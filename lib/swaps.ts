import type { HealthProfile, ProductResult, ScanResult } from "@/types/food";
import { searchProductsUnified } from "@/lib/search-products-online";
import { parseQueryForBrand } from "@/lib/open-food-facts";
import { analyzeProduct } from "@/lib/scoring";

export interface SwapRecommendation {
  product: ProductResult;
  score: number;
  label: string;
}

/**
 * Fetch alternatives using unified search (DB + Google) and rank by our score.
 * Uses product name + brand to find more alternatives.
 */
export async function getSwapRecommendations(
  current: ProductResult,
  profile: HealthProfile | null,
  max = 3,
): Promise<SwapRecommendation[]> {
  const fullName = (current.product_name || "").trim();
  const brand = (current.brands || "").trim();
  const q = [fullName, brand].filter(Boolean).join(" ").trim();
  if (!q) return [];
  const { brand: parsedBrand, productTerms } = parseQueryForBrand(q);
  const searchQuery = parsedBrand && productTerms ? `${productTerms} ${parsedBrand}` : q;
  const results = await searchProductsUnified(searchQuery, { pageSize: 15, countryCode: profile?.countryCode });
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

