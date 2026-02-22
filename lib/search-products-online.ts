/**
 * Unified Search and Describe pipeline.
 * ALWAYS returns results, ranked by similarity + brand + country.
 * Uses Open Food Facts + optional Supabase online search.
 */
import type { ProductResult } from "@/types/food";
import { rankProducts, isGenericQuery } from "@/lib/search-ranking";

const DEBUG = __DEV__;

function log(...args: unknown[]) {
  if (DEBUG) console.log("[SearchProducts]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[SearchProducts]", ...args);
}

function hasCompleteInfo(p: ProductResult): boolean {
  const hasIngredients =
    (p.ingredients_text && p.ingredients_text.trim().length > 10) ||
    (p.ingredients_tags && p.ingredients_tags.length > 0);
  const hasNutriments =
    p.nutriments &&
    (p.nutriments["energy-kcal_100g"] != null ||
      p.nutriments.proteins_100g != null ||
      p.nutriments.carbohydrates_100g != null);
  return Boolean(hasIngredients && hasNutriments);
}

export async function enrichProduct(p: ProductResult): Promise<ProductResult> {
  try {
    if (hasCompleteInfo(p)) return p;
    const q = [p.product_name, p.brands].filter(Boolean).join(" ").trim();
    if (!q) return p;
    const { lookupProductOnline } = await import("@/lib/lookup-product-online");
    const lookedUp = await lookupProductOnline(q);
    if (!lookedUp) return p;
    return {
      ...p,
      ingredients_text: p.ingredients_text || lookedUp.ingredients_text,
      ingredients_text_en: p.ingredients_text_en || lookedUp.ingredients_text_en || p.ingredients_text || lookedUp.ingredients_text,
      ingredients_tags: p.ingredients_tags?.length ? p.ingredients_tags : lookedUp.ingredients_tags,
      nutriments: mergeNutriments(p.nutriments, lookedUp.nutriments),
      serving_size: p.serving_size || lookedUp.serving_size,
      image_url: p.image_url || lookedUp.image_url,
      image_small_url: p.image_small_url || lookedUp.image_small_url,
      allergens_tags: p.allergens_tags?.length ? p.allergens_tags : lookedUp.allergens_tags,
      generic_name: p.generic_name || lookedUp.generic_name,
      generic_name_en: p.generic_name_en || lookedUp.generic_name_en,
    };
  } catch (e) {
    logError("enrichProduct error:", e);
    return p;
  }
}

