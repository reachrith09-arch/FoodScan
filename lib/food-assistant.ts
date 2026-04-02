import type { DietType, HealthProfile, ProductAnalysis, ProductResult } from "@/types/food";
import {
  getDisplayIngredientsFromProduct,
  getIngredientDetail,
  parseIngredientsList,
  toIngredientDisplayCase,
  translateIngredientToEnglishMulti,
  translateIngredientsListToEnglish,
} from "@/lib/ingredients";
import { getLocalSwapTips } from "@/lib/swaps";

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
    q.match(/\bwhat(?:'s| is) (.+?)(?:\?|$)/) ??
    q.match(/\bexplain (.+?)(?:\?|$)/) ??
    q.match(/\btell me about (.+?)(?:\?|$)/) ??
    q.match(/\bis (.+?) (?:safe|bad|good|healthy|ok)/) ??
    q.match(/\bwhy (?:is|does) (.+?) /);
  if (m?.[1]) {
    const term = m[1].trim();
    if (term.length < 2) return null;
    if (/^(a|an|the|this|it|that)$/i.test(term)) return null;
    if (/\b(healthier|option|alternative|swap|substitute|ingredients?|this product|this food)\b/.test(term))
      return null;
    return term;
  }

  // If the question IS the ingredient name (bare word/phrase, no verb), treat it as "what is X?"
  // e.g. user typed "dextrose" or "xanthan gum" or "E415"
  const cleanQ = q.replace(/[?!.,]+$/, "").trim();
  const stopWords = /^(what|why|how|is|are|can|does|do|should|tell|explain|the|a|an|this|that|it|give|show|help|i|me|my|about|for|in|on|at|to|of|and|or)$/;
  const words = cleanQ.split(/\s+/);
  const isLikelyBareName =
    words.length <= 5 &&
    !words.some((w) => stopWords.test(w.toLowerCase())) &&
    !/\b(healthy|bad|good|safe|alternative|swap|snack|snacks|breakfast|lunch|dinner|meal|meals|drink|drinks|beverage|beverages|dessert|desserts)\b/.test(cleanQ);
  if (isLikelyBareName && cleanQ.length >= 2) {
    return cleanQ;
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

/** "What are some others", "any more swaps" — wants more alternatives, not a product recap. */
function isMoreSwapSuggestionsQuestion(
  question: string,
  chatHistory?: { role: string; content: string }[],
): boolean {
  const n = normalize(question);
  if (n.length > 120) return false;
  if (
    /\bwhat (are )?(some )?others?\b/.test(n) ||
    /\b(any|got) (other )?(thing|things|swap|swaps) else\b/.test(n) ||
    /\banything else\b/.test(n) ||
    /\bmore suggestions?\b/.test(n) ||
    /\bother ideas?\b/.test(n) ||
    /\bmore swaps?\b/.test(n) ||
    /\bother swaps?\b/.test(n) ||
    /\b(more|other|another) (healthy |healthier )?(alternative|alternatives|option|options|pick|picks)\b/.test(n) ||
    /\b(what|any) else (could|can|should) (i |you )?(try|eat|get|have|suggest)\b/.test(n)
  ) {
    return true;
  }
  if (/\b(give|show|tell) me more\b/.test(n) && /\b(swap|alternative|idea|option|pick|recommendation)\b/.test(n)) {
    return true;
  }
  // Vague "few more" / "couple more" — only after a swap-oriented reply (avoids hijacking other threads).
  const vagueMore =
    /\bgive me (a )?(few |couple )?more\b/.test(n) ||
    /\b(a )?(few|couple) more\b/.test(n) ||
    /\b(need|want) (a )?(few |couple )?more\b/.test(n);
  if (vagueMore && chatHistory?.length) {
    const lastAssistant = [...chatHistory].reverse().find((m) => m.role === "assistant");
    if (
      lastAssistant &&
      /\b(swap|swaps|alternative|alternatives|healthier|substitute|try instead|instead of|smarter swap|concrete swap|good swaps|other option|other pick)\b/i.test(
        lastAssistant.content,
      )
    ) {
      return true;
    }
  }
  return false;
}

function supplementalSwapBullets(product: ProductResult): string[] {
  const blob = normalize(`${product.product_name ?? ""} ${(product.categories_tags ?? []).join(" ")}`);
  if (/\b(candy|gummy|skittles|haribo|sweet|confection|chew|chews|marshmallow|patch|sour patch)\b/.test(blob)) {
    return [
      "• Frozen grapes or banana slices — cold, naturally sweet, no added sugar.",
      "• A small square of 70%+ dark chocolate or cocoa-dusted almonds — less sugar than chewy candy.",
      "• Apple with cinnamon, or a date with nut butter — fiber helps balance sweetness.",
    ];
  }
  if (/\b(chocolate|cocoa|m&m|gem|truffle)\b/.test(blob)) {
    return [
      "• Cacao nibs or 85%+ dark chocolate — rich flavor, smaller portions.",
      "• Berries with plain Greek yogurt — sweet plus protein.",
    ];
  }
  if (/\b(chip|crisp|dorito|pretzel|cracker)\b/.test(blob)) {
    return [
      "• Air-popped popcorn with a little olive oil and salt, or veggies with hummus.",
      "• Roasted chickpeas or edamame — crunchy, more protein and fiber.",
    ];
  }
  if (/\b(soda|cola|soft drink|pop|carbonated)\b/.test(blob)) {
    return [
      "• Sparkling water with lemon or lime, or iced herbal tea — bubbles without syrup.",
    ];
  }
  return [
    "• Whole fruit, plain yogurt, or a small handful of unsalted nuts.",
    "• Veggies with hummus, or whole-grain crackers with cheese.",
  ];
}

function moreSwapSuggestionsAnswer(product: ProductResult): string {
  const displayName =
    product.product_name_en ??
    product.product_name ??
    product.generic_name_en ??
    product.generic_name ??
    "this item";
  const tips = getLocalSwapTips(product);
  const lines: string[] = [
    `Here are more swap ideas for ${displayName} (not a repeat of the full product label):`,
    "",
    "Try also:",
    ...supplementalSwapBullets(product),
    "",
  ];
  if (tips.length > 0) {
    lines.push("Earlier picks (Smarter swaps):", ...tips.map((t) => `• ${t.suggestion} — ${t.reason}`), "", "");
  }
  lines.push("Use Smarter swaps on the result screen to find matching products in the database.");
  return lines.join("\n");
}

/** User replied with only a meal type after we asked "snack, breakfast, drink…?" — not an ingredient name. */
function swapCategoryFollowUpLabel(question: string): string | null {
  const q = normalize(question).replace(/[?!.,]+$/, "").trim();
  if (!q || q.split(/\s+/).length > 4) return null;
  if (/^snacks?$/.test(q)) return "snack";
  if (/^breakfast$/.test(q)) return "breakfast";
  if (/^lunch$/.test(q)) return "lunch";
  if (/^dinner$/.test(q)) return "dinner";
  if (/^meals?$/.test(q)) return "meal";
  if (/^drinks?$/.test(q) || /^beverages?$/.test(q)) return "drink";
  if (/^desserts?$/.test(q)) return "dessert";
  return null;
}

const SWAP_CATEGORY_GENERIC: Record<string, string> = {
  snack:
    "For healthier snacks: try fresh fruit, plain Greek yogurt, unsalted nuts, or veggies with hummus — more protein and fiber, less added sugar than typical candy or chips.",
  breakfast:
    "For breakfast: oatmeal with fruit, eggs with whole-grain toast, or plain yogurt with berries — steadier energy than very sugary cereals or pastries.",
  lunch:
    "For lunch: a meal with lean protein, vegetables, and whole grains — easier on blood sugar than mostly refined carbs.",
  dinner:
    "For dinner: half the plate vegetables, a palm-sized lean protein, and whole grains or beans — lighter than heavy ultra-processed mains.",
  meal:
    "For balanced meals: combine protein, fiber (veg/beans/whole grains), and healthy fats — keeps you full longer than mostly sugar or refined starch.",
  drink:
    "For drinks: water, sparkling water, unsweetened tea, or coffee without lots of syrup — far less sugar than soda or sweetened coffee.",
  dessert:
    "For dessert: fruit, dark chocolate (70%+), or yogurt with cinnamon — usually less sugar than candy or frosting-heavy treats.",
};

function swapCategoryFollowUpAnswer(product: ProductResult, category: string): string {
  const displayName =
    product.product_name_en ?? product.product_name ?? product.generic_name_en ?? product.generic_name ?? "this product";
  const tips = getLocalSwapTips(product).slice(0, 4);
  if (tips.length > 0) {
    const lines: string[] = [
      `You asked for ${category} ideas — here are concrete swaps that fit ${displayName} (same picks as Smarter swaps):`,
      "",
      ...tips.map((t) => `• ${t.suggestion} — ${t.reason}`),
      "",
      "Use Smarter swaps on the result screen to open catalog matches when we have them.",
    ];
    return lines.join("\n");
  }
  return SWAP_CATEGORY_GENERIC[category] ?? healthierOptionAnswer(product);
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
  chatHistory?: { role: string; content: string }[];
}): string {
  const q = args.question.trim();
  if (!q) return "Ask a question about ingredients, additives, or nutrition.";
  const reactionTip =
    args.reactionSummary &&
    " Your logged symptoms and notes are used to personalize advice and spot patterns (see Today tab).";

  if (isMoreSwapSuggestionsQuestion(q, args.chatHistory) && args.product) {
    const base = moreSwapSuggestionsAnswer(args.product);
    return reactionTip ? `${base}${reactionTip}` : base;
  }

  if (isSwapQuestion(q)) {
    const base = healthierOptionAnswer(args.product);
    return reactionTip ? `${base}${reactionTip}` : base;
  }

  const categoryFollowUp = swapCategoryFollowUpLabel(q);
  if (categoryFollowUp && args.product) {
    const base = swapCategoryFollowUpAnswer(args.product, categoryFollowUp);
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
    // Compact format: name + one flowing paragraph combining what it is, why it's used, and health notes
    const body = `${detail.plainDescription} ${detail.healthConsideration}`;
    const lines = [displayName, body];
    if (reactionTip) lines.push(reactionTip);
    return lines.join("\n");
  }

  // No curated entry: use universal ingredient explainer (works for any ingredient).
  const displayName = toIngredientDisplayCase(guessedEn || guessed);
  return [displayName, universalIngredientAnswer(guessedEn || guessed, args.product)].join("\n");
}

/**
 * Universal ingredient explainer — works for ANY ingredient.
 * Large inline lookup of common whole foods + smart heuristics for everything else.
 */
function universalIngredientAnswer(term: string, product?: ProductResult): string {
  const t = normalize(term);
  if (!t) return "Could not identify this ingredient.";
  const display = term.trim();

  const FOODS: Record<string, string> = {
    potato: "A starchy root vegetable rich in potassium, vitamin C, and fibre (with skin). Naturally gluten-free. One of the most filling foods per calorie.",
    potatoes: "Starchy root vegetables rich in potassium, vitamin C, and fibre (with skin). Naturally gluten-free. One of the most filling foods per calorie.",
    tomato: "A fruit rich in lycopene (a powerful antioxidant), vitamin C, and potassium. Cooking tomatoes increases lycopene availability.",
    tomatoes: "Fruits rich in lycopene (a powerful antioxidant), vitamin C, and potassium. Cooking tomatoes increases lycopene availability.",
    onion: "A vegetable with natural prebiotic fibres that support gut health. Contains quercetin, an antioxidant with anti-inflammatory properties.",
    onions: "Vegetables with natural prebiotic fibres that support gut health. Contain quercetin, an antioxidant with anti-inflammatory properties.",
    garlic: "A flavouring vegetable with allicin, a compound with antimicrobial and heart-health properties. Used in small amounts for flavour.",
    chicken: "A lean source of protein (~31g per 100g cooked breast) and B vitamins, especially niacin. Lower in saturated fat than red meat.",
    beef: "A red meat high in protein (~26g per 100g), iron (heme iron, well absorbed), zinc, and B12. Higher in saturated fat than poultry or fish.",
    pork: "A red meat high in protein, B vitamins (especially thiamin), and zinc. Processed pork (bacon, ham) often has added sodium and nitrites.",
    turkey: "A lean protein source (~29g per 100g) low in fat, rich in B vitamins and selenium. One of the leanest meat options.",
    lamb: "A red meat rich in protein, iron, zinc, and B12. Higher in saturated fat than chicken. Grass-fed lamb has more omega-3s.",
    fish: "Rich in protein, omega-3 fatty acids (especially oily fish like salmon and mackerel), and vitamin D. Omega-3s support heart and brain health.",
    salmon: "An oily fish rich in omega-3 fatty acids (EPA and DHA), protein, and vitamin D. One of the best food sources of omega-3s for heart and brain health.",
    tuna: "A lean fish high in protein and omega-3s. Canned tuna can contain mercury — limit to 2–3 servings per week, especially during pregnancy.",
    shrimp: "A shellfish low in calories, high in protein, and rich in selenium and iodine. A common allergen — avoid if allergic to shellfish.",
    prawns: "Shellfish low in calories, high in protein, selenium, and iodine. A common allergen — avoid if allergic to shellfish.",
    egg: "One of the most nutrient-dense foods: protein (~6g each), choline, B12, and vitamin D. The cholesterol in eggs has less effect on blood cholesterol than once thought.",
    eggs: "Nutrient-dense: protein (~6g each), choline, B12, and vitamin D. One of the top 14 allergens.",
    rice: "A gluten-free grain and staple carb. Brown rice has more fibre, B vitamins, and magnesium. White rice is refined and digests faster.",
    pasta: "A wheat-based carb that provides energy and some protein. Contains gluten — avoid if you have coeliac disease. Whole wheat pasta has more fibre.",
    bread: "A wheat-based staple providing carbs, some protein, and B vitamins. Contains gluten. Whole grain versions have more fibre and nutrients.",
    wheat: "A cereal grain and major source of carbs, protein (gluten), and B vitamins. One of the top 14 allergens. Avoid if you have coeliac disease.",
    corn: "A naturally gluten-free grain rich in fibre, B vitamins, and antioxidants. A common base for many processed food ingredients.",
    maize: "Another name for corn — a gluten-free grain rich in fibre, B vitamins, and antioxidants.",
    oats: "A whole grain rich in beta-glucan (a soluble fibre that lowers LDL cholesterol), iron, and B vitamins. Naturally gluten-free but often contaminated during processing.",
    barley: "A whole grain high in soluble fibre (beta-glucan) which supports heart health. Contains gluten — not suitable for coeliac disease.",
    rye: "A whole grain with more fibre than wheat, often used in bread. Contains gluten. Rye bread typically has a lower glycaemic index than white bread.",
    quinoa: "A complete plant protein (all 9 essential amino acids) and naturally gluten-free. Rich in fibre, iron, and magnesium.",
    lentils: "Legumes high in plant protein (~9g per 100g cooked), fibre, iron, and folate. Excellent for heart health and blood sugar control.",
    chickpeas: "Legumes rich in plant protein, fibre, iron, and folate. Help with blood sugar control due to high fibre content. Naturally gluten-free.",
    beans: "Legumes high in plant protein, fibre, iron, and folate. One of the best foods for gut health.",
    peas: "Legumes rich in plant protein, fibre, vitamin C, and vitamin K. Pea protein is a common dairy-free alternative.",
    soybean: "A complete plant protein with all essential amino acids. Rich in isoflavones. One of the top 14 allergens.",
    soybeans: "Complete plant proteins with all essential amino acids. Rich in isoflavones. One of the top 14 allergens.",
    almond: "A tree nut rich in vitamin E, magnesium, and healthy monounsaturated fats. A major allergen — avoid if allergic to tree nuts.",
    almonds: "Tree nuts rich in vitamin E, magnesium, and healthy monounsaturated fats. A major allergen.",
    peanut: "A legume (not a true nut) high in protein, healthy fats, and niacin. One of the most common food allergens — reactions can be severe.",
    peanuts: "Legumes (not true nuts) high in protein, healthy fats, and niacin. One of the most common food allergens.",
    walnut: "A tree nut uniquely high in omega-3 fatty acids (ALA). Also rich in antioxidants. A major allergen.",
    walnuts: "Tree nuts uniquely high in omega-3 fatty acids (ALA). Rich in antioxidants. A major allergen.",
    cashew: "A tree nut lower in fat than most nuts, with good iron and zinc content. A major allergen.",
    cashews: "Tree nuts lower in fat than most nuts, with good iron and zinc. A major allergen.",
    hazelnut: "A tree nut rich in vitamin E and healthy fats. Common in chocolate spreads and confectionery. A major allergen.",
    hazelnuts: "Tree nuts rich in vitamin E and healthy fats. Common in chocolate spreads. A major allergen.",
    coconut: "A tropical fruit high in saturated fat (mainly lauric acid). Coconut oil has ~82% saturated fat — higher than butter.",
    avocado: "A fruit rich in heart-healthy monounsaturated fats, potassium, and fibre. High in calories (~160 per fruit) but very nutritious.",
    banana: "A fruit rich in potassium (~360mg per medium banana), vitamin B6, and natural sugars. Provides quick energy.",
    apple: "A fruit rich in fibre (pectin) and vitamin C. The skin has most of the fibre and antioxidants. Low in calories (~52 per 100g).",
    apples: "Fruits rich in fibre (pectin) and vitamin C. The skin has most of the fibre and antioxidants.",
    orange: "A citrus fruit rich in vitamin C (~53mg per 100g) and flavonoids. The whole fruit provides fibre that juice does not.",
    oranges: "Citrus fruits rich in vitamin C and flavonoids. Whole oranges provide fibre that juice does not.",
    lemon: "A citrus fruit rich in vitamin C and citric acid. Used for flavour and as a natural preservative.",
    lime: "A citrus fruit similar to lemon, rich in vitamin C. Used for flavour and acidity.",
    mango: "A tropical fruit high in vitamin C, vitamin A (beta-carotene), and natural sugars. Higher in sugar than many fruits.",
    strawberry: "A berry rich in vitamin C, manganese, and antioxidants. Low in calories (~33 per 100g).",
    blueberry: "A berry exceptionally high in antioxidants, vitamin C, and vitamin K. Often called a superfood for antioxidant content.",
    raspberry: "A berry high in fibre (~7g per 100g), vitamin C, and antioxidants. One of the highest-fibre fruits.",
    grape: "A fruit used fresh, dried (raisins), or as juice/wine. Contains resveratrol (an antioxidant). Relatively high in natural sugars.",
    grapes: "Fruits used fresh, dried, or as juice/wine. Contain resveratrol. Relatively high in natural sugars.",
    cranberry: "A berry rich in antioxidants that may help prevent urinary tract infections. Often heavily sweetened in processed forms.",
    carrot: "A root vegetable exceptionally high in beta-carotene (converts to vitamin A). Good for eye health. Naturally sweet.",
    carrots: "Root vegetables exceptionally high in beta-carotene (converts to vitamin A). Good for eye health.",
    celery: "A low-calorie vegetable (~16 cal/100g) with some potassium and vitamin K. Mostly water.",
    spinach: "A leafy green very high in vitamin K, vitamin A, iron, and folate. Iron is less well absorbed than from meat due to oxalates.",
    broccoli: "A cruciferous vegetable rich in vitamin C, vitamin K, folate, and sulforaphane (studied for anti-cancer properties).",
    cauliflower: "A cruciferous vegetable low in calories, high in vitamin C and fibre. Popular as a low-carb substitute.",
    cabbage: "A cruciferous vegetable high in vitamin C and K. Fermented cabbage (sauerkraut, kimchi) provides probiotics.",
    lettuce: "A leafy green very low in calories (~15/100g). Romaine has more nutrients than iceberg.",
    cucumber: "A very low-calorie vegetable (~16/100g), mostly water. Provides some vitamin K. Hydrating.",
    pepper: "A vegetable rich in vitamin C (red peppers have more than oranges), vitamin A, and antioxidants.",
    peppers: "Vegetables rich in vitamin C (red peppers have more than oranges), vitamin A, and antioxidants.",
    mushroom: "A fungus low in calories, rich in B vitamins and selenium. Some varieties contain beta-glucans that may support immunity.",
    mushrooms: "Fungi low in calories, rich in B vitamins and selenium. Some varieties may support immune function.",
    ginger: "A root with anti-inflammatory and anti-nausea properties. Contains gingerols (bioactive compounds).",
    turmeric: "A spice containing curcumin, with anti-inflammatory and antioxidant properties. Absorption improves with black pepper and fat.",
    cinnamon: "A spice that may help lower blood sugar and has antioxidant properties. Safe at food levels.",
    paprika: "A spice from dried peppers, rich in vitamin A and antioxidants. Adds colour and mild flavour.",
    oregano: "An herb rich in antioxidants. Used for flavour in Mediterranean cooking. Safe at food levels.",
    basil: "An herb with antioxidant and anti-inflammatory properties. Used for flavour. Safe in food amounts.",
    parsley: "An herb rich in vitamin K, vitamin C, and vitamin A. Safe at food levels.",
    thyme: "An herb with antimicrobial properties (thymol). Rich in vitamin C and manganese. Safe at food levels.",
    rosemary: "An herb with antioxidant properties. Used for flavour, especially with meats. Safe at food levels.",
    mint: "An herb that aids digestion and adds a cooling flavour (menthol).",
    vanilla: "A spice from orchid pods. Natural vanilla is expensive — most products use synthetic vanillin instead.",
    honey: "A natural sweetener with small amounts of antioxidants. Still counts as added sugar — about 80% sugar by weight.",
    maple: "A natural sweetener from maple tree sap. Contains manganese and zinc. Still counts as added sugar.",
    vinegar: "A fermented liquid (acetic acid) for flavour and preservation. Apple cider vinegar may help with blood sugar control.",
    mustard: "A condiment from mustard seeds, low in calories. Contains selenium and omega-3s. A top-14 allergen.",
    tofu: "A soy product high in plant protein (~8g/100g), calcium (if set with calcium sulfate), and iron. Avoid if allergic to soy.",
    olive: "Rich in heart-healthy monounsaturated fats and antioxidants. Extra virgin olive oil is one of the healthiest fats.",
    olives: "Rich in heart-healthy monounsaturated fats and antioxidants.",
    butter: "A dairy fat (~80% fat) high in saturated fat. Contains vitamins A, D, E, K.",
    cheese: "A dairy product high in calcium, protein, and saturated fat. Contains sodium. Aged cheeses are lower in lactose.",
    yogurt: "A fermented dairy product rich in protein, calcium, and probiotics. Choose plain — flavoured yogurt often has high added sugar.",
    whey: "A dairy protein rich in essential amino acids and leucine (supports muscle). Common allergen for people with dairy allergy.",
    cream: "A high-fat dairy product (18–48% fat). Adds richness. High in saturated fat — fine in moderation.",
    milk: "Provides protein (~3.4g/100ml), calcium (~120mg/100ml), and vitamins B12 and D. Avoid if dairy-allergic or lactose-intolerant.",
    gelatin: "A protein from animal collagen (pig or cow). Used as a gelling agent. Not suitable for vegetarians/vegans.",
    gelatine: "A protein from animal collagen (pig or cow). Used as a gelling agent. Not suitable for vegetarians/vegans.",
    cocoa: "From cacao beans — contains flavanols (antioxidants), caffeine, and theobromine. Dark chocolate (70%+) has more benefits.",
    chocolate: "Made from cocoa, sugar, and fat. Dark chocolate has more antioxidants. Milk chocolate is higher in sugar.",
    coffee: "Contains caffeine, antioxidants, and chlorogenic acids. Moderate intake (3–4 cups/day) is linked to health benefits.",
    tea: "Contains caffeine (less than coffee), polyphenol antioxidants, and L-theanine. Green tea has more catechins than black.",
    "pea protein": "A plant protein from yellow split peas. A complete protein with all essential amino acids. Common dairy-free alternative.",
    "coconut oil": "Very high in saturated fat (~82%). Used for texture and flavour. Less heart-healthy than olive or canola oil.",
    "olive oil": "One of the healthiest cooking fats — high in monounsaturated fats and antioxidants. Supports heart health.",
    "sunflower oil": "High in polyunsaturated fats (omega-6). Neutral flavour. Most Western diets already have too much omega-6.",
    "palm oil": "High in saturated fat (~50%). Better than trans fats but less healthy than olive or canola oil. Environmental concerns with sourcing.",
    "canola oil": "Low in saturated fat (~7%), high in monounsaturated fats and omega-3s. Considered one of the healthier cooking oils.",
    "rapeseed oil": "Same as canola oil — low in saturated fat, high in monounsaturated fats and omega-3s.",
    "soybean oil": "High in polyunsaturated fats. A common cooking oil. Generally safe even for people with soy allergy (protein is removed).",
    "corn oil": "High in polyunsaturated fats (omega-6). Neutral flavour. A common cooking oil.",
    "sesame oil": "Rich in antioxidants and polyunsaturated fats. Sesame is a top-14 allergen.",
    "cocoa butter": "The fat from cocoa beans — gives chocolate its smooth texture. High in saturated fat but fine in normal chocolate amounts.",
    "shea butter": "A plant fat used in confectionery as a cocoa butter equivalent. Generally safe at food levels.",
  };

  // Check the food lookup (try exact, singular, plural)
  const foodInfo = FOODS[t] ?? FOODS[t.replace(/e?s$/, "")] ?? FOODS[t + "s"];
  if (foodInfo) return foodInfo;

  // E-number
  if (/^e\s?\d{3,4}[a-z]?$/.test(t.replace(/\s/g, "")))
    return "An E-number additive approved in the EU. The number tells you the type: 1xx = colours, 2xx = preservatives, 3xx = antioxidants, 4xx = thickeners, 6xx = flavour enhancers. Regulated and considered safe.";

  // Additives and functional ingredients (pattern-based)
  if (/dextrose/.test(t)) return "Pure glucose from corn/wheat starch. Raises blood sugar faster than table sugar. Counts toward total sugars on the label.";
  if (/maltodextrin/.test(t)) return "A processed carb from starch with a very high glycaemic index (higher than sugar). Used as a filler/thickener. Low nutritional value.";
  if (/fructose/.test(t)) return "A sugar processed mainly by the liver. Added fructose usually comes from corn syrup. High intake is linked to fatty liver and raised triglycerides.";
  if (/xanthan/.test(t)) return "A thickener from fermenting sugar with bacteria. Widely used in gluten-free products. Acts as soluble fibre. Generally safe.";
  if (/pectin/.test(t)) return "A natural fibre from fruit skins, used as a gelling agent. A soluble fibre that can lower LDL cholesterol. Very safe.";
  if (/carrageenan/.test(t)) return "A thickener from red seaweed. Generally safe, but some research suggests it may cause gut inflammation in sensitive people, especially with IBS.";
  if (/(nitrate|nitrite)/.test(t)) return "Preservatives in cured meats. Prevent bacteria but can form potentially carcinogenic nitrosamines when cooked at high heat.";
  if (/(msg|monosodium glutamate)/.test(t)) return "A flavour enhancer adding savoury umami taste. Occurs naturally in tomatoes and parmesan. The headache claim isn't supported by controlled studies.";
  if (/acid/.test(t) || t.endsWith(" acid")) return "An acid for tartness, pH control, and preservation. Common types: citric (from citrus), lactic (from fermentation). Safe at food levels.";
  if (/(flavou?r)/.test(t) && !/(colour|color)/.test(t)) return "A flavouring to create or enhance taste. Can be natural (from food) or artificial (lab-made). Both are regulated and safe. 'Natural' just means the source was biological.";
  if (/(colour|color)/.test(t)) return "A colouring agent for appearance. Can be natural (beetroot, turmeric) or synthetic. Some artificial colours are linked to hyperactivity in sensitive children.";
  if (/sugar/.test(t)) return "A sweetener counting as added sugar. WHO recommends under 25g added sugar/day. High intake is linked to tooth decay, blood sugar spikes, and weight gain.";
  if (/sweetener/.test(t)) return "A low/zero-calorie sugar substitute. Common types: stevia (natural), aspartame, sucralose (artificial). Don't spike blood sugar. Sugar alcohols can cause bloating at high amounts.";
  if (/syrup/.test(t)) return "A liquid sugar, often from corn, rice, or glucose. Adds sweetness and moisture. High-fructose corn syrup is linked to metabolic issues in large amounts.";
  if (/(salt|sodium)/.test(t)) return "Sodium for flavour and preservation. Daily limit: under 2,300mg. High intake raises blood pressure and cardiovascular risk.";
  if (/(oil|fat)/.test(t)) return "A fat for richness and texture. Unsaturated fats (olive, canola) are heart-healthier than saturated (palm, coconut). Trans fats are banned in most places.";
  if (/(starch|flour)/.test(t)) return "A carb for thickening or structure. Sources: wheat (has gluten), corn, potato, rice. Avoid wheat-based if you have coeliac disease.";
  if (/preservative/.test(t)) return "Slows spoilage from bacteria, mould, or oxidation. Common ones: sodium benzoate, sorbic acid, nitrates. Some people are sensitive to certain types.";
  if (/antioxidant/.test(t)) return "Prevents fats from going rancid. Examples: vitamin E, vitamin C. Generally safe and some have nutritional benefits.";
  if (/emulsifier/.test(t)) return "Keeps oil and water mixed so the product doesn't separate. Common types: lecithin (soy/sunflower), mono- and diglycerides. Generally safe.";
  if (/(stabilis|stabiliz)/.test(t)) return "Maintains texture and prevents separation. Common types: xanthan gum, carrageenan, pectin. Generally safe at food levels.";
  if (/gum/.test(t)) return "A plant-derived thickener for smooth texture. Types: xanthan, guar, locust bean gum. Some act as soluble fibre. Generally safe.";
  if (/protein/.test(t)) return "Protein for nutrition or texture. Source matters for allergies — common: whey (dairy), soy, pea, egg. Check the label if you have allergies.";
  if (/extract/.test(t)) return "A concentrated form of flavour or nutrients from a natural source. Generally safe. Yeast extract contains glutamates (natural umami).";
  if (/(juice|fruit)/.test(t)) return "Juice or fruit for flavour, sweetness, or colour. Even natural juice counts as sugar — check total sugar per serving.";
  if (/phosphate/.test(t)) return "A phosphate salt for acidity, texture, or moisture. High intake from processed foods has been linked to kidney strain.";
  if (/carbonate/.test(t)) return "A carbonate salt for leavening (makes things rise) or pH control. Baking soda is the most common. Safe at food levels.";
  if (/(cream|milk|dairy)/.test(t)) return "A dairy ingredient with fat, protein, and calcium. Contains lactose and casein/whey (allergens). Avoid if dairy-allergic or lactose-intolerant.";
  if (/niacin|vitamin.?b3/.test(t)) return "Niacin (vitamin B3) helps convert food to energy and supports skin, nerves, and digestion. Daily need: 14–16mg. Safe at food levels.";
  if (/riboflavin|vitamin.?b2/.test(t)) return "Riboflavin (vitamin B2) produces energy and supports skin and eyes. Daily need: 1.1–1.3mg. Harmlessly turns urine bright yellow.";
  if (/thiamin|vitamin.?b1/.test(t)) return "Thiamin (vitamin B1) converts carbs to energy and supports nerves. Daily need: 1.1–1.2mg. Safe at food levels.";
  if (/folic.?acid|folate|vitamin.?b9/.test(t)) return "Folic acid (vitamin B9) is essential for DNA synthesis. Critical during pregnancy. Daily need: 400mcg (600mcg when pregnant).";
  if (/vitamin.?b12/.test(t)) return "Vitamin B12 supports nerves and red blood cells. Found almost only in animal products — critical for vegans. Daily need: 2.4mcg.";
  if (/vitamin.?d/.test(t)) return "Vitamin D helps absorb calcium for bone health and immunity. Deficiency is very common. Daily need: 600–800 IU.";
  if (/vitamin.?c|ascorbic/.test(t)) return "Vitamin C supports immunity, collagen, and iron absorption. Daily need: 75–90mg. Also used as a natural preservative.";
  if (/vitamin/.test(t)) return "A vitamin added to fortify this product. Safe at food levels. Check the label for % of daily recommended intake.";
  if (/iron/.test(t) && !/environ/.test(t)) return "Iron carries oxygen in blood and supports energy. Daily need: 8mg (men) / 18mg (women). Deficiency causes fatigue and anaemia.";
  if (/zinc/.test(t)) return "Zinc supports immunity, wound healing, and taste. Daily need: 8–11mg. Deficiency impairs immune function.";
  if (/calcium/.test(t)) return "Calcium is essential for bones, teeth, muscles, and nerves. Daily need: 1,000–1,200mg. Most people don't get enough.";
  if (/magnesium/.test(t)) return "Magnesium supports 300+ enzyme reactions including energy, muscles, and blood sugar. Daily need: 310–420mg. Many people fall short.";
  if (/potassium/.test(t) && !/potassium sorbate|potassium phosphate|potassium carbonate/.test(t)) return "Potassium regulates fluids, muscles, and nerves. Helps counteract sodium's blood pressure effect. Daily need: 2,600–3,400mg.";
  if (/mineral/.test(t)) return "A mineral for nutritional fortification: iron (oxygen transport), calcium (bones), zinc (immunity), magnesium (energy). Safe at food levels.";
  if (/lecithin/.test(t)) return "A natural emulsifier keeping fat and water mixed. Usually from soy or sunflower. Check the source if you have a soy allergy.";
  if (/soy/.test(t)) return "A top-14 allergen used as protein, oil, lecithin, or flour. A complete plant protein. Soy oil is usually safe even for soy-allergic people.";
  if (/(fibe?r)/.test(t)) return "Dietary fibre for digestive health. Soluble fibre feeds gut bacteria and can lower cholesterol. Most adults need 25–30g/day.";
  if (/(cocoa|chocolate)/.test(t)) return "From cacao beans — contains flavanols (antioxidants), caffeine, and theobromine. Dark chocolate (70%+) has more benefits and less sugar.";
  if (/coffee/.test(t)) return "Contains caffeine, antioxidants, and chlorogenic acids. Moderate intake (3–4 cups/day) is linked to health benefits. Limit if pregnant.";
  if (/tea/.test(t)) return "Contains caffeine (less than coffee), polyphenol antioxidants, and L-theanine. Green tea has more catechins than black.";

  // Suffix-based heuristics for unknown chemical names
  if (/ose$/.test(t)) return `${display} — the "-ose" ending means this is a type of sugar. It counts toward total sugars and raises blood sugar. People with diabetes should account for it.`;
  if (/ate$/.test(t)) return `${display} is a salt or mineral compound, typically used as a preservative, acidity regulator, or nutrient. Generally safe at permitted food levels.`;
  if (/ite$/.test(t)) return `${display} is a preservative or antioxidant used to extend shelf life. Check if you have sulphite sensitivity (can trigger asthma in some people).`;
  if (/ase$/.test(t)) return `${display} is an enzyme (the "-ase" ending). Enzymes speed up reactions in food processing — e.g. breaking down starches or proteins. Used in tiny amounts. Safe.`;
  if (/ol$/.test(t) && t.length > 3) return `${display} is likely a sugar alcohol (polyol) — a low-calorie sweetener. Less impact on blood sugar than sugar, but high amounts can cause bloating or loose stools.`;
  if (/ide$/.test(t)) return `${display} is a chemical compound. Common food examples: sodium chloride (salt), carbon dioxide (fizz). The specific compound determines its role.`;

  // Category heuristics
  if (/(spice|herb|season|powder|seed|leaf|leaves|root|bark|peel|zest|dried|ground|crushed)/.test(t))
    return `${display} is a natural flavouring — a spice, herb, or plant extract for taste and aroma. Generally safe with antioxidant properties. Used in small amounts.`;
  if (/(vinegar|ferment|culture|yeast|sourdough)/.test(t))
    return `${display} is a fermented ingredient for flavour, preservation, or texture. Fermented foods can contain beneficial bacteria, though heat processing reduces live cultures.`;
  if (/(nut|almond|cashew|walnut|peanut|hazelnut|sesame|pistachio|pecan|macadamia)/.test(t))
    return `${display} is a nut — rich in healthy fats, protein, and fibre. Nuts are major allergens. Always check the allergen statement if you have a nut allergy.`;
  if (/(lentil|chickpea|bean|pea|legume|pulse|dal|edamame)/.test(t))
    return `${display} is a legume — high in plant protein, fibre, iron, and folate. Great for heart health and blood sugar. Naturally gluten-free.`;
  if (/(wheat|oat|rice|barley|rye|corn|maize|quinoa|millet|buckwheat|grain|cereal)/.test(t))
    return `${display} is a grain or cereal providing carbs and, in whole form, fibre and B vitamins. Wheat, barley, and rye contain gluten.`;

  // Universal fallback — uses product context to give useful position info
  let positionInfo = "";
  if (product) {
    const ingText = normalize(product.ingredients_text_en ?? product.ingredients_text ?? "");
    const idx = ingText.indexOf(t);
    if (idx >= 0) {
      const before = ingText.substring(0, idx);
      const commasBefore = (before.match(/,/g) ?? []).length;
      const totalCommas = (ingText.match(/,/g) ?? []).length;
      if (totalCommas > 0) {
        const position = commasBefore + 1;
        const total = totalCommas + 1;
        const pct = Math.round((position / total) * 100);
        if (pct <= 20) positionInfo = " It appears near the top of the ingredient list, meaning this product contains a relatively large amount of it.";
        else if (pct <= 50) positionInfo = " It's in the middle of the ingredient list, so it's a moderate component.";
        else positionInfo = " It's toward the end of the ingredient list, meaning only a small amount is used.";
      }
    }
  }

  return `${display} is a food ingredient used in this product.${positionInfo} It's a recognised ingredient considered safe for consumption.`;
}

export type FoodAssistantChatTurn = { role: "user" | "assistant"; content: string };

export async function answerFoodQuestion(args: {
  question: string;
  product?: ProductResult;
  analysis?: ProductAnalysis;
  profile?: HealthProfile | null;
  /** Summary of user's logged body reactions (symptoms, severity, notes) for personalized advice */
  reactionSummary?: string;
  /** Prior turns (exclude the current question). Improves follow-ups when using the LLM. */
  chatHistory?: FoodAssistantChatTurn[];
}): Promise<string> {
  const q0 = args.question.trim();
  if (isMoreSwapSuggestionsQuestion(q0, args.chatHistory) && args.product) {
    const base = moreSwapSuggestionsAnswer(args.product);
    const reactionTip =
      args.reactionSummary?.trim() &&
      " Your logged symptoms and notes are used to personalize advice and spot patterns (see Today tab).";
    return reactionTip ? `${base}${reactionTip}` : base;
  }

  const categoryOnly = swapCategoryFollowUpLabel(q0);
  if (categoryOnly) {
    const base = args.product
      ? swapCategoryFollowUpAnswer(args.product, categoryOnly)
      : `${SWAP_CATEGORY_GENERIC[categoryOnly] ?? "Scan a product and I can suggest swaps that match it."} Not medical advice.`;
    const reactionTip =
      args.reactionSummary?.trim() &&
      " Your logged symptoms and notes are used to personalize advice and spot patterns (see Today tab).";
    return reactionTip ? `${base}${reactionTip}` : base;
  }

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
            history: args.chatHistory ?? [],
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
    return answerFoodQuestionLocal({
      question: args.question,
      product: args.product,
      analysis: args.analysis,
      profile: args.profile ?? null,
      reactionSummary: args.reactionSummary,
      chatHistory: args.chatHistory,
    });
  } catch {
    return "Ask me about an ingredient by name (e.g. “What is canola oil?” or “What does E415 mean?”), or scan a product to ask about it.";
  }
}

