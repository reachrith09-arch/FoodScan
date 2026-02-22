/**
 * Search ranking pipeline for Search and Describe features.
 * Ensures results are always returned, ranked by similarity, with country and brand boosts.
 */
import type { ProductResult } from "@/types/food";

const DEBUG = __DEV__;

function log(...args: unknown[]) {
  if (DEBUG) console.log("[SearchRanking]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[SearchRanking]", ...args);
}

/** Normalize text for comparison: lowercase, collapse whitespace, remove hyphens/apostrophes. */
export function normalizeText(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compact form (no spaces) for fuzzy matching: "pop-tart" and "poptart" both become "poptart". */
function compact(s: string): string {
  return normalizeText(s).replace(/\s+/g, "").replace(/-/g, "");
}

/** Generic query words that indicate low specificity. */
const GENERIC_WORDS = new Set([
  "food", "snack", "snacks", "drink", "drinks", "meat", "bread", "chicken", "candy", "chips",
  "sauce", "product", "item", "thing", "something", "anything", "breakfast", "lunch", "dinner",
  "bar", "bars", "granola", "chocolate", "organic", "dark", "milk", "cereal", "coffee", "tea",
  "bread", "bacon", "yogurt", "cheese", "butter", "eggs", "rice", "pasta", "nuts", "fruit",
  "apple", "banana", "orange", "the", "a", "an", "of", "and", "or",
]);

/** Detect if query is generic (low specificity). */
export function isGenericQuery(query: string): boolean {
  const q = normalizeText(query);
  if (!q || q.length < 2) return true;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const allGeneric = words.every((w) => w.length < 3 || GENERIC_WORDS.has(w));
  return allGeneric;
}

/** Levenshtein distance for fuzzy typo matching. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Compute similarity score: exact > prefix > substring > token overlap > fuzzy. */
export function computeSimilarityScore(product: ProductResult, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const name = (product.product_name ?? "") + " " + (product.product_name_en ?? "");
  const brand = product.brands ?? "";
  const generic = (product.generic_name ?? "") + " " + (product.generic_name_en ?? "");
  const categories = (product.categories_tags ?? []).join(" ");
  const searchable = [name, brand, generic, categories].filter(Boolean).join(" ").toLowerCase();
  const searchNorm = normalizeText(searchable);
  const qNorm = normalizeText(q);

  let score = 0;
  const qCompact = compact(q);
  const searchCompact = compact(searchable);

  // Exact match (highest)
  if (searchNorm.includes(qNorm) || searchCompact.includes(qCompact) || qCompact.includes(searchCompact.split(" ")[0] ?? "")) {
    if (name.toLowerCase().includes(qNorm) || brand.toLowerCase().includes(qNorm)) score += 100;
    else score += 80;
  }

  // Prefix match
  const words = qNorm.split(/\s+/).filter(Boolean);
  const searchWords = searchNorm.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length < 2) continue;
    if (searchNorm.startsWith(w) || searchWords.some((sw) => sw.startsWith(w) || w.startsWith(sw))) {
      score += 40;
      break;
    }
  }

  // Substring match
  for (const w of words) {
    if (w.length < 2) continue;
    if (searchNorm.includes(w)) score += 30;
    else if (searchCompact.includes(compact(w)) || (w.length >= 4 && searchCompact.includes(compact(w)))) score += 20;
  }

  // Token overlap
  const queryTokens = new Set(words.filter((w) => w.length >= 2));
  const matchCount = searchWords.filter((sw) => queryTokens.has(sw) || [...queryTokens].some((qt) => sw.includes(qt) || qt.includes(sw))).length;
  if (matchCount > 0) score += matchCount * 15;

  // Fuzzy (typos)
  for (const w of words) {
    if (w.length < 4) continue;
    const best = Math.min(
      ...searchWords.filter((sw) => sw.length >= 2).map((sw) => levenshtein(w, sw))
    );
    if (best <= 2) score += 25 - best * 10;
  }

  return score;
}

/** Compute brand boost when brandText is provided (Describe flow). */
export function computeBrandBoost(product: ProductResult, brandText: string): number {
  const brand = (product.brands ?? "").toLowerCase();
  const bt = normalizeText(brandText);
  if (!bt || !brand) return 0;

  if (brand === bt) return 80; // Exact match
  if (brand.includes(bt) || bt.includes(brand)) return 50; // Substring
  if (compact(brand).includes(compact(bt)) || compact(bt).includes(compact(brand))) return 40; // Fuzzy
  if (levenshtein(bt, brand) <= 2) return 30; // Typo
  return 0;
}

