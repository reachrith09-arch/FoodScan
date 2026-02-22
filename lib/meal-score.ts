/**
 * Portion parsing and combined meal scoring.
 * Supports: 100g, 50 g, 50ml, 1 cup, 1/2 cup, 2 cups, 1 bowl (~200g), 1 serving (100g), plain numbers.
 */
import type { HealthProfile, Nutriments, ProductAnalysis, ProductResult } from "@/types/food";
import { analyzeProduct } from "@/lib/scoring";

/** Parse portion string to grams. Returns null if unparseable. */
export function parsePortionToGrams(text: string): number | null {
  const t = String(text).trim().toLowerCase();
  if (!t) return null;

  // Plain number → grams (e.g. 100, 50)
  const plain = /^(\d+(?:\.\d+)?)\s*$/.exec(t);
  if (plain) return Math.max(0, parseFloat(plain[1]));

  // Grams: 100g, 50 g, 50.5g
  const grams = /^(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i.exec(t);
  if (grams) return Math.max(0, parseFloat(grams[1]));

  // Milliliters (for liquids, treat 1ml ≈ 1g)
  const ml = /^(\d+(?:\.\d+)?)\s*(?:ml|milliliters?)$/i.exec(t);
  if (ml) return Math.max(0, parseFloat(ml[1]));

  // Cups: 1 cup, 1/2 cup, 2 cups (~240g per cup for dry-ish foods; liquids ≈ 240g)
  const cupMatch = /^(\d+(?:\.\d+)?|\d+\/\d+)\s*cups?$/i.exec(t);
  if (cupMatch) {
    let n: number;
    const frac = cupMatch[1];
    if (frac.includes("/")) {
      const [a, b] = frac.split("/").map(Number);
      n = b && !Number.isNaN(b) ? a / b : 1;
    } else {
      n = parseFloat(frac) || 1;
    }
    return Math.max(0, n * 240);
  }

  // Bowl: 1 bowl (~200g)
  const bowl = /^(\d+(?:\.\d+)?)\s*bowls?$/i.exec(t);
  if (bowl) return Math.max(0, (parseFloat(bowl[1]) || 1) * 200);

  // Serving: 1 serving (default 100g)
  const serving = /^(\d+(?:\.\d+)?)\s*servings?$/i.exec(t);
  if (serving) return Math.max(0, (parseFloat(serving[1]) || 1) * 100);

  return null;
}

export interface MealItem {
  product: ProductResult;
  portionGrams: number;
}

function getNutrient(p: ProductResult, key: keyof Nutriments): number {
  const n = p.nutriments;
  if (!n) return 0;
  const v = n[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Get the merged virtual product for a meal (for display/storage).
 */
export function getMergedMealProduct(items: MealItem[]): ProductResult {
  if (items.length === 0) return {} as ProductResult;
  if (items.length === 1) return items[0].product;
  return mergeMealToProduct(items);
}

/**
 * Merge multiple foods into a single virtual product for scoring.
 * - Nutrition: portion-weighted average (per 100g of total meal).
 * - Additives & allergens: union across all foods.
 * - Processing: worst NOVA group.
 */
function mergeMealToProduct(items: MealItem[]): ProductResult {
  const totalGrams = items.reduce((s, i) => s + i.portionGrams, 0);
  if (totalGrams <= 0) {
    return items[0]?.product ?? ({} as ProductResult);
  }

  const additiveSet = new Set<string>();
  const allergenSet = new Set<string>();
  let worstNova = 1;
  const nutKeys = [
    "energy-kcal_100g",
    "proteins_100g",
    "carbohydrates_100g",
    "fat_100g",
    "fiber_100g",
    "sodium_100g",
    "sugars_100g",
  ] as const;

  const weighted: Record<string, number> = {};
  for (const k of nutKeys) weighted[k] = 0;

  for (const { product, portionGrams } of items) {
    const w = portionGrams / totalGrams;
    for (const k of nutKeys) {
      const per100 = getNutrient(product, k);
      weighted[k] += per100 * w;
    }
    for (const a of product.additives_tags ?? []) additiveSet.add(a);
    for (const a of product.allergens_tags ?? []) allergenSet.add(a);
    const nova = product.nova_group;
    if (typeof nova === "number" && nova > worstNova) worstNova = nova;
  }

  const first = items[0].product;
  const merged: ProductResult = {
    ...first,
    code: `meal-${Date.now()}`,
    product_name: first.product_name + (items.length > 1 ? ` + ${items.length - 1} more` : ""),
    nutriments: {
      ...first.nutriments,
      "energy-kcal_100g": weighted["energy-kcal_100g"],
      proteins_100g: weighted.proteins_100g,
      carbohydrates_100g: weighted.carbohydrates_100g,
      fat_100g: weighted.fat_100g,
      fiber_100g: weighted.fiber_100g,
      sodium_100g: weighted.sodium_100g,
      sugars_100g: weighted.sugars_100g,
    },
    additives_tags: Array.from(additiveSet),
    additives_n: additiveSet.size,
    allergens_tags: Array.from(allergenSet),
    nova_group: worstNova,
    ingredients_text: items.map((i) => i.product.ingredients_text).filter(Boolean).join("; "),
  };

  return merged;
}

/**
 * Compute a single health score for a meal (multiple foods with portions).
 * Uses portion-weighted nutrition, union of additives/allergens, and worst NOVA.
 */
export function computeMealScore(
  items: MealItem[],
  profile: HealthProfile | null
): ProductAnalysis {
  if (items.length === 0) {
    return analyzeProduct(profile, {} as ProductResult);
  }
  if (items.length === 1 && items[0].portionGrams === 100) {
    return analyzeProduct(profile, items[0].product);
  }
  const merged = mergeMealToProduct(items);
  return analyzeProduct(profile, merged);
}
