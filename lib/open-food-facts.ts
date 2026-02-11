import type { ProductResult } from "@/types/food";
import { addPendingBarcode, cacheProduct, getCachedProduct, isOnline } from "@/lib/offline";

const BASE_URL = "https://world.openfoodfacts.net";
const SEARCH_V2_URL = `${BASE_URL}/api/v2/search`;
const SEARCH_LEGACY_URL = "https://world.openfoodfacts.org/cgi/search.pl";

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

const SEARCH_TIMEOUT_MS = 8000;
/** Shorter timeout for label "Look up product" so describe-the-food feels faster. */
export const LABEL_SEARCH_TIMEOUT_MS = 5500;

/** V2 search response: products array may be flat or have nested product */
interface OffSearchV2Response {
  count?: number;
  products?: (OffSearchProduct & { product?: OffSearchProduct })[];
}

/** Score a product for relevance to query (higher = better). */
function scoreMatch(p: ProductResult, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = [
    p.product_name,
    p.product_name_en,
    p.generic_name,
    p.generic_name_en,
    p.brands,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!name) return 0;
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const fullMatch = name.includes(q) ? 100 : 0;
  const wordCount = words.filter((w) => name.includes(w)).length;
  const wordScore = words.length ? (wordCount / words.length) * 50 : 0;
  const startsWith = (p.product_name ?? "").toLowerCase().startsWith(words[0] ?? "") ? 20 : 0;
  return fullMatch + wordScore + startsWith;
}

/** Keep only products whose name or brand matches the search query (at least one word). */
function filterResultsByQuery(products: ProductResult[], query: string): ProductResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return products;
  return products
    .filter((p) => scoreMatch(p, query) > 0)
    .sort((a, b) => scoreMatch(b, query) - scoreMatch(a, query));
}

/** Prefer products sold in the user's country, then sort by relevance. */
function sortByCountryThenRelevance(
  products: ProductResult[],
  query: string,
  countryCode: string | undefined
): ProductResult[] {
  if (!countryCode?.trim()) {
    return products.sort((a, b) => scoreMatch(b, query) - scoreMatch(a, query));
  }
  const cc = countryCode.trim().toLowerCase();
  return [...products].sort((a, b) => {
    const aIn = a.countries_tags?.some((t) => t.toLowerCase().includes(cc)) ?? false;
    const bIn = b.countries_tags?.some((t) => t.toLowerCase().includes(cc)) ?? false;
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return scoreMatch(b, query) - scoreMatch(a, query);
  });
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
  const size = Math.min(Math.max(pageSize, 20), 30);

  const tryV2 = async (signal: AbortSignal): Promise<ProductResult[]> => {
    const params = new URLSearchParams({
      q: trimmed,
      lc: "en",
      page_size: String(size),
    });
    const res = await fetch(`${SEARCH_V2_URL}?${params.toString()}`, {
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "FoodScan-App/1.0 (https://github.com/openfoodfacts)",
      },
    });
    if (!res.ok) return [];
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
  };

  const tryLegacy = async (signal: AbortSignal): Promise<ProductResult[]> => {
    const params = new URLSearchParams({
      action: "process",
      search_terms: trimmed,
      json: "1",
      page_size: String(size),
      lc: "en",
    });
    const res = await fetch(`${SEARCH_LEGACY_URL}?${params.toString()}`, {
      signal,
      headers: { "User-Agent": "FoodScan-App/1.0 (https://github.com/openfoodfacts)" },
    });
    const data = (await res.json()) as OffSearchResponse;
    const products = data.products ?? [];
    return products
      .filter((p) => p.code && (p.product_name || p.generic_name || p.brands))
      .map((p) => toProductResult(p.code, p));
  };

  const isAbort = (e: unknown) =>
    e instanceof Error && e.name === "AbortError";

  const applyFilter = (list: ProductResult[]) => filterResultsByQuery(list, trimmed);

  // Run legacy and V2 in parallel so we wait max(L, V) instead of L+V.
  const legacyPromise = tryLegacy(controller.signal).catch((e) => (isAbort(e) ? [] : Promise.reject(e)));
  const v2Promise = tryV2(controller.signal).catch((e) => (isAbort(e) ? [] : Promise.reject(e)));

  try {
    const [legacyList, v2List] = await Promise.all([legacyPromise, v2Promise]);
    clearTimeout(timeoutId);
    const filteredLegacy = applyFilter(legacyList);
    const filteredV2 = applyFilter(v2List);
    let result: ProductResult[];
    if (filteredLegacy.length > 0) result = filteredLegacy;
    else if (filteredV2.length > 0) result = filteredV2;
    else {
      const merged = legacyList.length >= v2List.length ? legacyList : v2List;
      const fallback = applyFilter(merged.length ? merged : legacyList.length ? legacyList : v2List);
      result = fallback.length ? fallback : merged;
    }
    const sorted = sortByCountryThenRelevance(result, trimmed, countryCode);
    return sorted.slice(0, pageSize);
  } catch (e) {
    clearTimeout(timeoutId);
    if (isAbort(e)) return [];
    throw e;
  }
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
