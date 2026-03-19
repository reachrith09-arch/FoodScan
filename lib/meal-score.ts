/**
 * Portion parsing and combined meal scoring.
 *
 * Supports portions: 100g, 50ml, 1 cup, 1/2 cup, 2 bowls, 1 serving, plain numbers.
 *
 * For blended meals (smoothies, stews, stir-fries) the score is computed as a
 * confidence-weighted blend of all individual food components, so a meal that is
 * 60% rice and 40% chicken gets a score proportional to those ratios.
 */
import type { HealthProfile, Nutriments, ProductAnalysis, ProductResult } from "@/types/food";
import { analyzeProduct } from "@/lib/scoring";

// ─── Portion parsing ──────────────────────────────────────────────────────────

/**
 * Parse a human portion string to grams (or ml treated as grams for liquids —
 * water density ≈ 1g/ml so the approximation is accurate for most drinks).
 * Returns null if unparseable.
 */
export function parsePortionToGrams(text: string): number | null {
  const t = String(text).trim().toLowerCase();
  if (!t) return null;

  // Plain number → grams/ml
  const plain = /^(\d+(?:\.\d+)?)\s*$/.exec(t);
  if (plain) return Math.max(0, parseFloat(plain[1]));

  // Grams
  const grams = /^(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i.exec(t);
  if (grams) return Math.max(0, parseFloat(grams[1]));

  // Millilitres — treat 1 ml ≈ 1 g (accurate for water-based drinks)
  const ml = /^(\d+(?:\.\d+)?)\s*(?:ml|milliliters?|millilitres?|cc)$/i.exec(t);
  if (ml) return Math.max(0, parseFloat(ml[1]));

  // Litres
  const litre = /^(\d+(?:\.\d+)?)\s*(?:l|liters?|litres?)$/i.exec(t);
  if (litre) return Math.max(0, parseFloat(litre[1]) * 1000);

  // Fluid ounces (fl oz) — 1 fl oz ≈ 29.57 ml
  const floz = /^(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fluid\s*oz(?:s)?)$/i.exec(t);
  if (floz) return Math.max(0, parseFloat(floz[1]) * 29.57);

  // Ounces (weight) — 1 oz = 28.35 g
  const oz = /^(\d+(?:\.\d+)?)\s*oz$/i.exec(t);
  if (oz) return Math.max(0, parseFloat(oz[1]) * 28.35);

  // Pounds
  const lb = /^(\d+(?:\.\d+)?)\s*lbs?$/i.exec(t);
  if (lb) return Math.max(0, parseFloat(lb[1]) * 453.6);

  // Cups — 1 cup = 240 ml (liquid) or ~240 g (dry approximation)
  const cupMatch = /^(\d+(?:\.\d+)?|\d+\/\d+)\s*cups?$/i.exec(t);
  if (cupMatch) {
    const frac = cupMatch[1];
    let n: number;
    if (frac.includes("/")) {
      const [a, b] = frac.split("/").map(Number);
      n = b && !Number.isNaN(b) ? a / b : 1;
    } else {
      n = parseFloat(frac) || 1;
    }
    return Math.max(0, n * 240);
  }

  // Tablespoon — 1 tbsp ≈ 15 ml
  const tbsp = /^(\d+(?:\.\d+)?)\s*(?:tbsp|tablespoons?)$/i.exec(t);
  if (tbsp) return Math.max(0, parseFloat(tbsp[1]) * 15);

  // Teaspoon — 1 tsp ≈ 5 ml
  const tsp = /^(\d+(?:\.\d+)?)\s*(?:tsp|teaspoons?)$/i.exec(t);
  if (tsp) return Math.max(0, parseFloat(tsp[1]) * 5);

  // Can — standard 330 ml / 355 ml → use 355 ml (US 12 fl oz)
  const can = /^(\d+(?:\.\d+)?)\s*cans?$/i.exec(t);
  if (can) return Math.max(0, (parseFloat(can[1]) || 1) * 355);

  // Bottle — standard 500 ml
  const bottle = /^(\d+(?:\.\d+)?)\s*bottles?$/i.exec(t);
  if (bottle) return Math.max(0, (parseFloat(bottle[1]) || 1) * 500);

  // Glass — standard 250 ml
  const glass = /^(\d+(?:\.\d+)?)\s*glasses?$/i.exec(t);
  if (glass) return Math.max(0, (parseFloat(glass[1]) || 1) * 250);

  // Shot — 1 shot = 44 ml (US standard 1.5 fl oz)
  const shot = /^(\d+(?:\.\d+)?)\s*shots?$/i.exec(t);
  if (shot) return Math.max(0, (parseFloat(shot[1]) || 1) * 44);

  // Mug — standard 240 ml
  const mug = /^(\d+(?:\.\d+)?)\s*mugs?$/i.exec(t);
  if (mug) return Math.max(0, (parseFloat(mug[1]) || 1) * 240);

  // Scoop — protein powder / ice cream ≈ 35 g
  const scoop = /^(\d+(?:\.\d+)?)\s*scoops?$/i.exec(t);
  if (scoop) return Math.max(0, (parseFloat(scoop[1]) || 1) * 35);

  // Bowl
  const bowl = /^(\d+(?:\.\d+)?)\s*bowls?$/i.exec(t);
  if (bowl) return Math.max(0, (parseFloat(bowl[1]) || 1) * 200);

  // Plate
  const plate = /^(\d+(?:\.\d+)?)\s*plates?$/i.exec(t);
  if (plate) return Math.max(0, (parseFloat(plate[1]) || 1) * 300);

  // Serving — 1 serving = 240 ml for drinks, but we don't know context here;
  // use 240 ml as it's more accurate for both drinks and many food portions.
  const serving = /^(\d+(?:\.\d+)?)\s*servings?$/i.exec(t);
  if (serving) return Math.max(0, (parseFloat(serving[1]) || 1) * 240);

  // Slice
  const slice = /^(\d+(?:\.\d+)?)\s*slices?$/i.exec(t);
  if (slice) return Math.max(0, (parseFloat(slice[1]) || 1) * 35);

  // Piece / unit
  const piece = /^(\d+(?:\.\d+)?)\s*(?:piece|pieces|pcs?|units?)$/i.exec(t);
  if (piece) return Math.max(0, (parseFloat(piece[1]) || 1) * 80);

  return null;
}

/**
 * Returns a sensible default portion string for a given food name.
 * Drinks get "250ml" (1 glass), foods get "1 serving".
 */
export function defaultPortionForFood(name: string): string {
  const n = name.toLowerCase();
  const drinkKeywords = [
    "juice", "milk", "water", "soda", "cola", "coffee", "tea", "latte",
    "cappuccino", "espresso", "smoothie", "shake", "beer", "wine", "cocktail",
    "lemonade", "drink", "beverage", "broth", "stock", "soup", "kombucha",
    "kefir", "yogurt drink", "protein shake", "energy drink", "sports drink",
    "orange juice", "apple juice", "coconut water", "almond milk", "oat milk",
    "soy milk", "rice milk", "cream", "syrup",
  ];
  if (drinkKeywords.some((kw) => n.includes(kw))) return "250ml";
  return "1 serving";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MealItem {
  product: ProductResult;
  portionGrams: number;
  /** AI similarity confidence 0–100 (from recognition). Default 100 = user-entered. */
  confidence?: number;
  /** True when this item is blended/mixed with others (smoothie, stew, etc.) */
  isBlended?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getNutrient(p: ProductResult, key: keyof Nutriments): number {
  const n = p.nutriments;
  if (!n) return 0;
  const v = n[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

const NUT_KEYS = [
  "energy-kcal_100g",
  "proteins_100g",
  "carbohydrates_100g",
  "fat_100g",
  "fiber_100g",
  "sodium_100g",
  "sugars_100g",
  "saturated-fat_100g",
  "salt_100g",
] as const;

// ─── Merging ──────────────────────────────────────────────────────────────────

/**
 * Merge multiple foods into a single virtual product.
 *
 * Weighting strategy:
 * - Nutrition: portion-weight × confidence-weight combined
 *   (a food that is 60g but only 55% confidence contributes less than
 *    60g at 95% confidence — mirrors similarity-based detection weighting)
 * - Additives & allergens: union across all foods (conservative/safe)
 * - Processing: worst NOVA group (conservative)
 */
function mergeMealToProduct(items: MealItem[]): ProductResult {
  const totalGrams = items.reduce((s, i) => s + i.portionGrams, 0);
  if (totalGrams <= 0) {
    return items[0]?.product ?? ({} as ProductResult);
  }

  // Compute combined weight for each item: portion fraction × normalised confidence
  const rawWeights = items.map((item) => {
    const portionFraction = item.portionGrams / totalGrams;
    // Confidence 0–100 → 0.4–1.0 range so even uncertain items contribute
    const confidenceFactor = 0.4 + (((item.confidence ?? 100) / 100) * 0.6);
    return portionFraction * confidenceFactor;
  });

  const totalWeight = rawWeights.reduce((s, w) => s + w, 0);
  const weights = rawWeights.map((w) => (totalWeight > 0 ? w / totalWeight : 1 / items.length));

  const additiveSet = new Set<string>();
  const allergenSet = new Set<string>();
  let worstNova = 1;
  const weighted: Record<string, number> = {};
  for (const k of NUT_KEYS) weighted[k] = 0;

  for (let i = 0; i < items.length; i++) {
    const { product } = items[i];
    const w = weights[i];
    for (const k of NUT_KEYS) {
      weighted[k] += getNutrient(product, k) * w;
    }
    for (const a of product.additives_tags ?? []) additiveSet.add(a);
    for (const a of product.allergens_tags ?? []) allergenSet.add(a);
    const nova = product.nova_group;
    if (typeof nova === "number" && nova > worstNova) worstNova = nova;
  }

  const first = items[0].product;
  const nameList = items.map((i) => i.product.product_name).filter(Boolean);
  const blended = items.some((i) => i.isBlended);

  const merged: ProductResult = {
    ...first,
    code: `meal-${Date.now()}`,
    product_name:
      nameList.length === 1
        ? nameList[0]
        : blended
          ? `Blended meal (${nameList.slice(0, 3).join(", ")}${nameList.length > 3 ? "…" : ""})`
          : nameList.slice(0, 2).join(" + ") + (nameList.length > 2 ? ` + ${nameList.length - 2} more` : ""),
    nutriments: {
      ...first.nutriments,
      "energy-kcal_100g": weighted["energy-kcal_100g"],
      proteins_100g: weighted.proteins_100g,
      carbohydrates_100g: weighted.carbohydrates_100g,
      fat_100g: weighted.fat_100g,
      fiber_100g: weighted.fiber_100g,
      sodium_100g: weighted.sodium_100g,
      sugars_100g: weighted.sugars_100g,
      "saturated-fat_100g": weighted["saturated-fat_100g"],
      salt_100g: weighted.salt_100g,
    },
    additives_tags: Array.from(additiveSet),
    additives_n: additiveSet.size,
    allergens_tags: Array.from(allergenSet),
    nova_group: worstNova,
    ingredients_text: items
      .map((i) => i.product.ingredients_text)
      .filter(Boolean)
      .join("; "),
  };

  return merged;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Get the merged virtual product for a meal (for display/storage). */
export function getMergedMealProduct(items: MealItem[]): ProductResult {
  if (items.length === 0) return {} as ProductResult;
  if (items.length === 1) return items[0].product;
  return mergeMealToProduct(items);
}

/**
 * Compute a single health score for a meal (multiple foods with portions).
 *
 * For blended meals the score is a confidence-weighted combination of all
 * component foods — matching how AI similarity detection systems work:
 * a high-confidence detection of an unhealthy ingredient contributes more
 * to the overall score than a low-confidence one.
 */
export function computeMealScore(
  items: MealItem[],
  profile: HealthProfile | null,
): ProductAnalysis {
  if (items.length === 0) {
    return analyzeProduct(profile, {} as ProductResult);
  }
  if (items.length === 1 && items[0].portionGrams === 100 && !items[0].confidence) {
    return analyzeProduct(profile, items[0].product);
  }
  const merged = mergeMealToProduct(items);
  return analyzeProduct(profile, merged);
}
