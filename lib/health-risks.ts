import type { HealthProfile, HealthRisk, ProductResult } from "@/types/food";

const HIGH_SODIUM_PER_100G_MG = 400;
const HIGH_SUGAR_PER_100G_G = 15;
const HIGH_CALORIES_PER_100G_KCAL = 250;
const GOOD_PROTEIN_PER_100G_G = 10;

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function productHasAllergen(product: ProductResult, allergen: string): boolean {
  const a = normalizeForMatch(allergen);
  const tags = product.allergens_tags ?? [];
  const fromIng = normalizeForMatch(product.allergens_from_ingredients ?? "");
  const ingText = normalizeForMatch(product.ingredients_text ?? "");
  if (tags.some((tag) => tag.toLowerCase().includes(a) || a.includes(tag.replace(/^en:/, "").replace(/-/g, " "))))
    return true;
  if (fromIng && fromIng.includes(a)) return true;
  if (ingText && ingText.includes(a)) return true;
  const mapping: Record<string, string[]> = {
    nuts: ["nut", "hazelnut", "almond", "walnut", "en:nuts", "tree nut"],
    dairy: ["milk", "dairy", "lactose", "en:milk", "cream", "whey"],
    gluten: ["gluten", "wheat", "barley", "rye", "en:gluten"],
    shellfish: ["shellfish", "shrimp", "crab", "en:shellfish"],
    soy: ["soy", "soya", "en:soybeans"],
    eggs: ["egg", "en:eggs"],
  };
  const keys = Object.keys(mapping).filter((k) => a.includes(k) || k.includes(a));
  for (const k of keys) {
    for (const v of mapping[k]) {
      if (tags.some((tag) => tag.toLowerCase().includes(v))) return true;
      if (fromIng.includes(v) || ingText.includes(v)) return true;
    }
  }
  return false;
}

function productHasGluten(product: ProductResult): boolean {
  const text = normalizeForMatch(
    [product.ingredients_text, product.allergens_from_ingredients].filter(Boolean).join(" ")
  );
  const tags = (product.allergens_tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("gluten") || t.includes("wheat") || t.includes("barley") || t.includes("rye")))
    return true;
  return /gluten|wheat|barley|rye/i.test(text);
}

function productHasDairyOrMeat(product: ProductResult): boolean {
  const text = normalizeForMatch(product.ingredients_text ?? "");
  const tags = (product.allergens_tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("milk") || t.includes("dairy"))) return true;
  return /milk|cream|butter|whey|cheese|meat|fish|gelatin|honey/i.test(text);
}

export function computeHealthRisks(profile: HealthProfile, product: ProductResult): HealthRisk[] {
  const risks: HealthRisk[] = [];
  const conditions = profile.conditions.map(normalizeForMatch);
  const allergies = profile.allergies.map(normalizeForMatch).filter(Boolean);
  const dietary = profile.dietaryPreferences.map(normalizeForMatch);
  const goals = profile.goals.map(normalizeForMatch);
  const medications = (profile.medications ?? []).map(normalizeForMatch);
  const nut = product.nutriments;
  const sodiumMg100 = nut?.sodium_100g ?? (nut?.sodium != null ? nut.sodium * 1000 : undefined);
  const sugar100 = nut?.sugars_100g ?? nut?.sugars;
  const kcal100 = nut?.["energy-kcal_100g"] ?? nut?.energy;
  const protein100 = nut?.proteins_100g ?? nut?.proteins;

  // Allergies → critical
  for (const allergy of allergies) {
    if (productHasAllergen(product, allergy)) {
      risks.push({
        severity: "critical",
        category: "Allergy",
        message: `Contains ${allergy}. Avoid if you have this allergy.`,
      });
    }
  }

  // Conditions
  if (conditions.some((c) => c.includes("hypertension") || c.includes("blood pressure")) && sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
    risks.push({
      severity: "warning",
      category: "Sodium",
      message: "High sodium – caution if you have hypertension.",
    });
  }
  if (conditions.some((c) => c.includes("diabetes") || c.includes("blood sugar")) && sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
    risks.push({
      severity: "warning",
      category: "Sugar",
      message: "High sugar – consider if you are managing diabetes.",
    });
  }
  if (conditions.some((c) => c.includes("celiac") || c.includes("gluten")) && productHasGluten(product)) {
    risks.push({
      severity: "critical",
      category: "Gluten",
      message: "Contains gluten – not suitable for celiac disease.",
    });
  }
  if (conditions.some((c) => c.includes("kidney")) && sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
    risks.push({
      severity: "warning",
      category: "Sodium",
      message: "High sodium – caution with kidney disease.",
    });
  }
  if (conditions.some((c) => c.includes("heart"))) {
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({
        severity: "warning",
        category: "Sodium",
        message: "High sodium – caution for heart health.",
      });
    }
  }

  // Dietary
  if (dietary.some((d) => d.includes("vegan")) && productHasDairyOrMeat(product)) {
    risks.push({
      severity: "warning",
      category: "Diet",
      message: "Not vegan – contains animal-derived ingredients.",
    });
  }
  if (dietary.some((d) => d.includes("vegetarian")) && productHasDairyOrMeat(product)) {
    const text = normalizeForMatch(product.ingredients_text ?? "");
    if (/meat|fish|gelatin|chicken|beef|pork/i.test(text)) {
      risks.push({
        severity: "warning",
        category: "Diet",
        message: "Contains meat or fish – not vegetarian.",
      });
    }
  }
  if (dietary.some((d) => d.includes("gluten") || d.includes("gluten-free")) && productHasGluten(product)) {
    risks.push({
      severity: "warning",
      category: "Diet",
      message: "Contains gluten.",
    });
  }

  // Medications (tyramine / MAOI)
  if (medications.some((m) => m.includes("maoi") || m.includes("monoamine"))) {
    const text = normalizeForMatch(product.ingredients_text ?? "");
    if (/aged cheese|fermented|soy sauce|tyramine|yeast extract|sauerkraut/i.test(text)) {
      risks.push({
        severity: "warning",
        category: "Medication",
        message: "May contain tyramine-rich ingredients – caution with MAOI medications.",
      });
    }
  }

  // Goals
  if (goals.some((g) => g.includes("weight loss") || g.includes("lose weight"))) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({
        severity: "info",
        category: "Goal",
        message: "High in sugar – consider moderating for weight loss.",
      });
    }
    if (kcal100 != null && kcal100 > HIGH_CALORIES_PER_100G_KCAL) {
      risks.push({
        severity: "info",
        category: "Goal",
        message: "High in calories per 100 g – consider portion size for weight loss.",
      });
    }
  }
  if (goals.some((g) => g.includes("muscle") || g.includes("protein"))) {
    if (protein100 != null && protein100 >= GOOD_PROTEIN_PER_100G_G) {
      risks.push({
        severity: "good",
        category: "Goal",
        message: `Good source of protein (${protein100}g per 100g) for muscle gain.`,
      });
    }
  }
  if (goals.some((g) => g.includes("blood sugar") || g.includes("sugar"))) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({
        severity: "warning",
        category: "Goal",
        message: "High in sugar – consider limiting for blood sugar control.",
      });
    }
  }

  return risks;
}
