import type { HealthProfile } from "@/types/food";

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Map allergy/condition terms to ingredient substrings we check */
const ALLERGY_TERMS: Record<string, string[]> = {
  nuts: ["nut", "almond", "hazelnut", "walnut", "cashew", "peanut"],
  dairy: ["milk", "cream", "whey", "cheese", "butter", "lactose", "casein"],
  gluten: ["wheat", "gluten", "barley", "rye"],
  shellfish: ["shrimp", "crab", "lobster", "shellfish"],
  soy: ["soy", "soya", "tofu"],
  eggs: ["egg", "egg white", "egg yolk"],
};

/**
 * Compute per-ingredient impact for the user based on their profile.
 * Returns a short "For you" message if the ingredient is relevant (risk or neutral-benefit).
 */
export function getIngredientImpactForUser(
  ingredientRaw: string,
  profile: HealthProfile | null
): string | null {
  if (!profile) return null;
  const ing = normalizeForMatch(ingredientRaw);

  // Allergies
  for (const allergy of profile.allergies) {
    const a = normalizeForMatch(allergy);
    if (!a) continue;
    if (ing.includes(a)) return `Avoid: you're allergic to ${allergy}.`;
    for (const [key, terms] of Object.entries(ALLERGY_TERMS)) {
      if (!a.includes(key)) continue;
      if (terms.some((t) => ing.includes(t))) return `Avoid: you're allergic to ${allergy}.`;
    }
  }

  // Conditions: sodium for hypertension, sugar for diabetes
  const conditions = profile.conditions.map(normalizeForMatch);
  if (
    conditions.some((c) => c.includes("hypertension") || c.includes("blood pressure")) &&
    /sodium|salt|na\b/i.test(ing)
  ) {
    return "Watch: high sodium may affect blood pressure.";
  }
  if (
    conditions.some((c) => c.includes("diabetes") || c.includes("blood sugar")) &&
    /sugar|glucose|fructose|sucrose|honey|syrup/i.test(ing)
  ) {
    return "Watch: added sugars may affect blood sugar.";
  }

  // Dietary preferences: vegan/vegetarian check for animal-derived
  const dietary = profile.dietaryPreferences.map(normalizeForMatch);
  if (dietary.some((d) => d.includes("vegan"))) {
    if (/milk|cream|whey|cheese|butter|gelatin|honey|egg|fish|meat/i.test(ing)) {
      return "Not vegan – contains animal-derived ingredient.";
    }
  }
  if (dietary.some((d) => d.includes("gluten") || d.includes("gluten-free"))) {
    if (/wheat|barley|rye|gluten/i.test(ing)) return "Contains gluten.";
  }

  return null;
}