/** Compute country boost when product is available in user's country. */
export function computeCountryBoost(product: ProductResult, countryCode: string | undefined): number {
  if (!countryCode?.trim()) return 0;
  const cc = countryCode.toLowerCase().trim();
  const ccNorm = cc.startsWith("en:") ? cc : `en:${cc.replace(/\s+/g, "-")}`;
  const ccShort = cc.replace(/^en:/, "").replace(/-/g, "");
  const tags = (product.countries_tags ?? []).map((t) => t.toLowerCase());
  for (const t of tags) {
    if (t === ccNorm || t === cc) return 60;
    if (t.replace(/^en:/, "").replace(/-/g, "") === ccShort) return 60;
  }
  return 0;
}

/** Apply popularity tie-break: products available in more countries / with more data rank higher when generic. */
export function applyPopularityTieBreak(
  products: ProductResult[],
  countryCode: string | undefined
): ProductResult[] {
  return [...products].sort((a, b) => {
    const aInCountry = computeCountryBoost(a, countryCode) > 0 ? 1 : 0;
    const bInCountry = computeCountryBoost(b, countryCode) > 0 ? 1 : 0;
    if (aInCountry !== bInCountry) return bInCountry - aInCountry;
    const aCountries = (a.countries_tags ?? []).length;
    const bCountries = (b.countries_tags ?? []).length;
    if (aCountries !== bCountries) return bCountries - aCountries;
    const aHasNutrients = a.nutriments && (a.nutriments["energy-kcal_100g"] != null || a.nutriments.proteins_100g != null) ? 1 : 0;
    const bHasNutrients = b.nutriments && (b.nutriments["energy-kcal_100g"] != null || b.nutriments.proteins_100g != null) ? 1 : 0;
    return bHasNutrients - aHasNutrients;
  });
}

export interface RankOptions {
  queryText: string;
  brandText?: string;
  countryCode?: string;
  pageSize?: number;
}

/**
 * Rank and sort products. Uses similarity + brandBoost + countryBoost.
 * For generic queries, prioritizes popularity first.
 */
export function rankProducts(
  products: ProductResult[],
  options: RankOptions
): ProductResult[] {
  const { queryText, brandText, countryCode, pageSize = 30 } = options;
  const generic = isGenericQuery(queryText);
  const hasBrand = Boolean(brandText?.trim());

  const scored = products.map((p) => {
    const sim = computeSimilarityScore(p, queryText);
    const brandBoost = hasBrand ? computeBrandBoost(p, brandText!) : 0;
    const countryBoost = computeCountryBoost(p, countryCode);
    const total = sim + brandBoost + countryBoost;
    const popularity =
      (countryBoost > 0 ? 100 : 0) +
      (p.countries_tags ?? []).length * 5 +
      (p.nutriments && (p.nutriments["energy-kcal_100g"] != null || p.nutriments.proteins_100g != null) ? 10 : 0);
    return { product: p, score: total, sim, brandBoost, countryBoost, popularity };
  });

  const byScore = generic
    ? [...scored].sort((a, b) => {
        if (b.popularity !== a.popularity) return b.popularity - a.popularity;
        return b.score - a.score;
      })
    : [...scored].sort((a, b) => b.score - a.score);

  const productsOnly = byScore.map((x) => x.product);
  const result = generic ? applyPopularityTieBreak(productsOnly, countryCode).slice(0, pageSize) : productsOnly.slice(0, pageSize);

  if (DEBUG && result.length > 0) {
    log("rankProducts:", {
      query: queryText,
      brandText: brandText ?? "(none)",
      countryCode: countryCode ?? "(none)",
      generic,
      candidates: products.length,
      top10: byScore.slice(0, 10).map((x) => ({
        name: x.product.product_name?.slice(0, 30),
        score: Math.round(x.score),
        sim: Math.round(x.sim),
        brand: Math.round(x.brandBoost),
        country: Math.round(x.countryBoost),
        pop: x.popularity,
      })),
    });
  }

  return result;
}