function mergeNutriments(
  a: ProductResult["nutriments"],
  b: ProductResult["nutriments"]
): ProductResult["nutriments"] | undefined {
  if (!a && !b) return undefined;
  const merged = { ...(a ?? {}), ...(b ?? {}) };
  const keys = ["energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "sodium_100g", "sugars_100g"] as const;
  for (const k of keys) {
    const av = a?.[k];
    const bv = b?.[k];
    if (av != null && typeof av === "number" && Number.isFinite(av)) (merged as Record<string, number>)[k] = av;
    else if (bv != null && typeof bv === "number" && Number.isFinite(bv)) (merged as Record<string, number>)[k] = bv;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export async function searchProductsOnline(query: string): Promise<ProductResult[]> {
  try {
    const { supabase } = await import("@/lib/supabase");
    if (!supabase) return [];
    const trimmed = query.trim();
    if (!trimmed) return [];
    const result = await supabase.functions.invoke("search-products-online", {
      body: { query: trimmed },
    });
    if (result.error || !result.data?.products || !Array.isArray(result.data.products)) return [];
    return result.data.products.map((p: Record<string, unknown>, i: number) => ({
      code: (p.code as string) ?? `online-${Date.now()}-${i}`,
      product_name: (p.product_name as string) ?? "Unknown product",
      product_name_en: (p.product_name_en as string) ?? (p.product_name as string),
      generic_name: p.generic_name as string | undefined,
      generic_name_en: p.generic_name_en as string | undefined,
      brands: p.brands ? String(p.brands) : undefined,
      ingredients_text: p.ingredients_text ? String(p.ingredients_text) : undefined,
      ingredients_text_en: (p.ingredients_text_en as string) ?? (p.ingredients_text as string),
      nutriments: p.nutriments as ProductResult["nutriments"],
      serving_size: p.serving_size as string | undefined,
      image_url: p.image_url as string | undefined,
      image_small_url: p.image_small_url as string | undefined,
    })) as ProductResult[];
  } catch (e) {
    logError("searchProductsOnline error:", e);
    return [];
  }
}

const SEARCH_TIMEOUT_MS = 6000;
const ONLINE_TIMEOUT_MS = 3000;

const QUERY_VARIANTS: Record<string, string[]> = {
  poptart: ["pop-tart", "pop tart", "pop tarts"],
  "pop-tart": ["pop tart", "poptart", "pop tarts"],
  bacon: ["bacon strips", "smoked bacon"],
  coffee: ["ground coffee", "instant coffee"],
  pancake: ["pancake mix", "pancakes"],
  granola: ["granola bar"],
  chocolate: ["chocolate bar"],
};

function getQueryVariants(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q || q.includes(" ")) return [query];
  const variants = QUERY_VARIANTS[q];
  return variants ? [q, ...variants] : [q];
}

async function fetchCandidates(
  queryText: string,
  brandText: string | undefined,
  countryCode: string | undefined,
  pageSize: number
): Promise<ProductResult[]> {
  const { searchProducts, searchProductsWithSimilar, getPopularProductsInCountry } = await import(
    "@/lib/open-food-facts"
  );
  const seen = new Set<string>();

  const variants = getQueryVariants(queryText).slice(0, 5);
  const queries = [queryText, ...variants.filter((v) => v !== queryText.trim().toLowerCase())];

  const promises: Promise<ProductResult[]>[] = [
    searchProductsWithSimilar(queryText, pageSize * 2, SEARCH_TIMEOUT_MS, countryCode),
    ...queries.slice(0, 4).map((q) => searchProducts(q, pageSize, SEARCH_TIMEOUT_MS, countryCode)),
    countryCode ? searchProducts(queryText, pageSize, SEARCH_TIMEOUT_MS, undefined) : Promise.resolve([]),
  ];

  const onlinePromise = Promise.race([
    searchProductsOnline(queryText),
    new Promise<ProductResult[]>((_, rej) => setTimeout(() => rej(new Error("timeout")), ONLINE_TIMEOUT_MS)),
  ]).catch(() => []);

  const results = (await Promise.all([...promises, onlinePromise])) as ProductResult[][];
  const merged: ProductResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const list = results[i] ?? [];
    if (DEBUG) log(`fetchCandidates source ${i}: ${list.length} items`);
    for (const p of list) {
      const key = `${(p.product_name ?? "").toLowerCase()}-${(p.brands ?? "").toLowerCase()}`;
      if (key.trim() && !seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
  }

  if (merged.length === 0) {
    log("No candidates from API, fetching popular in country");
    const popular = await getPopularProductsInCountry(countryCode, pageSize * 2, SEARCH_TIMEOUT_MS);
    for (const p of popular) {
      const key = `${(p.product_name ?? "").toLowerCase()}-${(p.brands ?? "").toLowerCase()}`;
      if (key.trim() && !seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
  }

  return merged;
}

export interface SearchOptions {
  pageSize?: number;
  countryCode?: string;
  /** For Describe: optional brand to prioritize */
  brandText?: string;
}

/**
 * Unified Search/Describe pipeline. ALWAYS returns results.
 * Ranked by: similarity + brandBoost + countryBoost.
 * Fallbacks: fuzzy match → popular in country → default popular list.
 */
export async function searchProductsUnified(
  query: string,
  options: SearchOptions = {}
): Promise<ProductResult[]> {
  const trimmed = query.trim();
  const pageSize = options.pageSize ?? 30;
  const countryCode = options.countryCode;
  const brandText = options.brandText?.trim();

  if (!trimmed) {
    try {
      const { getHealthProfile } = await import("@/lib/storage");
      const { getPopularProductsInCountry } = await import("@/lib/open-food-facts");
      const profile = await getHealthProfile().catch(() => null);
      const cc = profile?.countryCode ?? countryCode;
      return getPopularProductsInCountry(cc, pageSize, SEARCH_TIMEOUT_MS);
    } catch {
      return [];
    }
  }

  try {
    const { getHealthProfile } = await import("@/lib/storage");
    const profile = await getHealthProfile().catch(() => null);
    const effectiveCountry = profile?.countryCode ?? countryCode;

    log("searchProductsUnified:", {
      query: trimmed,
      countryCode: effectiveCountry ?? "(none)",
      brandText: brandText ?? "(none)",
      generic: isGenericQuery(trimmed),
    });

    const candidates = await fetchCandidates(trimmed, brandText, effectiveCountry, pageSize);

    if (DEBUG) {
      log("Candidates:", candidates.length);
      if (candidates.length > 0) {
        log("Top 5 raw:", candidates.slice(0, 5).map((p) => p.product_name?.slice(0, 40)));
      }
    }

    let ranked = rankProducts(candidates, {
      queryText: trimmed,
      brandText,
      countryCode: effectiveCountry,
      pageSize,
    });

    if (ranked.length === 0 && candidates.length > 0) {
      ranked = rankProducts(candidates, {
        queryText: trimmed,
        brandText: undefined,
        countryCode: effectiveCountry,
        pageSize,
      });
    }

    if (ranked.length === 0) {
      const { getPopularProductsInCountry } = await import("@/lib/open-food-facts");
      ranked = await getPopularProductsInCountry(effectiveCountry, pageSize, SEARCH_TIMEOUT_MS);
      ranked = rankProducts(ranked, {
        queryText: trimmed,
        brandText,
        countryCode: effectiveCountry,
        pageSize,
      });
    }

    const final = ranked.slice(0, pageSize);

    try {
      const toEnrich = final.filter((p) => !hasCompleteInfo(p)).slice(0, 6);
      if (toEnrich.length > 0) {
        const enriched = await Promise.all(toEnrich.map((p) => enrichProduct(p)));
        return final.map((p) => {
          const key = `${(p.product_name ?? "").toLowerCase()}-${(p.brands ?? "").toLowerCase()}`;
          const e = enriched.find(
            (x) => `${(x.product_name ?? "").toLowerCase()}-${(x.brands ?? "").toLowerCase()}` === key
          );
          return e ?? p;
        });
      }
    } catch (e) {
      logError("Enrich error:", e);
    }

    return final;
  } catch (e) {
    logError("searchProductsUnified error:", e);
    try {
      const { getPopularProductsInCountry } = await import("@/lib/open-food-facts");
      const { getHealthProfile } = await import("@/lib/storage");
      const profile = await getHealthProfile().catch(() => null);
      return getPopularProductsInCountry(profile?.countryCode ?? countryCode, pageSize, SEARCH_TIMEOUT_MS);
    } catch (fallbackError) {
      logError("Fallback error:", fallbackError);
      return [];
    }
  }
}
