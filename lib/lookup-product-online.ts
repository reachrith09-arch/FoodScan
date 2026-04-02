/**
 * Call Supabase lookup-product-online Edge Function when a product isn't in the database.
 * The backend searches the web and extracts product info automatically.
 * Results are validated against the query; irrelevant products (e.g. Lindt for "KIND granola") are rejected.
 */
import type { ProductResult } from "@/types/food";
import { productMatchesQuery } from "@/lib/open-food-facts";
import { supabase } from "@/lib/supabase";

export async function lookupProductOnline(
  query: string,
  barcode?: string
): Promise<ProductResult | null> {
  if (!supabase) return null;

  const trimmed = query.trim();
  if (!trimmed && !barcode?.trim()) return null;

  let data: { product?: unknown } | null = null;
  let error: { message?: string } | null = null;
  try {
    const result = await supabase.functions.invoke("lookup-product-online", {
      body: {
        query: trimmed || undefined,
        barcode: barcode?.trim() || undefined,
      },
    });
    data = result.data;
    error = result.error;
  } catch {
    return null;
  }
  if (error || !data?.product) return null;
  const p = data.product;

  const product: ProductResult = {
    code: p.code ?? `online-${Date.now()}`,
    product_name: p.product_name ?? "Unknown product",
    product_name_en: p.product_name_en ?? p.product_name,
    generic_name: p.generic_name,
    generic_name_en: p.generic_name_en,
    brands: p.brands ?? undefined,
    ingredients_text: p.ingredients_text ?? undefined,
    ingredients_text_en: p.ingredients_text_en ?? p.ingredients_text,
    nutriments: p.nutriments ?? undefined,
    serving_size: p.serving_size,
    additives_tags: p.additives_tags,
    allergens_tags: p.allergens_tags,
    image_url: p.image_url,
    image_small_url: p.image_small_url,
  };

  const isBarcodeLookup = (trimmed.startsWith("barcode ") && barcode?.trim()) || (!trimmed && barcode?.trim());
  if (!isBarcodeLookup) {
    const matchQuery = trimmed || barcode?.trim() || "";
    if (matchQuery && !productMatchesQuery(product, matchQuery)) return null;
  }
  return product;
}
