import type { ProductResult } from "@/types/food";
import { addPendingBarcode, cacheProduct, getCachedProduct, isOnline } from "@/lib/offline";

const BASE_URL = "https://world.openfoodfacts.org";
const BASE_ALT = "https://world.openfoodfacts.net";
const SEARCH_V2_URL = `${BASE_URL}/api/v2/search`;
const SEARCH_V2_ALT = `${BASE_ALT}/api/v2/search`;
const SEARCH_LEGACY_URL = `${BASE_URL}/cgi/search.pl`;
const SEARCH_LEGACY_ALT = `${BASE_ALT}/cgi/search.pl`;

interface OffProductResponse {
  code: string;
  product?: {
    product_name?: string;
    product_name_en?: string;
    generic_name?: string;
    generic_name_en?: string;
    brands?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    ingredients_tags?: string[];
    nutriments?: Record<string, unknown>;
    serving_size?: string;
    additives_tags?: string[];
    additives_n?: number;
    allergens_tags?: string[];
    allergens_from_ingredients?: string;
    nutriscore_grade?: string;
    nova_group?: number;
    categories_tags?: string[];
    countries_tags?: string[];
    image_url?: string;
    image_small_url?: string;
  };
  status?: number;
  status_verbose?: string;
}

interface OffSearchProduct {
  code: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients_tags?: string[];
  nutriments?: Record<string, unknown>;
  serving_size?: string;
  additives_tags?: string[];
  additives_n?: number;
  allergens_tags?: string[];
  allergens_from_ingredients?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  categories_tags?: string[];
  countries_tags?: string[];
  image_url?: string;
  image_small_url?: string;
}

interface OffSearchResponse {
  count?: number;
  products?: OffSearchProduct[];
}

function mapNutriments(raw: Record<string, unknown> | undefined): ProductResult["nutriments"] {
  if (!raw || typeof raw !== "object") return undefined;
  const n = raw as Record<string, number | undefined>;
  return {
    energy: n.energy,
    energy_serving: n.energy_serving,
    proteins: n.proteins ?? n.proteins_100g,
    carbohydrates: n.carbohydrates ?? n.carbohydrates_100g,
    fat: n.fat ?? n.fat_100g,
    fiber: n.fiber ?? n.fiber_100g,
    sodium: n.sodium != null ? n.sodium * 1000 : n.sodium_100g != null ? n.sodium_100g * 1000 : undefined,
    sodium_serving: n.sodium_serving != null ? n.sodium_serving * 1000 : undefined,
    sugars: n.sugars ?? n.sugars_100g,
    sugars_serving: n.sugars_serving,
    "energy-kcal_100g": n["energy-kcal_100g"] ?? n["energy-kcal"],
    "proteins_100g": n.proteins_100g,
    "carbohydrates_100g": n.carbohydrates_100g,
    "fat_100g": n.fat_100g,
    "fiber_100g": n.fiber_100g,
    "sodium_100g": n.sodium_100g != null ? n.sodium_100g * 1000 : undefined,
    "sugars_100g": n.sugars_100g,
  };
}

function toProductResult(
  code: string,
  p: OffProductResponse["product"] | OffSearchProduct
): ProductResult {
  const raw = p as OffSearchProduct & { nutriments?: Record<string, unknown> };
  return {
    code: code || raw.code,
    product_name: raw.product_name ?? "",
    product_name_en: raw.product_name_en,
    generic_name: raw.generic_name,
    generic_name_en: raw.generic_name_en,
    brands: raw.brands,
    ingredients_text: raw.ingredients_text,
    ingredients_text_en: raw.ingredients_text_en,
    ingredients_tags: raw.ingredients_tags,
    nutriments: mapNutriments(raw.nutriments),
    serving_size: raw.serving_size,
    additives_tags: raw.additives_tags,
    additives_n: raw.additives_n,
    allergens_tags: raw.allergens_tags,
    allergens_from_ingredients: raw.allergens_from_ingredients,
    nutriscore_grade: raw.nutriscore_grade,
    nova_group: raw.nova_group,
    categories_tags: raw.categories_tags,
    countries_tags: raw.countries_tags,
    image_url: raw.image_url,
    image_small_url: raw.image_small_url,
  };
}

