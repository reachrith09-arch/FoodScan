import type {
  DietCompatibilityResult,
  DietType,
  HealthProfile,
  ProductAnalysis,
  ProductResult,
  RegulationComparison,
  ScoreDriver,
  Subscores,
  SynergyWarning,
  UltraProcessedScore,
} from "@/types/food";
import { parseIngredientsList } from "@/lib/ingredients";
import { SYNERGY_RULES } from "@/data/additive-synergy";
import { getRegulationComparisons } from "@/data/regulations";
import { computeHealthRisks } from "@/lib/health-risks";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Round to 1 decimal for display (avoids floats like 11.889000000000001). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractIngredientKeys(product: ProductResult): string[] {
  const keys = new Set<string>();

  for (const tag of product.additives_tags ?? []) {
    keys.add(normalizeText(tag.replace(/^en:/, "")));
  }

  const text = normalizeText(product.ingredients_text ?? "");
  // Match E-numbers like "E211" or "E 211" or "E322i"
  const eMatches = text.match(/\be\s?\d{3,4}[a-z]?\b/g) ?? [];
  for (const m of eMatches) keys.add(normalizeText(m.replace(/\s+/g, "")));

  // Common named additives used in synergy rules
  if (text.includes("ascorbic acid") || text.includes("vitamin c")) {
    keys.add("ascorbic acid");
  }

  return Array.from(keys);
}

function computeSynergyWarnings(keys: string[]): SynergyWarning[] {
  const set = new Set(keys.map(normalizeText));
  const warnings: SynergyWarning[] = [];
  for (const rule of SYNERGY_RULES) {
    const ok = rule.required.every((r) => set.has(normalizeText(r)));
    if (ok) warnings.push(rule.warning);
  }
  return warnings;
}

function computeRegulationComparisons(keys: string[]): RegulationComparison[] {
  return getRegulationComparisons(keys);
}

function productHasGluten(product: ProductResult): boolean {
  const text = normalizeText(
    [product.ingredients_text, product.allergens_from_ingredients]
      .filter(Boolean)
      .join(" "),
  );
  const tags = (product.allergens_tags ?? []).map((t) => normalizeText(t));
  if (
    tags.some(
      (t) =>
        t.includes("gluten") || t.includes("wheat") || t.includes("barley") || t.includes("rye"),
    )
  )
    return true;
  return /gluten|wheat|barley|rye/.test(text);
}

function productHasDairyOrMeat(product: ProductResult): boolean {
  const text = normalizeText(product.ingredients_text ?? "");
  return /milk|cream|butter|whey|cheese|casein|meat|fish|gelatin|honey|egg/.test(text);
}

function computeDietCompatibility(profile: HealthProfile | null, product: ProductResult): DietCompatibilityResult[] {
  const text = normalizeText(product.ingredients_text ?? "");
  const sodiumMg = product.nutriments?.sodium_100g ?? product.nutriments?.sodium;
  const sugarG = product.nutriments?.sugars_100g ?? product.nutriments?.sugars;
  const carbsG = product.nutriments?.carbohydrates_100g ?? product.nutriments?.carbohydrates;

  const make = (diet: DietType, compatible: boolean, reason?: string): DietCompatibilityResult => ({
    diet,
    compatible,
    reason,
  });

  const results: DietCompatibilityResult[] = [];
  results.push(
    make(
      "vegan",
      !productHasDairyOrMeat(product) && !/gelatin|honey|fish|meat|milk|egg/.test(text),
      productHasDairyOrMeat(product) ? "Contains animal-derived ingredients." : undefined,
    ),
  );
  results.push(
    make(
      "vegetarian",
      !/meat|fish|gelatin|chicken|beef|pork/.test(text),
      /meat|fish|gelatin|chicken|beef|pork/.test(text) ? "Contains meat/fish/gelatin." : undefined,
    ),
  );
  results.push(
    make(
      "gluten-free",
      !productHasGluten(product),
      productHasGluten(product) ? "Contains gluten indicators (wheat/barley/rye)." : undefined,
    ),
  );
  results.push(
    make(
      "dairy-free",
      !/milk|cream|butter|whey|casein|cheese/.test(text),
      /milk|cream|butter|whey|casein|cheese/.test(text) ? "Contains dairy ingredients." : undefined,
    ),
  );
  results.push(
    make(
      "low-sodium",
      sodiumMg == null ? true : sodiumMg < 120,
      sodiumMg != null && sodiumMg >= 120 ? "Not low-sodium (per 100g)." : sodiumMg == null ? "Sodium not available." : undefined,
    ),
  );
  results.push(
    make(
      "low-sugar",
      sugarG == null ? true : sugarG < 5,
      sugarG != null && sugarG >= 5 ? "Not low-sugar (per 100g)." : sugarG == null ? "Sugar not available." : undefined,
    ),
  );
  results.push(
    make(
      "keto",
      carbsG == null ? true : carbsG < 10,
      carbsG != null && carbsG >= 10 ? "Carbs too high for keto (per 100g)." : carbsG == null ? "Carbs not available." : undefined,
    ),
  );
  // Halal: only detect obvious conflicts, otherwise "not verified".
  const obviousNonHalal = /pork|bacon|ham|lard|gelatin|alcohol|wine|beer|rum|whisky|brandy/.test(text);
  results.push(
    make(
      "halal",
      !obviousNonHalal,
      obviousNonHalal ? "Contains pork/gelatin/alcohol indicators." : "Not verified: certification required.",
    ),
  );

  // If user has dietary preferences in profile, we could prioritize those in UI later.
  void profile;
  return results;
}

