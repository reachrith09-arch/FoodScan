import type { DietType, HealthProfile, ProductAnalysis, ProductResult } from "@/types/food";
import {
  getDisplayIngredientsFromProduct,
  getIngredientDetail,
  parseIngredientsList,
  toIngredientDisplayCase,
  translateIngredientToEnglishMulti,
  translateIngredientsListToEnglish,
} from "@/lib/ingredients";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractENumber(q: string): string | null {
  const m = normalize(q).match(/\be\s?\d{3,4}[a-z]?\b/);
  if (!m) return null;
  return m[0].replace(/\s+/g, "");
}

function preferredIngredientsText(product?: ProductResult): string | undefined {
  if (!product) return undefined;
  return product.ingredients_text_en ?? product.ingredients_text;
}

function guessIngredientFromQuestion(question: string, product?: ProductResult): string | null {
  const q = normalize(question);
  const e = extractENumber(q);
  if (e) return e;

  if (/\b(healthier|swap|alternative|better option|substitute)\b/.test(q)) return null;

  const ingredients = parseIngredientsList(preferredIngredientsText(product));
  if (ingredients.length > 0) {
    const candidates: { raw: string; matchEn: string; forLookup: string }[] = [];
    for (const raw of ingredients) {
      const t = raw.trim();
      if (!t || t.length < 2) continue;
      const en = normalize(translateIngredientToEnglishMulti(t));
      if (en.length >= 3) candidates.push({ raw: t, matchEn: en, forLookup: t });
      const parts = t.split(/[,;:()]+|\s+and\s+/).map((p) => p.trim()).filter((p) => p.length >= 3);
      for (const part of parts) {
        const partEn = normalize(translateIngredientToEnglishMulti(part));
        if (partEn.length >= 3) candidates.push({ raw: t, matchEn: partEn, forLookup: part });
      }
    }
    candidates.sort((a, b) => b.raw.length - a.raw.length);
    for (const { raw, matchEn, forLookup } of candidates) {
      if (q.includes(matchEn)) return forLookup;
      if (q.includes(normalize(forLookup))) return forLookup;
    }
  }

  // Extract ingredient from question phrasing (works with or without a scanned product).
  const m =
    q.match(/\bwhat does (.+?) mean\b/) ??
    q.match(/\bwhat is (.+?)\b/) ??
    q.match(/\bwhat's (.+?)\b/) ??
    q.match(/\bexplain (.+?)\b/) ??
    q.match(/\btell me about (.+?)\b/);
  if (m?.[1]) {
    const term = m[1].trim();
    if (term.length < 3) return null;
    if (/^(a|an|the|this)$/i.test(term)) return null;
    if (/\b(healthier|option|alternative|swap|substitute|ingredients?|this product|this food)\b/.test(term))
      return null;
    return term;
  }

  return null;
}

function wantsHealthSummary(q: string): boolean {
  const n = normalize(q);
  return (
    /\b(is this healthy|is it healthy|good for me|should i eat|is it bad|how bad|how healthy|overall)\b/.test(n) ||
    /\b(is this good|good for you|would you eat|recommend|worth eating|ok to eat)\b/.test(n) ||
    /\b(what do you think|your opinion|advice)\b/.test(n)
  );
}

function looksFoodRelated(question: string): boolean {
  const q = normalize(question);
  return (
    /\b(ingredient|ingredients|additive|additives|e\d{3,4}|e-number|label|allergen|allergy|gluten|vegan|vegetarian|halal|kosher)\b/.test(
      q,
    ) ||
    /\b(nutrition|nutrient|nutrients|nutrition facts|calorie|kcal|protein|carb|carbohydrate|fat|fiber|sodium|salt|sugar|sweetener|preservative|emulsifier)\b/.test(
      q,
    ) ||
    /\b(healthier|healthier option|swap|alternative|better option|substitute)\b/.test(q) ||
    wantsHealthSummary(q) ||
    /\b(what is this|what am i looking at|tell me about|describe this|this product|score|rated|rating|drivers?)\b/.test(
      q,
    ) ||
    /\b(how much|how many)\s+(sugar|protein|fat|sodium|calorie|fiber|carb)\b/.test(q) ||
    /\b(food|eat|eating|meal|meals|breakfast|lunch|dinner|snack|diet|weight|healthy)\b/.test(q)
  );
}

function isProductIdentityQuestion(question: string): boolean {
  const q = normalize(question);
  // Don't treat "what does X mean?" or "what is [ingredient]?" as product identity — answer the question.
  if (/\bwhat does .+ mean\b/.test(q)) return false;
  if (/\bwhat('s| is) .+\b/.test(q) && !/\b(what's|what is) this\b/.test(q)) return false;
  return (
    /\b(what is this|what am i looking at|tell me about (this )?(product)?|describe this|what('s| is) this (food|product)?)\b/.test(
      q,
    ) || /^(tell me about|describe)\s/.test(q)
  );
}

function isNutritionNumberQuestion(question: string): boolean {
  const q = normalize(question);
  return (
    /\b(how much|how many)\s+(sugar|protein|fat|sodium|calories?|fiber|carbs?|carbohydrate)\b/.test(q) ||
    /\b(sugar|protein|fat|sodium|calories?|fiber|carbs?)\s+(content|amount|per 100|in this)\b/.test(q) ||
    /\b(amount of|content of)\s+(sugar|protein|fat|sodium)\b/.test(q)
  );
}

function isDietQuestion(question: string): boolean {
  const q = normalize(question);
  return (
    /\b(is this (a )?)?(vegan|vegetarian|gluten[- ]?free|halal|kosher|keto|dairy[- ]?free)\b/.test(q) ||
    /\b(vegan|vegetarian|gluten|halal|kosher)\s*\??\s*$/.test(q) ||
    /\b(can i eat (this )?if (i am )?(vegan|vegetarian|gluten))\b/.test(q)
  );
}

function isScoreQuestion(question: string): boolean {
  const q = normalize(question);
  return (
    /\b(why is it rated|what('s| is) the score|what drives the score|why (this )?score|how (is it )?scored)\b/.test(
      q,
    ) || /\b(score|rating|grade)\s*\??\s*$/.test(q)
  );
}

function isAllergenQuestion(question: string): boolean {
  const q = normalize(question);
  return /\b(allergen|allergy|allergies|allergic|contains (nuts|dairy|gluten|soy))\b/.test(q);
}

function isIngredientListQuestion(question: string): boolean {
  const q = normalize(question);
  return (
    /\bingredients\b/.test(q) &&
    (/\bwhat are\b/.test(q) || /\blist\b/.test(q) || /\bshow\b/.test(q) || /\bwhat's in\b/.test(q) || /\bwhat is in\b/.test(q))
  );
}

function isSwapQuestion(question: string): boolean {
  const q = normalize(question);
  return /\b(healthier|healthier option|swap|alternative|better option|substitute)\b/.test(q);
}

function healthierOptionAnswer(product?: ProductResult): string {
  if (!product) {
    return [
      "In general, a “healthier option” means:",
      "- less added sugar and sodium",
      "- more fiber/protein (if it’s a snack/meal)",
      "- simpler ingredient list",
      "",
      "Tell me what food/drink it is (or scan it) and I’ll suggest 2–4 specific swaps.",
    ].join("\n");
  }

  const name = (product.product_name_en ?? product.product_name ?? "").toLowerCase();
  const categories = (product.categories_tags ?? []).join(" ").toLowerCase();
  const isSodaLike = /\b(cola|coke|soda|soft drink)\b/.test(name) || /\b(cola|soda|soft drink|carbonated)\b/.test(categories);
  const sugar100 = product.nutriments?.sugars_100g;

  if (isSodaLike) {
    const lines = [
      "If you want something “healthier” than a sugary soda, here are good swaps:",
      "- Sparkling water + lemon/lime",
      "- Unsweetened iced tea",
      "- Flavored seltzer (no added sugar)",
      "- If you still want cola: a zero-sugar version",
    ];
    if (sugar100 != null) {
      lines.push("", `FYI: this one is about ${sugar100} g sugar per 100g (from the label data).`);
    }
    return lines.join("\n");
  }

  return [
    "Healthier alternatives depend on the category, but good rules are:",
    "- pick less added sugar and sodium",
    "- choose higher fiber/protein when possible",
    "- prefer simpler ingredient lists",
    "",
    "If you tell me what you’re trying to replace it with (snack, breakfast, drink, etc.), I can suggest 2–4 concrete swaps.",
  ].join("\n");
}

function mapPreferenceToDietType(pref: string): DietType | null {
  const p = normalize(pref);
  if (!p) return null;
  if (/\bvegan\b/.test(p)) return "vegan";
  if (/\bvegetarian\b/.test(p)) return "vegetarian";
  if (/\bgluten\b/.test(p)) return "gluten-free";
  if (/\b(dairy|lactose)\b/.test(p)) return "dairy-free";
  if (/\bketo|ketogenic\b/.test(p)) return "keto";
  if (/\bhalal\b/.test(p)) return "halal";
  if (/\bkosher\b/.test(p)) return "kosher";
  if (/\blow[\s-]*sodium\b/.test(p)) return "low-sodium";
  if (/\blow[\s-]*sugar\b/.test(p)) return "low-sugar";
  return null;
}

function genericHealthSummary(
  product: ProductResult,
  analysis: ProductAnalysis | undefined,
  profile: HealthProfile | null | undefined,
): string {
  const lines: string[] = [];
  if (analysis) {
    lines.push(
      `General score: ${analysis.overallScore}/100 (${analysis.overallLabel.toUpperCase()}).`,
    );
    if (analysis.drivers?.length) {
      const top = analysis.drivers[0];
      if (top) lines.push(`Top driver: ${top.label} — ${top.detail}`);
    }
  } else {
    lines.push("I can give general ingredient/nutrition info from the label data.");
  }

  if (analysis && profile) {
    const diets = (profile.dietaryPreferences ?? [])
      .map(mapPreferenceToDietType)
      .filter((x): x is DietType => !!x)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    if (diets.length) {
      lines.push("", "Diet/preferences check:");
      for (const diet of diets) {
        const res = analysis.dietCompatibility.find((d) => d.diet === diet);
        if (!res) continue;
        lines.push(
          `- ${diet}: ${res.compatible ? "OK" : "NO"}${res.reason ? ` — ${res.reason}` : ""}`,
        );
      }
    }

    const keyRisks = (analysis.healthRisks ?? [])
      .filter((r) => r.severity === "critical" || r.severity === "warning")
      .slice(0, 2);
    if (keyRisks.length) {
      lines.push("", "Personalized notes:");
      for (const r of keyRisks) lines.push(`- ${r.message}`);
    }
  }

  const sodium = product.nutriments?.sodium_100g;
  const sugar = product.nutriments?.sugars_100g;
  if (sodium != null) lines.push(`Sodium (per 100g): ${Math.round(sodium)} mg.`);
  if (sugar != null) lines.push(`Sugar (per 100g): ${sugar} g.`);
  if (!profile) {
    lines.push("For personalized advice (preferences/allergies/conditions/goals), create a Health Profile.");
  } else {
    lines.push("This summary uses your saved Health Profile preferences. Not medical advice.");
  }
  return lines.join("\n");
}

function productSummary(
  product: ProductResult,
  analysis: ProductAnalysis | undefined,
  profile: HealthProfile | null | undefined,
): string {
  const name = product.product_name_en ?? product.product_name ?? product.generic_name_en ?? product.generic_name ?? "This product";
  const lines: string[] = [toIngredientDisplayCase(name)];
  if (product.brands) lines.push(`Brand: ${product.brands}`);

  if (analysis) {
    lines.push(`Score: ${analysis.overallScore}/100 (${analysis.overallLabel}).`);
    if (analysis.drivers?.length) {
      const top = analysis.drivers[0];
      if (top) lines.push(`Main factor: ${top.label} — ${top.detail}`);
    }
  }

  const nut = product.nutriments;
  const parts: string[] = [];
  if (nut?.sugars_100g != null) parts.push(`${nut.sugars_100g} g sugar`);
  if (nut?.sodium_100g != null) parts.push(`${Math.round(nut.sodium_100g)} mg sodium`);
  if (nut?.proteins_100g != null) parts.push(`${nut.proteins_100g} g protein`);
  if (nut?.["energy-kcal_100g"] != null || nut?.energy != null)
    parts.push(`${Math.round((nut["energy-kcal_100g"] ?? nut?.energy) ?? 0)} kcal`);
  if (parts.length) lines.push("Per 100g: " + parts.join(", ") + ".");

  const { display } = getDisplayIngredientsFromProduct(product);
  if (display.length) {
    const preview = display.slice(0, 5).join(", ");
    lines.push(`Ingredients include: ${preview}${display.length > 5 ? "…" : "."}`);
  }

  lines.push(
    "",
    "You can ask: “What does [ingredient] mean?”, “What’s a healthier alternative?”, “Is this vegan?”, or “How much sugar?”",
  );
  return lines.join("\n");
}

function nutritionFactAnswer(product: ProductResult, question: string): string {
  const q = normalize(question);
  const nut = product.nutriments;
  if (!nut) return "I don’t have nutrition numbers for this product in the data. Check the package label.";

  const per100: string[] = [];
  if (/\b(sugar|sugars)\b/.test(q) && nut.sugars_100g != null)
    per100.push(`${nut.sugars_100g} g sugar per 100g`);
  if (/\b(protein|proteins)\b/.test(q) && nut.proteins_100g != null)
    per100.push(`${nut.proteins_100g} g protein per 100g`);
  if (/\b(fat|fats)\b/.test(q) && nut.fat_100g != null)
    per100.push(`${nut.fat_100g} g fat per 100g`);
  if (/\b(sodium|salt)\b/.test(q) && nut.sodium_100g != null)
    per100.push(`${Math.round(nut.sodium_100g)} mg sodium per 100g`);
  if (/\b(calorie|calories|kcal|energy)\b/.test(q)) {
    const kcal = nut["energy-kcal_100g"] ?? nut.energy;
    if (kcal != null) per100.push(`${Math.round(kcal)} kcal per 100g`);
  }
  if (/\b(fiber|fibre|carbs?|carbohydrate)\b/.test(q)) {
    if (nut.fiber_100g != null) per100.push(`${nut.fiber_100g} g fiber per 100g`);
    if (nut.carbohydrates_100g != null) per100.push(`${nut.carbohydrates_100g} g carbs per 100g`);
  }

  if (per100.length === 0)
    return "I have some nutrition data. Ask for “sugar”, “protein”, “fat”, “sodium”, “calories”, or “fiber” and I’ll show the amount per 100g.";
  return per100.join(". ") + " (from product data; check the package for serving size).";
}

function dietAnswer(analysis: ProductAnalysis | undefined, question: string): string {
  const q = normalize(question);
  const dietMatch =
    /\b(vegan|vegetarian|gluten[- ]?free|halal|kosher|keto|dairy[- ]?free)\b/.exec(q);
  const diet = dietMatch ? mapPreferenceToDietType(dietMatch[1]) : null;
  if (!analysis?.dietCompatibility?.length)
    return "I don’t have diet compatibility for this product. You can check the ingredients list and ask “What does [ingredient] mean?” for specifics.";
  if (diet) {
    const res = analysis.dietCompatibility.find((d) => d.diet === diet);
    if (res)
      return `${diet}: ${res.compatible ? "Looks OK for this diet." : "Not suitable."}${res.reason ? ` ${res.reason}` : ""}`;
  }
  const lines = ["Diet compatibility (from product data):"];
  for (const d of analysis.dietCompatibility.slice(0, 6))
    lines.push(`- ${d.diet}: ${d.compatible ? "OK" : "No"}${d.reason ? ` — ${d.reason}` : ""}`);
  return lines.join("\n");
}

function scoreAnswer(analysis: ProductAnalysis | undefined, product: ProductResult): string {
  if (!analysis) {
    const nut = product.nutriments;
    if (nut) {
      const parts: string[] = [];
      if (nut.sugars_100g != null) parts.push(`sugar ${nut.sugars_100g} g`);
      if (nut.sodium_100g != null) parts.push(`sodium ${Math.round(nut.sodium_100g)} mg`);
      return "I don’t have a computed score for this product. From the label: per 100g — " + (parts.length ? parts.join(", ") : "check the package.") + ".";
    }
    return "I don’t have score data for this product. You can ask about ingredients or nutrition.";
  }
  const lines = [
    `Score: ${analysis.overallScore}/100 (${analysis.overallLabel}).`,
    "",
    "What drives it:",
    ...(analysis.drivers ?? []).slice(0, 4).map((d) => `- ${d.label}: ${d.detail}`),
  ];
  return lines.join("\n");
}

function generalFoodAnswer(question: string): string {
  const q = normalize(question);
  if (/\b(how to|how do i|how can i)\s+(eat|get)\s*(healthy|healthier|better)\b/.test(q))
    return "Eat more whole foods (veg, fruit, whole grains), less added sugar and ultra-processed snacks. Scan a product to see its score, or ask “What does [ingredient] mean?” or “What’s a healthier alternative?”";
  if (/\b(best|good|healthy)\s+(breakfast|snack|meal)\b/.test(q) || /\b(breakfast|snack)\s+(idea|ideas|recommendation)\b/.test(q))
    return "Good options: fruit, nuts, yogurt, whole-grain toast, eggs. Scan a product to check its score, or ask about an ingredient by name.";
  if (/\b(what is|what's)\s+(fiber|protein|fat|sugar|sodium)\b/.test(q)) {
    const term = /\b(fiber|protein|fat|sugar|sodium)\b/.exec(q)?.[1] ?? "it";
    return `${toIngredientDisplayCase(term)} is an important part of nutrition. Check the label for amounts per serving. You can also ask “What is [ingredient name]?” or scan a product to see its breakdown.`;
  }
  if (/\b(diet|weight|lose weight|gain weight)\b/.test(q))
    return "Diet and weight depend on your goals and health. Scan products to compare scores and nutrients, or ask “Is this vegan?”, “How much sugar?”, or “What’s a healthier alternative?” for specific help.";
  return "I can explain ingredients (e.g. “What is canola oil?” or “What does E415 mean?”), nutrition, and healthier swaps. Scan a product to ask about it, or ask about any ingredient by name.";
}

function allergenAnswer(product: ProductResult): string {
  const tags = product.allergens_tags ?? [];
  const fromIng = product.allergens_from_ingredients?.trim();
  if (tags.length) {
    const list = tags
      .map((t) => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " "))
      .map(toIngredientDisplayCase)
      .join(", ");
    return `From product data, allergens may include: ${list}. Always check the package for the official allergen statement.`;
  }
  if (fromIng)
    return `Allergens from ingredients: ${fromIng} Always check the package for the official allergen statement.`;
  return "I don’t have allergen data for this product. Check the package label and ingredients for allergens.";
}

function answerFoodQuestionLocal(args: {
  question: string;
  product?: ProductResult;
  analysis?: ProductAnalysis;
  profile?: HealthProfile | null;
  reactionSummary?: string;
}): string {
  const q = args.question.trim();
  if (!q) return "Ask a question about ingredients, additives, or nutrition.";
  const reactionTip =
    args.reactionSummary &&
    " Your logged symptoms and notes are used to personalize advice and spot patterns (see Today tab).";

  if (isSwapQuestion(q)) {
    const base = healthierOptionAnswer(args.product);
    return reactionTip ? `${base}${reactionTip}` : base;
  }

  if (args.product && isIngredientListQuestion(q)) {
    const { display } = getDisplayIngredientsFromProduct(args.product);
    if (!display.length) return "I couldn’t find an ingredient list for this product in the barcode/label data.";
    const max = 30;
    const shown = display.slice(0, max);
    const more = display.length - shown.length;
    return [
      "Ingredients (English):",
      ...shown.map((x) => `- ${x}`),
      more > 0 ? `- …and ${more} more` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (args.product && wantsHealthSummary(q)) {
    const base = genericHealthSummary(args.product, args.analysis, args.profile);
    return reactionTip ? `${base}${reactionTip}` : base;
  }

  if (args.product && isProductIdentityQuestion(q)) {
    return productSummary(args.product, args.analysis, args.profile);
  }
  if (args.product && isNutritionNumberQuestion(q)) {
    return nutritionFactAnswer(args.product, q);
  }
  if (args.product && isDietQuestion(q)) {
    return dietAnswer(args.analysis, q);
  }
  if (args.product && isScoreQuestion(q)) {
    return scoreAnswer(args.analysis, args.product);
  }
  if (args.product && isAllergenQuestion(q)) {
    return allergenAnswer(args.product);
  }

  const guessed = guessIngredientFromQuestion(q, args.product);
  if (!guessed) {
    if (args.product) {
      return productSummary(args.product, args.analysis, args.profile);
    }
    if (looksFoodRelated(q)) {
      return generalFoodAnswer(q);
    }
    return "I’m here for food and nutrition questions. Scan a product to ask about it, or ask about an ingredient (e.g. “What does E415 mean?” or “What is canola oil?”).";
  }

  const guessedEn = translateIngredientToEnglishMulti(guessed);
  const detail = getIngredientDetail(guessed) ?? getIngredientDetail(guessedEn);
  if (detail) {
    const displayName = toIngredientDisplayCase(detail.name);
    const lines = [
      displayName,
      `${detail.plainDescription}`,
      `Typical use: ${detail.typicalUse}`,
      `Health notes: ${detail.healthConsideration}`,
      args.profile
        ? "Tip: Your Health Profile is set, so warnings in the Results screen are personalized."
        : "Tip: Create a Health Profile to unlock personalized warnings (allergies/conditions/goals).",
    ];
    if (reactionTip) lines.push(reactionTip);
    return lines.join("\n");
  }

  // No curated entry: try translated name for generic pattern, then use universal fallback.
  const generic = genericIngredientExplanation(guessed) ?? genericIngredientExplanation(guessedEn);
  if (generic) {
    const nameForDisplay = genericIngredientExplanation(guessedEn) ? guessedEn : guessed;
    return [toIngredientDisplayCase(nameForDisplay), generic].join("\n");
  }

  const displayName = toIngredientDisplayCase(guessedEn || guessed);
  return [
    `${displayName} is in this product's ingredients.`,
    "It's often used for texture, flavour, or preservation in packaged foods. Check the label for the exact amount. You can also ask about the score, allergens, or a healthier alternative.",
  ].join("\n");
}

/**
 * Short generic explanation when we don't have a curated entry.
 * Enables answering "what does X mean" for any food.
 */
function genericIngredientExplanation(term: string): string | null {
  const t = normalize(term);
  if (!t) return null;

  // E-number (e.g. E150d, E338)
  if (/^e\s?\d{3,4}[a-z]?$/.test(t.replace(/\s/g, ""))) {
    return "An E-number is a code for an additive approved for use in food in the EU. The number indicates the type (e.g. colours, preservatives, acids). They are regulated and considered safe at permitted levels.";
  }

  // Pattern-based short explanations
  if (/\bacid\b/.test(t) || t.endsWith(" acid")) return "An acid used for flavour or as a preservative. Common in drinks and processed foods; generally safe at normal levels.";
  if (/\b(flavour|flavor)\b/.test(t)) return "A flavouring added to give a specific taste. Can be natural or synthetic; permitted flavourings are considered safe.";
  if (/\b(colour|color)\b/.test(t)) return "A colouring added to give the product its appearance. Permitted colours are regulated and generally safe at allowed levels.";
  if (/\b(sugar|sweetener|syrup)\b/.test(t)) return "A sweetening ingredient. Check the amount per serving if you are limiting sugar or managing blood sugar.";
  if (/\b(salt|sodium)\b/.test(t)) return "Adds flavour and can act as a preservative. Worth watching if you are limiting sodium.";
  if (/\b(oil|fat|butter)\b/.test(t)) return "A fat or oil used for texture, flavour, or cooking. Type and amount matter for nutrition.";
  if (/\b(starch|flour)\b/.test(t)) return "A carbohydrate used for texture or structure. Often from wheat, corn, or other grains; check if you avoid gluten.";
  if (/\b(preservative|antioxidant)\b/.test(t)) return "Helps keep the product from spoiling. Permitted preservatives are used in small, regulated amounts.";
  if (/\b(emulsifier|stabiliser|stabilizer)\b/.test(t)) return "Helps mix or stabilize ingredients (e.g. oil and water). Common in processed foods; generally safe.";
  if (/\bgum\b/.test(t) || t.endsWith(" gum")) return "A gelling or thickening agent used for texture. Common in drinks, jams, and dairy products; generally safe at normal levels.";
  if (/\bwater\b/.test(t)) return "Water is used as a base or to adjust texture. In carbonated form it adds fizz.";
  if (/\b(protein|extract)\b/.test(t)) return "Adds protein or flavour. Source may matter for allergies (e.g. soy, milk).";
  if (/\b(juice|fruit)\b/.test(t)) return "Fruit juice is juice from fruit, often used for flavour or sweetness. In ingredients, “fruit juice” can be from concentrate; check the label for added sugar or whether it’s 100% juice.";
  if (/\bphosphate\b/.test(t)) return "A mineral salt used to regulate acidity, improve texture, or bind water. Common in beverages and processed foods; generally safe at permitted levels.";
  if (/\bcarbonate\b/.test(t)) return "A mineral salt used as a pH regulator or leavening agent. Generally safe at food-use levels.";
  if (/\b(cream|milk|dairy)\b/.test(t)) return "A dairy ingredient that adds texture and flavour. Check the label if you avoid dairy or have an allergy.";
  if (/\b(coffee|tea)\b/.test(t)) return "Provides flavour and often caffeine. Check the label for caffeine content if you’re limiting it.";
  if (/\b(vitamin|mineral)\b/.test(t)) return "Added for nutrition or fortification. Amounts are usually on the label.";
  if (/\b(natural|nature)\b/.test(t)) return "Often refers to flavour or source. “Natural” on labels usually means derived from natural sources; check the full ingredients for details.";
  if (/\b(lecithin|soy)\b/.test(t)) return "Often used as an emulsifier. Source may be soy or other plants; check the label if you have allergies.";
  if (/\b(fiber|fibre)\b/.test(t)) return "Dietary fibre from plants; helps digestion and can help you feel full. Check the label for grams per serving.";
  if (/\b(cocoa|chocolate)\b/.test(t)) return "From cocoa beans; adds flavour and can contain caffeine. Dark chocolate often has less sugar than milk chocolate.";

  // Catch-all: every ingredient gets at least a short answer (no more "AI explanation isn't available").
  return "It's an ingredient in this product, often used for texture, flavour, or preservation. Check the label for details, or ask about the score, allergens, or a healthier alternative.";
}

export async function answerFoodQuestion(args: {
  question: string;
  product?: ProductResult;
  analysis?: ProductAnalysis;
  profile?: HealthProfile | null;
  /** Summary of user's logged body reactions (symptoms, severity, notes) for personalized advice */
  reactionSummary?: string;
}): Promise<string> {
  // Try Supabase Edge Function first (LLM-backed), fallback to local curated answers.
  try {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      const { supabase } = await import("@/lib/supabase");
      if (supabase) {
        const { data, error } = await supabase.functions.invoke("food-assistant", {
          body: {
            question: args.question,
            product: args.product ?? null,
            analysis: args.analysis ?? null,
            profile: args.profile ?? null,
            reactionSummary: args.reactionSummary ?? null,
          },
        });
        if (!error && data?.answer && typeof data.answer === "string") {
          return data.answer;
        }
      }
    }
  } catch {
    // ignore; use local answer
  }
  try {
    return answerFoodQuestionLocal(args);
  } catch {
    return "Ask me about an ingredient by name (e.g. “What is canola oil?” or “What does E415 mean?”), or scan a product to ask about it.";
  }
}