export async function getProductByBarcode(barcode: string): Promise<ProductResult | null> {
  const trimmed = String(barcode).trim();
  if (!trimmed) return null;
  const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(trimmed)}.json?lc=en`;
  const online = await isOnline().catch(() => true);
  if (!online) {
    await addPendingBarcode(trimmed);
    const cached = await getCachedProduct(trimmed);
    return cached;
  }
  try {
    const res = await fetch(url);
    const data = (await res.json()) as OffProductResponse;
    if (data.status !== 1 || !data.product) return null;
    const product = toProductResult(data.code, data.product);
    cacheProduct(product).catch(() => {});
    return product;
  } catch {
    // fallback to cache if network request fails
    const cached = await getCachedProduct(trimmed);
    return cached;
  }
}

const SEARCH_TIMEOUT_MS = 4000;
/** Max 4 seconds per search. Total search time ≈ 4 sec when all run in parallel. */
export const LABEL_SEARCH_TIMEOUT_MS = 4000;

/** V2 search response: products array may be flat or have nested product */
interface OffSearchV2Response {
  count?: number;
  products?: (OffSearchProduct & { product?: OffSearchProduct })[];
}

/** Normalize text for fuzzy matching: lowercase, remove apostrophes/hyphens, collapse whitespace. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score a product for relevance (higher = better). Google-like: keyword matching, most related at top.
 * Weights: full phrase match > product_name keyword match > brand match > category match.
 */
function scoreMatch(p: ProductResult, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const productName = ((p.product_name ?? "") + " " + (p.product_name_en ?? "")).toLowerCase();
  const brandStr = (p.brands ?? "").toLowerCase();
  const genericStr = ((p.generic_name ?? "") + " " + (p.generic_name_en ?? "")).toLowerCase();
  const categoryStr = (p.categories_tags?.join(" ") ?? "").toLowerCase();
  const searchable = [productName, brandStr, genericStr, categoryStr].filter(Boolean).join(" ");
  const searchableNorm = normalizeForMatch(searchable);
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const wordsNorm = words.map((w) => normalizeForMatch(w));
  if (!searchable) return 0;

  let score = 0;
  const fullMatch = searchable.includes(q) || searchableNorm.includes(normalizeForMatch(q));
  if (fullMatch) score += 150;

  const productNorm = normalizeForMatch(productName);
  const brandNorm = normalizeForMatch(brandStr);
  const genericNorm = normalizeForMatch(genericStr);
  const categoryNorm = normalizeForMatch(categoryStr);

  for (const w of wordsNorm) {
    if (!w) continue;
    const inProduct = productNorm.includes(w) || productName.includes(w);
    const inBrand = brandNorm.includes(w) || brandStr.includes(w);
    const inGeneric = genericNorm.includes(w) || genericStr.includes(w);
    const inCategory = categoryNorm.includes(w) || categoryStr.includes(w);
    if (inProduct) score += 30;
    else if (inBrand) score += 25;
    else if (inGeneric) score += 20;
    else if (inCategory) score += 10;
  }

  const firstWord = wordsNorm[0] ?? "";
  const nameStartsWith = productName.startsWith(firstWord) || productNorm.startsWith(normalizeForMatch(firstWord));
  if (nameStartsWith) score += 25;

  return score;
}

/** Check if a product matches the search query (used to reject irrelevant online lookup results). Requires whole-word matching for brand-like terms so "KIND" does not match "Kinder". */
export function productMatchesQuery(p: ProductResult, query: string): boolean {
  if (scoreMatch(p, query) <= 0) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const wordsNorm = words.map((w) => normalizeForMatch(w));
  const primary = primarySearchable(p);
  const primaryNorm = normalizeForMatch(primary);
  const allNonGenericMatch = wordsNorm.every((w) => {
    if (!w) return true;
    if (GENERIC_QUERY_WORDS.has(w)) return true;
    return containsWholeWord(primary, w) || containsWholeWord(primaryNorm, w);
  });
  return allNonGenericMatch;
}

/** Primary searchable fields (excludes categories which can cause false matches, e.g. "kind of chocolate" matching KIND). */
function primarySearchable(p: ProductResult): string {
  const s = [
    p.product_name,
    p.product_name_en,
    p.generic_name,
    p.generic_name_en,
    p.brands,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return s;
}

/** Return true if text contains word as a whole token (so "kind" matches "kind" but not "kinder"). */
function containsWholeWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/** Generic product/descriptor words that don't imply a brand. Brand-like words (KIND, Lindt, Starbucks) must match the product. */
const GENERIC_QUERY_WORDS = new Set([
  "bar", "bars", "granola", "chocolate", "snack", "snacks", "organic", "dark", "milk",
  "pancake", "pancakes", "waffle", "waffles", "muffin", "muffins", "cereal", "bread",
  "coffee", "tea", "latte", "espresso", "cappuccino", "americano", "frappuccino",
  "bacon", "yogurt", "yoghurt", "cheese", "butter", "eggs", "rice", "pasta", "nuts",
  "sugar", "free", "low", "high", "protein", "natural", "crunchy", "soft", "hard",
  "mini", "large", "small", "original", "classic", "crispy", "chewy", "sweet",
  "salty", "nuts", "fruit", "oat", "oats", "honey", "almond", "peanut", "coconut",
  "vanilla", "strawberry", "blueberry", "raspberry", "apple", "banana", "cinnamon",
  "food", "product", "item", "the", "a", "an", "of", "and", "or",
]);

/** Extract recognized brand and product terms from query. Brand is prioritized when present. */
export function parseQueryForBrand(query: string): { brand: string | null; productTerms: string } {
  const trimmed = String(query).trim();
  if (!trimmed) return { brand: null, productTerms: "" };
  const words = trimmed.split(/\s+/).filter(Boolean);
  const nonGeneric = words.filter((w) => w.length > 0 && !GENERIC_QUERY_WORDS.has(w.toLowerCase()));
  if (nonGeneric.length === 0) return { brand: null, productTerms: trimmed };
  const brand = nonGeneric.length >= 1 ? (nonGeneric[nonGeneric.length - 1] ?? null) : null;
  const productTerms = words.filter((w) => w.toLowerCase() !== brand?.toLowerCase()).join(" ").trim();
  return { brand, productTerms };
}

/**
 * Keep products that match the query. Keyword-based: at least one query word must match.
 * For brand-like words (KIND, Lindt) require whole-word match to avoid "Kinder" for "KIND".
 * For generic words (pancake, granola) allow substring match (pancake matches pancakes).
 */
export function filterResultsByQuery(products: ProductResult[], query: string): ProductResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return products;
  const wordsNorm = words.map((w) => normalizeForMatch(w));
  const allGeneric = wordsNorm.every((w) => GENERIC_QUERY_WORDS.has(w));
  const categoryStr = (p: ProductResult) => (p.categories_tags ?? []).join(" ").toLowerCase();
  return products.filter((p) => {
    const score = scoreMatch(p, query);
    if (score <= 0) return false;
    const primary = primarySearchable(p);
    const primaryNorm = normalizeForMatch(primary);
    const categories = categoryStr(p);
    const compact = (s: string) => normalizeForMatch(s).replace(/\s+/g, "").replace(/-/g, "");
    const hasPrimaryMatch = wordsNorm.some((w) => {
      if (!w) return false;
      if (primary.includes(w) || primaryNorm.includes(w) || primary.includes(w + "s") || primaryNorm.includes(w + "s")) return true;
      const wCompact = compact(w);
      const primaryCompact = compact(primary);
      if (wCompact.length >= 4 && (primaryCompact.includes(wCompact) || wCompact.includes(primaryCompact))) return true;
      return false;
    });
    const hasCategoryMatch = allGeneric && wordsNorm.some((w) =>
      w && (categories.includes(w) || categories.includes(w + "s")))
    ;
    if (!hasPrimaryMatch && !hasCategoryMatch) return false;
    if (allGeneric) return true;
    const allNonGenericMatch = wordsNorm.every((w) => {
      if (!w) return true;
      if (GENERIC_QUERY_WORDS.has(w)) return true;
      return containsWholeWord(primary, w) || containsWholeWord(primaryNorm, normalizeForMatch(w));
    });
    return allNonGenericMatch;
  });
}

/** Check if product's brand field matches the given brand. Uses whole-word matching so "KIND" does not match "Kinder". */
function productBrandMatches(p: ProductResult, brand: string): boolean {
  const b = p.brands ?? "";
  const brandWords = brand.split(/\s+/).filter(Boolean);
  return brandWords.length > 0 && brandWords.every((w) => containsWholeWord(b, w));
}

/** Sort by relevance (most similar first). Products whose brand matches the query's brand rank higher. */
export function sortByRelevance(products: ProductResult[], query: string, recognizedBrand?: string | null): ProductResult[] {
  const q = query.trim();
  if (!q) return products;
  const brand = recognizedBrand ?? parseQueryForBrand(query).brand;
  return products
    .map((p, idx) => {
      const baseScore = scoreMatch(p, query);
      const brandBonus = brand && productBrandMatches(p, brand) ? 200 : 0;
      return { p, score: baseScore + brandBonus, idx };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map(({ p }) => p);
}

export async function searchProducts(
  query: string,
  pageSize = 20,
  timeoutMs = SEARCH_TIMEOUT_MS,
  countryCode?: string
): Promise<ProductResult[]> {
  const trimmed = String(query).trim();
  if (!trimmed) return [];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  /** Request more when country is set so we get broader coverage in the selected country. */
  const size = Math.min(Math.max(pageSize, 20), countryCode?.trim() ? 50 : 30);

  const tryV2 = async (signal: AbortSignal, cc?: string, searchQuery?: string): Promise<ProductResult[]> => {
    const q = searchQuery ?? trimmed;
    const params = new URLSearchParams({
      q,
      lc: "en",
      page_size: String(size),
      sort_by: "unique_scans_n", // Biggest to smallest brands (by scan count as proxy)
    });
    if (cc?.trim()) {
      params.set("countries_tags", cc.trim());
    }
    const queryStr = params.toString();
    const v2Urls = [SEARCH_V2_URL, SEARCH_V2_ALT];
    let lastErr: unknown;
    for (const url of v2Urls) {
      try {
        const res = await fetch(`${url}?${queryStr}`, {
          signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "FoodScan-App/1.0 (https://github.com/openfoodfacts)",
          },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as OffSearchV2Response;
        const products = data.products ?? [];
        return products
          .filter((p) => {
            const flat = p as OffSearchProduct & { _id?: string };
            const nested = (p as { product?: OffSearchProduct }).product;
            const code = flat.code ?? flat._id ?? nested?.code;
            const name = flat.product_name ?? flat.product_name_en ?? nested?.product_name ?? nested?.product_name_en;
            const brands = flat.brands ?? nested?.brands;
            return code && (name || brands);
          })
          .map((p) => {
            const flat = p as OffSearchProduct & { product_name?: string; product_name_en?: string; _id?: string };
            const nested = (p as { product?: OffSearchProduct }).product;
            const code = flat.code ?? flat._id ?? nested?.code ?? "";
            const use = nested && (nested.product_name ?? nested.product_name_en ?? nested.brands) ? nested : flat;
            return toProductResult(code, use);
          });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("V2 search failed");
  };

  const tryLegacy = async (signal: AbortSignal, cc?: string, searchQuery?: string): Promise<ProductResult[]> => {
    const q = searchQuery ?? trimmed;
    const params = new URLSearchParams({
      action: "process",
      search_terms: q,
      json: "1",
      page_size: String(size),
      lc: "en",
      sort_by: "unique_scans_n", // Biggest to smallest brands (by scan count as proxy)
    });
    if (cc?.trim()) {
      params.set("tagtype_0", "countries");
      params.set("tag_contains_0", "contains");
      params.set("tag_0", cc.trim());
    }
    const queryStr = params.toString();
    const legacyUrls = [SEARCH_LEGACY_URL, SEARCH_LEGACY_ALT];
    let lastErr: unknown;
    for (const url of legacyUrls) {
      try {
        const res = await fetch(`${url}?${queryStr}`, {
          signal,
          headers: { "User-Agent": "FoodScan-App/1.0 (https://github.com/openfoodfacts)" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as OffSearchResponse;
        const products = data.products ?? [];
        return products
          .filter((p) => p.code && (p.product_name || p.generic_name || p.brands))
          .map((p) => toProductResult(p.code, p));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("Legacy search failed");
  };

  const isAbort = (e: unknown) =>
    e instanceof Error && e.name === "AbortError";

  const applyFilter = (list: ProductResult[], q?: string) => filterResultsByQuery(list, q ?? trimmed);
  const applySort = (list: ProductResult[], q?: string) => sortByRelevance(list, q ?? trimmed);

  /** Legacy API returns better brand matches (e.g. KIND); V2 often returns irrelevant results. Try Legacy first. */
  const runLegacy = (signal: AbortSignal, cc?: string, searchQuery?: string) =>
    tryLegacy(signal, cc, searchQuery).catch((e) => (isAbort(e) ? [] : Promise.reject(e)));
  const runV2 = (signal: AbortSignal, cc?: string, searchQuery?: string) =>
    tryV2(signal, cc, searchQuery).catch((e) => (isAbort(e) ? [] : Promise.reject(e)));

  try {
    let legacyList = await runLegacy(controller.signal, countryCode);
    let filteredLegacy = applyFilter(legacyList);
    let result: ProductResult[] = applySort(filteredLegacy.length > 0 ? filteredLegacy : legacyList, trimmed);

    if (result.length === 0) {
      const v2List = await runV2(controller.signal, countryCode);
      const filteredV2 = applyFilter(v2List);
      result = applySort(filteredV2.length > 0 ? filteredV2 : v2List, trimmed);
    }

    if (result.length === 0 && countryCode?.trim()) {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
      legacyList = await runLegacy(controller2.signal);
      clearTimeout(timeoutId2);
      filteredLegacy = applyFilter(legacyList);
      const useLegacy = filteredLegacy.length > 0 ? filteredLegacy : legacyList;
      if (useLegacy.length > 0) {
        result = applySort(useLegacy, trimmed);
      } else {
        const controller3 = new AbortController();
        const timeoutId3 = setTimeout(() => controller3.abort(), timeoutMs);
        const v2List = await runV2(controller3.signal);
        clearTimeout(timeoutId3);
        const filteredV2 = applyFilter(v2List);
        result = applySort(filteredV2.length > 0 ? filteredV2 : v2List, trimmed);
      }
    }

    if (result.length === 0 && trimmed.split(/\s+/).length > 1) {
      const { brand: parsedBrand } = parseQueryForBrand(trimmed);
      const firstWord = trimmed.split(/\s+/)[0]?.trim();
      const fallbacks = [
        parsedBrand && parsedBrand.length >= 2 ? parsedBrand : null,
        parsedBrand?.toUpperCase() === "KIND" ? "KIND Snacks" : null,
        firstWord && firstWord.length >= 2 ? firstWord : null,
      ].filter(Boolean) as string[];
      const simplified = fallbacks[0] ?? (trimmed.replace(/[''-]/g, " ").split(/\s+/)[0] ?? trimmed);
      const variants = simplified === "KIND" ? ["KIND", "KIND Snacks"] : [simplified];
      for (const variant of variants) {
        if (variant === trimmed) continue;
        const controller4 = new AbortController();
        const timeoutId4 = setTimeout(() => controller4.abort(), timeoutMs);
        const legacyAlt = await runLegacy(controller4.signal, countryCode, variant);
        clearTimeout(timeoutId4);
        let altResult = filterResultsByQuery(legacyAlt, variant);
        if (altResult.length === 0) {
          const controller5 = new AbortController();
          const timeoutId5 = setTimeout(() => controller5.abort(), timeoutMs);
          const v2Alt = await runV2(controller5.signal, countryCode, variant);
          clearTimeout(timeoutId5);
          altResult = filterResultsByQuery(v2Alt, variant);
        }
        if (altResult.length > 0) {
          const refiltered = filterResultsByQuery(altResult, trimmed);
          result = applySort(refiltered.length > 0 ? refiltered : altResult, trimmed);
          break;
        }
      }
    }

    return result.slice(0, pageSize);
  } catch (e) {
    clearTimeout(timeoutId);
    if (isAbort(e)) return [];
    throw e;
  }
}

/**
 * Search for products. Recognizes brand first when present (e.g. "Granola bar KIND"), then filters
 * to products from that brand. Brand results are prioritized.
 */
export async function searchProductsWithSimilar(
  query: string,
  pageSize = 30,
  timeoutMs = SEARCH_TIMEOUT_MS,
  countryCode?: string
): Promise<ProductResult[]> {
  const trimmed = String(query).trim();
  if (!trimmed) return [];

  const { brand: recognizedBrand, productTerms } = parseQueryForBrand(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const product = words.length >= 2 ? words.slice(0, -1).join(" ").trim() : "";
  const brand = recognizedBrand ?? (words.length >= 2 ? words[words.length - 1]!.trim() : "");

  const brandQ = brand && brand.toLowerCase() !== trimmed.toLowerCase();
  const productQ = product && product.toLowerCase() !== trimmed.toLowerCase();

  const [mainList, brandList, productList] = await Promise.all([
    searchProducts(trimmed, pageSize, timeoutMs, countryCode),
    brandQ ? searchProducts(brand, 20, timeoutMs, countryCode) : Promise.resolve([]),
    productQ ? searchProducts(product, 12, timeoutMs, countryCode) : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  let merged: ProductResult[] = [];
  for (const p of [...brandList, ...mainList, ...productList]) {
    if (!seen.has(p.code)) {
      seen.add(p.code);
      merged.push(p);
    }
  }
  const filtered = filterResultsByQuery(merged, trimmed);
  if (filtered.length === 0) return [];
  return sortByRelevance(filtered, trimmed, recognizedBrand ?? (brand || undefined)).slice(0, pageSize);
}

/** Default/average nutriments per 100g when no product data is found (generic food estimate). */
const DEFAULT_NUTRIMENTS: ProductResult["nutriments"] = {
  "energy-kcal_100g": 200,
  proteins_100g: 5,
  carbohydrates_100g: 25,
  fat_100g: 10,
  sodium_100g: 400,
  sugars_100g: 10,
};

/**
 * Try to get average nutriments by searching for similar products (e.g. "iced coffee").
 * Returns averaged values from top results, or DEFAULT_NUTRIMENTS if none found.
 */
export async function getAverageNutrimentsForQuery(
  query: string
): Promise<ProductResult["nutriments"]> {
  const products = await searchProducts(query, 10);
  if (products.length === 0) return DEFAULT_NUTRIMENTS;
  const withNut = products.filter((p) => p.nutriments && (p.nutriments["energy-kcal_100g"] != null || p.nutriments.proteins_100g != null));
  if (withNut.length === 0) return DEFAULT_NUTRIMENTS;
  const n = withNut.length;
  const sum = (key: keyof NonNullable<ProductResult["nutriments"]>) => {
    let s = 0;
    let count = 0;
    for (const p of withNut) {
      const v = p.nutriments?.[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        s += v;
        count++;
      }
    }
    return count ? s / count : undefined;
  };
  return {
    "energy-kcal_100g": sum("energy-kcal_100g") ?? DEFAULT_NUTRIMENTS["energy-kcal_100g"],
    proteins_100g: sum("proteins_100g") ?? DEFAULT_NUTRIMENTS.proteins_100g,
    carbohydrates_100g: sum("carbohydrates_100g") ?? DEFAULT_NUTRIMENTS.carbohydrates_100g,
    fat_100g: sum("fat_100g") ?? DEFAULT_NUTRIMENTS.fat_100g,
    sodium_100g: sum("sodium_100g") ?? DEFAULT_NUTRIMENTS.sodium_100g,
    sugars_100g: sum("sugars_100g") ?? DEFAULT_NUTRIMENTS.sugars_100g,
  };
}

/** Fetch popular products in country (fallback when search returns 0). Tries each term individually to tolerate partial network failures. */
export async function getPopularProductsInCountry(
  countryCode: string | undefined,
  pageSize = 30,
  timeoutMs = SEARCH_TIMEOUT_MS
): Promise<ProductResult[]> {
  const broadTerms = ["snacks", "cereal", "chocolate", "bread", "cheese", "milk", "yogurt", "pasta", "rice"];
  const seen = new Set<string>();
  const merged: ProductResult[] = [];

  const tryTerm = async (term: string, cc: string | undefined, retries = 1): Promise<ProductResult[]> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await searchProducts(term, Math.ceil(pageSize / 3), timeoutMs, cc);
      } catch (e) {
        if (attempt === retries && __DEV__) {
          console.warn("[getPopularProductsInCountry] term skipped:", term, (e as Error)?.message ?? e);
        }
      }
    }
    return [];
  };

  const addFrom = (list: ProductResult[]) => {
    for (const p of list) {
      const key = `${(p.product_name ?? "").toLowerCase()}-${(p.brands ?? "").toLowerCase()}`;
      if (key.trim() && !seen.has(key)) {
        seen.add(key);
        merged.push(p);
        if (merged.length >= pageSize) return;
      }
    }
  };

  for (const term of countryCode ? broadTerms.slice(0, 6) : broadTerms) {
    const list = await tryTerm(term, countryCode ?? undefined);
    addFrom(list);
    if (merged.length >= pageSize) return merged.slice(0, pageSize);
  }

  for (const term of broadTerms) {
    const list = await tryTerm(term, undefined);
    addFrom(list);
    if (merged.length >= pageSize) return merged.slice(0, pageSize);
  }

  if (merged.length > 0) return merged.slice(0, pageSize);

  try {
    const online = await isOnline().catch(() => false);
    if (!online) {
      const { getScanHistory } = await import("@/lib/storage");
      const history = await getScanHistory();
      const products = history.map((r) => r.product).filter((p) => p?.product_name);
      return products.slice(0, pageSize);
    }
  } catch {
    // Ignore offline fallback errors
  }

  return merged.slice(0, pageSize);
}