function computeUltraProcessed(product: ProductResult, ingredientKeys: string[]): UltraProcessedScore {
  if (product.nova_group != null) {
    const g = product.nova_group;
    if (g === 1) return { score: 10, label: "low", rationale: "NOVA group 1 (minimally processed)." };
    if (g === 2) return { score: 35, label: "moderate", rationale: "NOVA group 2 (processed culinary ingredient)." };
    if (g === 3) return { score: 65, label: "high", rationale: "NOVA group 3 (processed food)." };
    return { score: 90, label: "ultra", rationale: "NOVA group 4 (ultra-processed)." };
  }

  const additivesCount = product.additives_n ?? product.additives_tags?.length ?? 0;
  const ingredientCount = parseIngredientsList(product.ingredients_text).length;
  const hasManyE = ingredientKeys.filter((k) => /^e\d{3,4}/.test(k)).length;

  const score =
    clamp100(
      20 +
        additivesCount * 6 +
        ingredientCount * 1.5 +
        hasManyE * 4,
    );
  const label: UltraProcessedScore["label"] =
    score >= 80 ? "ultra" : score >= 60 ? "high" : score >= 35 ? "moderate" : "low";
  return {
    score,
    label,
    rationale:
      "Estimated from additive count, E-number density, and ingredient list complexity (NOVA not available).",
  };
}

function computeSubscores(
  profile: HealthProfile | null,
  product: ProductResult,
  ultraProcessed: UltraProcessedScore,
  synergyWarnings: SynergyWarning[],
  healthRisks: ReturnType<typeof computeHealthRisks>,
  dietCompat: DietCompatibilityResult[],
): { subscores: Subscores; drivers: ScoreDriver[] } {
  const drivers: ScoreDriver[] = [];

  const sodiumMg = product.nutriments?.sodium_100g ?? product.nutriments?.sodium;
  const sugarG = product.nutriments?.sugars_100g ?? product.nutriments?.sugars;
  const fiberG = product.nutriments?.fiber_100g ?? product.nutriments?.fiber;
  const proteinG = product.nutriments?.proteins_100g ?? product.nutriments?.proteins;
  const kcal = product.nutriments?.["energy-kcal_100g"] ?? product.nutriments?.energy;

  // Allergens: if any critical allergy/gluten risk → heavy penalty.
  const hasCritical = healthRisks.some((r) => r.severity === "critical");
  const allergensScore = hasCritical ? 5 : 95;
  if (hasCritical) drivers.push({ label: "Critical risk", impact: -60, detail: "One or more critical risks detected (e.g. allergy/gluten)." });

  // Nutrition: threshold-based.
  let nutrition = 85;
  if (sugarG != null) {
    const penalty = sugarG > 30 ? 35 : sugarG > 15 ? 20 : sugarG > 5 ? 8 : 0;
    nutrition -= penalty;
    if (penalty) drivers.push({ label: "Sugar", impact: -penalty, detail: `High sugar (${round1(sugarG)}g/100g).` });
  }
  if (sodiumMg != null) {
    const penalty = sodiumMg > 800 ? 30 : sodiumMg > 400 ? 18 : sodiumMg > 120 ? 8 : 0;
    nutrition -= penalty;
    if (penalty) drivers.push({ label: "Sodium", impact: -penalty, detail: `High sodium (${Math.round(sodiumMg)}mg/100g).` });
  }
  if (fiberG != null) {
    const boost = fiberG >= 6 ? 10 : fiberG >= 3 ? 5 : 0;
    nutrition += boost;
    if (boost) drivers.push({ label: "Fiber", impact: boost, detail: `Good fiber (${round1(fiberG)}g/100g).` });
  }
  if (proteinG != null) {
    const boost = proteinG >= 10 ? 8 : proteinG >= 5 ? 3 : 0;
    nutrition += boost;
    if (boost) drivers.push({ label: "Protein", impact: boost, detail: `Protein content (${round1(proteinG)}g/100g).` });
  }
  if (kcal != null) {
    const penalty = kcal > 500 ? 10 : kcal > 350 ? 6 : 0;
    nutrition -= penalty;
    if (penalty) drivers.push({ label: "Calories", impact: -penalty, detail: `Energy dense (${Math.round(kcal)} kcal/100g).` });
  }
  nutrition = clamp100(nutrition);

  // Additives: based on additive count and synergy warnings.
  const additivesCount = product.additives_n ?? product.additives_tags?.length ?? 0;
  let additives = clamp100(95 - additivesCount * 7 - synergyWarnings.length * 10);
  if (additivesCount >= 5) drivers.push({ label: "Additives", impact: -15, detail: `${additivesCount} additives detected.` });
  if (synergyWarnings.length > 0) drivers.push({ label: "Synergy", impact: -10 * synergyWarnings.length, detail: "Potential additive pairing concerns." });

  // Processing: inverse of ultraProcessed score.
  const processing = clamp100(100 - ultraProcessed.score);
  if (ultraProcessed.label === "ultra") drivers.push({ label: "Ultra-processed", impact: -25, detail: ultraProcessed.rationale });

  // Diet fit: if profile has preferences, penalize conflicts; otherwise neutral-high.
  const prefs = (profile?.dietaryPreferences ?? []).map(normalizeText);
  let dietFit = prefs.length ? 90 : 80;
  for (const pref of prefs) {
    // Map common preference strings to our diet types
    const map: Record<string, DietType> = {
      vegan: "vegan",
      vegetarian: "vegetarian",
      halal: "halal",
      keto: "keto",
      "gluten-free": "gluten-free",
      glutenfree: "gluten-free",
      gluten: "gluten-free",
      "dairy-free": "dairy-free",
      dairyfree: "dairy-free",
      "low-sodium": "low-sodium",
      "low-sugar": "low-sugar",
    };
    const dt = map[pref];
    if (!dt) continue;
    const comp = dietCompat.find((d) => d.diet === dt);
    if (comp && !comp.compatible) {
      dietFit -= 20;
      drivers.push({ label: "Diet mismatch", impact: -20, detail: comp.reason ?? `Not compatible with ${dt}.` });
    }
  }
  dietFit = clamp100(dietFit);

  const subscores: Subscores = {
    allergens: allergensScore,
    nutrition,
    additives,
    processing,
    dietFit,
  };
  return { subscores, drivers };
}

export function analyzeProduct(profile: HealthProfile | null, product: ProductResult): ProductAnalysis {
  const ingredientKeys = extractIngredientKeys(product);
  const synergyWarnings = computeSynergyWarnings(ingredientKeys);
  const regulationComparisons = computeRegulationComparisons(ingredientKeys);
  const dietCompatibility = computeDietCompatibility(profile, product);
  const healthRisks = profile ? computeHealthRisks(profile, product) : [];
  const ultraProcessed = computeUltraProcessed(product, ingredientKeys);

  const { subscores, drivers } = computeSubscores(
    profile,
    product,
    ultraProcessed,
    synergyWarnings,
    healthRisks,
    dietCompatibility,
  );

  // Overall health score formula (all stored subscores are 0–100; higher = better for health):
  // - Nutrition: high is better (stored as-is).
  // - Allergens: low risk is good → we store "allergen safety" (high = safe); formula uses safety.
  // - Additives: fewer is better → we store score where high = fewer additives; formula uses it (many additives → low score).
  // - Processing: low processing is good → we store 100 - ultraProcessedScore (high = less processed); formula uses it.
  // - Diet fit: high is better (stored as-is).
  //
  // Formula: overall = 0.25×nutrition + 0.25×allergen_safety + 0.20×additives + 0.20×processing + 0.10×diet_fit
  // then clamped to 0–100.
  const overall =
    subscores.nutrition * 0.25 +
    subscores.allergens * 0.25 +
    subscores.additives * 0.2 +
    subscores.processing * 0.2 +
    subscores.dietFit * 0.1;
  const overallScore = clamp100(overall);

  // Label bands aligned with bar colors: green 75+, yellow 50–75, red 0–50
  const overallLabel: ProductAnalysis["overallLabel"] =
    overallScore >= 75 ? "excellent" : overallScore >= 50 ? "good" : overallScore >= 25 ? "caution" : "avoid";

  // Sort drivers by absolute impact (largest first). Keep full list so the UI can scroll.
  const topDrivers = drivers
    .slice()
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    overallScore,
    overallLabel,
    subscores,
    drivers: topDrivers,
    ultraProcessed,
    dietCompatibility,
    synergyWarnings,
    regulationComparisons,
    healthRisks,
  };
}

