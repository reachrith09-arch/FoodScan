import type { HealthProfile, HealthRisk, ProductResult } from "@/types/food";

const HIGH_SODIUM_PER_100G_MG = 400;
const HIGH_SUGAR_PER_100G_G = 15;
const HIGH_CALORIES_PER_100G_KCAL = 250;
const HIGH_SAT_FAT_PER_100G_G = 5;
const GOOD_PROTEIN_PER_100G_G = 10;
const GOOD_FIBER_PER_100G_G = 3;

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const ALLERGEN_MAPPING: Record<string, string[]> = {
  nuts: ["nut", "hazelnut", "almond", "walnut", "cashew", "pistachio", "pecan", "macadamia", "brazil nut", "en:nuts", "tree nut"],
  peanut: ["peanut", "groundnut", "arachis", "en:peanuts"],
  dairy: ["milk", "dairy", "lactose", "en:milk", "cream", "whey", "casein", "caseinate", "butter", "cheese", "yogurt", "ghee"],
  gluten: ["gluten", "wheat", "barley", "rye", "spelt", "kamut", "triticale", "en:gluten"],
  wheat: ["wheat", "flour", "semolina", "durum", "spelt", "kamut", "farina", "en:wheat"],
  shellfish: ["shellfish", "shrimp", "prawn", "crab", "lobster", "crayfish", "en:shellfish"],
  fish: ["fish", "anchov", "sardine", "tuna", "salmon", "cod", "tilapia", "pollock", "mackerel", "herring", "en:fish"],
  soy: ["soy", "soya", "soybean", "tofu", "edamame", "tempeh", "en:soybeans"],
  eggs: ["egg", "albumin", "lysozyme", "mayonnaise", "en:eggs"],
  sesame: ["sesame", "tahini", "en:sesame-seeds"],
  mustard: ["mustard", "en:mustard"],
  celery: ["celery", "celeriac", "en:celery"],
  lupin: ["lupin", "lupine", "lupini", "en:lupin"],
  sulfite: ["sulfite", "sulphite", "sulfur dioxide", "sulphur dioxide", "metabisulfite", "metabisulphite", "so2", "en:sulphur-dioxide-and-sulphites"],
  corn: ["corn", "maize", "cornstarch", "corn syrup", "dextrose", "maltodextrin"],
  coconut: ["coconut", "copra"],
  mollusc: ["mollusc", "mollusk", "squid", "octopus", "clam", "mussel", "oyster", "scallop", "snail"],
};

function productHasAllergen(product: ProductResult, allergen: string): boolean {
  const a = normalizeForMatch(allergen);
  const tags = product.allergens_tags ?? [];
  const fromIng = normalizeForMatch(product.allergens_from_ingredients ?? "");
  const ingText = normalizeForMatch(product.ingredients_text ?? "");
  if (tags.some((tag) => tag.toLowerCase().includes(a) || a.includes(tag.replace(/^en:/, "").replace(/-/g, " "))))
    return true;
  if (fromIng && fromIng.includes(a)) return true;
  if (ingText && ingText.includes(a)) return true;
  const keys = Object.keys(ALLERGEN_MAPPING).filter((k) => a.includes(k) || k.includes(a));
  for (const k of keys) {
    for (const v of ALLERGEN_MAPPING[k]) {
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

function conditionMatch(conditions: string[], ...terms: string[]): boolean {
  return conditions.some((c) => terms.some((t) => c.includes(t)));
}

function ingredientTextContains(product: ProductResult, pattern: RegExp): boolean {
  const text = normalizeForMatch(product.ingredients_text ?? "");
  return pattern.test(text);
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
  const satFat100 = nut?.["saturated-fat_100g"] ?? nut?.["saturated-fat"];
  const fiber100 = nut?.fiber_100g ?? nut?.fiber;
  const carbs100 = nut?.carbohydrates_100g ?? nut?.carbohydrates;
  const fat100 = nut?.fat_100g ?? nut?.fat;

  // ─── Allergies → critical ─────────────────────────────────
  for (const allergy of allergies) {
    if (productHasAllergen(product, allergy)) {
      risks.push({
        severity: "critical",
        category: "Allergy",
        message: `Contains ${allergy}. Avoid if you have this allergy.`,
      });
    }
  }

  // ─── Conditions ───────────────────────────────────────────

  // Hypertension / high blood pressure
  if (conditionMatch(conditions, "hypertension", "blood pressure", "high bp") && sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
    risks.push({ severity: "warning", category: "Sodium", message: "High sodium – caution if you have hypertension." });
  }

  // Diabetes
  if (conditionMatch(conditions, "diabetes", "diabetic", "blood sugar", "type 1", "type 2", "t1d", "t2d")) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({ severity: "warning", category: "Sugar", message: "High sugar – consider if you are managing diabetes." });
    }
    if (carbs100 != null && carbs100 > 40) {
      risks.push({ severity: "info", category: "Carbs", message: "High carbohydrates – may affect blood sugar levels." });
    }
  }

  // Celiac disease
  if (conditionMatch(conditions, "celiac", "coeliac", "gluten") && productHasGluten(product)) {
    risks.push({ severity: "critical", category: "Gluten", message: "Contains gluten – not suitable for celiac disease." });
  }

  // Kidney disease
  if (conditionMatch(conditions, "kidney", "renal", "ckd")) {
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "warning", category: "Sodium", message: "High sodium – caution with kidney disease." });
    }
    if (protein100 != null && protein100 > 15) {
      risks.push({ severity: "info", category: "Protein", message: "High protein – may need to limit with kidney disease. Ask your doctor." });
    }
    if (ingredientTextContains(product, /potassium|phosph/)) {
      risks.push({ severity: "info", category: "Mineral", message: "May contain potassium/phosphorus – monitor with kidney disease." });
    }
  }

  // Heart disease / cardiovascular
  if (conditionMatch(conditions, "heart", "cardiovascular", "cvd", "coronary")) {
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "warning", category: "Sodium", message: "High sodium – caution for heart health." });
    }
    if (satFat100 != null && satFat100 > HIGH_SAT_FAT_PER_100G_G) {
      risks.push({ severity: "warning", category: "Fat", message: "High saturated fat – may affect heart health." });
    }
    if (ingredientTextContains(product, /trans fat|partially hydrogenated/)) {
      risks.push({ severity: "warning", category: "Fat", message: "Contains trans fats – avoid for heart health." });
    }
  }

  // High cholesterol
  if (conditionMatch(conditions, "cholesterol", "hypercholesterol", "high cholesterol", "hyperlipid")) {
    if (satFat100 != null && satFat100 > HIGH_SAT_FAT_PER_100G_G) {
      risks.push({ severity: "warning", category: "Fat", message: "High saturated fat – may raise cholesterol levels." });
    }
    if (ingredientTextContains(product, /trans fat|partially hydrogenated/)) {
      risks.push({ severity: "warning", category: "Fat", message: "Contains trans fats – can raise LDL cholesterol." });
    }
  }

  // IBS (Irritable Bowel Syndrome)
  if (conditionMatch(conditions, "ibs", "irritable bowel")) {
    if (ingredientTextContains(product, /sorbitol|mannitol|xylitol|maltitol|isomalt|lactitol|erythritol|inulin|chicory root|fructooligosaccharide|fos/)) {
      risks.push({ severity: "warning", category: "FODMAP", message: "Contains sugar alcohols or FODMAPs – may trigger IBS symptoms." });
    }
    if (ingredientTextContains(product, /garlic|onion|wheat|rye|honey|high fructose|agave/)) {
      risks.push({ severity: "info", category: "FODMAP", message: "Contains high-FODMAP ingredients – may worsen IBS in some people." });
    }
    if (ingredientTextContains(product, /lactose|milk powder|whey/)) {
      risks.push({ severity: "info", category: "FODMAP", message: "Contains lactose – a common IBS trigger." });
    }
  }

  // GERD / Acid reflux
  if (conditionMatch(conditions, "gerd", "acid reflux", "reflux", "heartburn")) {
    if (ingredientTextContains(product, /caffeine|coffee|chocolate|cocoa|mint|peppermint|spearmint|citric acid|tomato|vinegar|chili|capsaicin|hot pepper/)) {
      risks.push({ severity: "info", category: "Reflux", message: "Contains ingredients that may trigger acid reflux (caffeine, acidic, mint, or spicy)." });
    }
    if (fat100 != null && fat100 > 15) {
      risks.push({ severity: "info", category: "Reflux", message: "High fat content – may worsen GERD symptoms." });
    }
  }

  // Gout
  if (conditionMatch(conditions, "gout", "uric acid", "hyperuricemia")) {
    if (ingredientTextContains(product, /liver|kidney|anchov|sardine|herring|mackerel|organ meat|brewer.*yeast|yeast extract/)) {
      risks.push({ severity: "warning", category: "Purine", message: "Contains high-purine ingredients – may trigger gout flares." });
    }
    if (ingredientTextContains(product, /high fructose corn syrup|hfcs|fructose/)) {
      risks.push({ severity: "info", category: "Fructose", message: "Contains fructose – may raise uric acid levels." });
    }
    if (ingredientTextContains(product, /beer|alcohol|wine/)) {
      risks.push({ severity: "warning", category: "Alcohol", message: "Contains alcohol – can trigger gout attacks." });
    }
  }

  // Lactose intolerance
  if (conditionMatch(conditions, "lactose", "lactose intolerant")) {
    if (ingredientTextContains(product, /lactose|milk|cream|whey|milk powder|condensed milk|buttermilk/)) {
      risks.push({ severity: "warning", category: "Lactose", message: "Contains lactose – may cause digestive discomfort." });
    }
  }

  // Fructose intolerance / malabsorption
  if (conditionMatch(conditions, "fructose intoleran", "fructose malabsorption", "hereditary fructose")) {
    if (ingredientTextContains(product, /fructose|high fructose|hfcs|agave|honey|apple juice|pear juice|fruit juice concentrate/)) {
      risks.push({ severity: "warning", category: "Fructose", message: "Contains fructose – avoid with fructose intolerance." });
    }
    if (ingredientTextContains(product, /sorbitol|xylitol|mannitol/)) {
      risks.push({ severity: "warning", category: "Sugar Alcohol", message: "Contains sugar alcohols that convert to fructose – avoid with fructose intolerance." });
    }
  }

  // PKU (Phenylketonuria)
  if (conditionMatch(conditions, "pku", "phenylketonuria")) {
    if (ingredientTextContains(product, /aspartame|phenylalanine|equal|nutrasweet/)) {
      risks.push({ severity: "critical", category: "PKU", message: "Contains aspartame (phenylalanine) – dangerous with PKU." });
    }
    if (protein100 != null && protein100 > 10) {
      risks.push({ severity: "info", category: "PKU", message: "High protein – may need to limit phenylalanine intake with PKU." });
    }
  }

  // Histamine intolerance
  if (conditionMatch(conditions, "histamine", "histamine intoleran")) {
    if (ingredientTextContains(product, /fermented|aged cheese|parmesan|cheddar|wine|vinegar|sauerkraut|kimchi|soy sauce|cured|smoked|salami|pepperoni|anchov|sardine|mackerel|tuna|spinach|tomato|eggplant|avocado|yeast extract|miso/)) {
      risks.push({ severity: "warning", category: "Histamine", message: "May be high in histamine – caution with histamine intolerance." });
    }
  }

  // Thyroid / hypothyroidism
  if (conditionMatch(conditions, "thyroid", "hypothyroid", "hashimoto", "graves")) {
    if (ingredientTextContains(product, /soy|soya|soybean/)) {
      risks.push({ severity: "info", category: "Thyroid", message: "Contains soy – may affect thyroid hormone absorption. Take medication separately." });
    }
  }

  // Crohn's / IBD / ulcerative colitis
  if (conditionMatch(conditions, "crohn", "ibd", "inflammatory bowel", "ulcerative colitis", "colitis")) {
    if (ingredientTextContains(product, /carrageenan|polysorbate|carboxymethylcellulose|cmc|emulsifier/)) {
      risks.push({ severity: "info", category: "IBD", message: "Contains emulsifiers/additives that may worsen IBD symptoms." });
    }
    if (fiber100 != null && fiber100 > 6) {
      risks.push({ severity: "info", category: "IBD", message: "High fiber – may irritate during IBD flares. Consider during remission only." });
    }
    if (ingredientTextContains(product, /artificial sweetener|sucralose|aspartame|saccharin|acesulfame/)) {
      risks.push({ severity: "info", category: "IBD", message: "Contains artificial sweeteners – may affect gut microbiome." });
    }
  }

  // PCOS (Polycystic Ovary Syndrome)
  if (conditionMatch(conditions, "pcos", "polycystic")) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({ severity: "warning", category: "Sugar", message: "High sugar – may worsen insulin resistance with PCOS." });
    }
    if (carbs100 != null && carbs100 > 40) {
      risks.push({ severity: "info", category: "Carbs", message: "High refined carbs – consider lower-carb options for PCOS management." });
    }
  }

  // Fatty liver / NAFLD / liver disease
  if (conditionMatch(conditions, "fatty liver", "nafld", "liver disease", "liver", "hepatitis")) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({ severity: "warning", category: "Sugar", message: "High sugar – excess sugar can worsen fatty liver." });
    }
    if (ingredientTextContains(product, /high fructose corn syrup|hfcs/)) {
      risks.push({ severity: "warning", category: "Fructose", message: "Contains HFCS – linked to fatty liver progression." });
    }
    if (ingredientTextContains(product, /alcohol|wine|beer|spirits/)) {
      risks.push({ severity: "critical", category: "Alcohol", message: "Contains alcohol – avoid with liver disease." });
    }
  }

  // Osteoporosis
  if (conditionMatch(conditions, "osteoporosis", "bone density", "osteopenia")) {
    if (ingredientTextContains(product, /caffeine|coffee|phosphoric acid/)) {
      risks.push({ severity: "info", category: "Bone", message: "Contains caffeine or phosphoric acid – excess may affect calcium absorption." });
    }
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "info", category: "Sodium", message: "High sodium – excess sodium can increase calcium loss." });
    }
  }

  // Anemia / iron deficiency
  if (conditionMatch(conditions, "anemia", "anaemia", "iron deficien")) {
    if (ingredientTextContains(product, /iron|ferrous|ferric/)) {
      risks.push({ severity: "good", category: "Iron", message: "Contains iron – beneficial for anemia management." });
    }
    if (ingredientTextContains(product, /calcium carbonate|tea|coffee|caffeine/)) {
      risks.push({ severity: "info", category: "Iron", message: "Contains calcium/caffeine/tannins – may reduce iron absorption. Separate from iron-rich meals." });
    }
  }

  // Migraine
  if (conditionMatch(conditions, "migraine", "chronic headache")) {
    if (ingredientTextContains(product, /tyramine|aged cheese|msg|monosodium glutamate|nitrate|nitrite|aspartame|caffeine|chocolate|red wine|alcohol/)) {
      risks.push({ severity: "info", category: "Migraine", message: "Contains potential migraine triggers (tyramine, MSG, nitrates, or caffeine)." });
    }
  }

  // Epilepsy (keto-related)
  if (conditionMatch(conditions, "epilepsy", "seizure")) {
    if (carbs100 != null && carbs100 > 20) {
      risks.push({ severity: "info", category: "Carbs", message: "Higher carbs – may not be ideal if following a ketogenic diet for seizure control." });
    }
  }

  // Anxiety
  if (conditionMatch(conditions, "anxiety", "panic disorder", "gad")) {
    if (ingredientTextContains(product, /caffeine|coffee|guarana|taurine/)) {
      risks.push({ severity: "info", category: "Stimulant", message: "Contains caffeine/stimulants – may increase anxiety in sensitive individuals." });
    }
  }

  // Asthma
  if (conditionMatch(conditions, "asthma")) {
    if (ingredientTextContains(product, /sulfite|sulphite|sulfur dioxide|sulphur dioxide|metabisulfi/)) {
      risks.push({ severity: "warning", category: "Sulfite", message: "Contains sulfites – can trigger asthma attacks in sensitive individuals." });
    }
    if (ingredientTextContains(product, /tartrazine|yellow 5|e102|benzoate|e211|e212|e213/)) {
      risks.push({ severity: "info", category: "Additive", message: "Contains additives (tartrazine/benzoates) that may trigger asthma in some people." });
    }
  }

  // Eczema / dermatitis / skin conditions
  if (conditionMatch(conditions, "eczema", "dermatitis", "atopic")) {
    if (ingredientTextContains(product, /artificial color|food dye|red 40|yellow 5|yellow 6|blue 1|tartrazine|sunset yellow|e102|e110|e129|e133|benzoate|e211/)) {
      risks.push({ severity: "info", category: "Skin", message: "Contains artificial colors/preservatives – may worsen eczema in some people." });
    }
  }

  // ADHD
  if (conditionMatch(conditions, "adhd", "attention deficit")) {
    if (ingredientTextContains(product, /artificial color|food dye|red 40|yellow 5|yellow 6|tartrazine|sunset yellow|e102|e110|e129|benzoate|e211/)) {
      risks.push({ severity: "info", category: "ADHD", message: "Contains artificial colors/preservatives – some studies link these to hyperactivity." });
    }
    if (sugar100 != null && sugar100 > 20) {
      risks.push({ severity: "info", category: "Sugar", message: "High sugar – may affect focus and energy stability." });
    }
  }

  // G6PD deficiency (favism)
  if (conditionMatch(conditions, "g6pd", "favism")) {
    if (ingredientTextContains(product, /fava|faba|broad bean|soy|soya|quinine|tonic water|menthol/)) {
      risks.push({ severity: "warning", category: "G6PD", message: "Contains ingredients that may trigger hemolysis with G6PD deficiency." });
    }
  }

  // Phenylketonuria via allergy field (some people list it there)
  if (allergies.some((a) => a.includes("phenylalan") || a.includes("pku"))) {
    if (ingredientTextContains(product, /aspartame|phenylalanine/)) {
      risks.push({ severity: "critical", category: "PKU", message: "Contains phenylalanine (aspartame) – avoid with PKU." });
    }
  }

  // ─── Dietary preferences ─────────────────────────────────

  if (dietary.some((d) => d.includes("vegan")) && productHasDairyOrMeat(product)) {
    risks.push({ severity: "warning", category: "Diet", message: "Not vegan – contains animal-derived ingredients." });
  }
  if (dietary.some((d) => d.includes("vegetarian")) && productHasDairyOrMeat(product)) {
    const text = normalizeForMatch(product.ingredients_text ?? "");
    if (/meat|fish|gelatin|chicken|beef|pork|lamb|turkey|anchov|lard|tallow|rennet/.test(text)) {
      risks.push({ severity: "warning", category: "Diet", message: "Contains meat, fish, or animal-derived ingredients – not vegetarian." });
    }
  }
  if (dietary.some((d) => d.includes("gluten") || d.includes("gluten-free")) && productHasGluten(product)) {
    risks.push({ severity: "warning", category: "Diet", message: "Contains gluten." });
  }
  if (dietary.some((d) => d.includes("halal"))) {
    if (ingredientTextContains(product, /pork|bacon|ham|lard|gelatin|alcohol|wine|beer|rum|whisky|brandy|vodka|liqueur/)) {
      risks.push({ severity: "warning", category: "Diet", message: "May contain non-halal ingredients (pork, alcohol, or gelatin)." });
    }
  }
  if (dietary.some((d) => d.includes("kosher"))) {
    if (ingredientTextContains(product, /pork|bacon|ham|lard|shellfish|shrimp|crab|lobster/)) {
      risks.push({ severity: "warning", category: "Diet", message: "May contain non-kosher ingredients (pork or shellfish)." });
    }
  }
  if (dietary.some((d) => d.includes("dairy-free") || d.includes("dairy free"))) {
    if (ingredientTextContains(product, /milk|cream|butter|whey|casein|caseinate|cheese|lactose|yogurt|ghee/)) {
      risks.push({ severity: "warning", category: "Diet", message: "Contains dairy ingredients." });
    }
  }
  if (dietary.some((d) => d.includes("keto") || d.includes("ketogenic"))) {
    if (carbs100 != null && carbs100 > 10) {
      risks.push({ severity: "info", category: "Diet", message: `High carbs (${Math.round(carbs100)}g/100g) – not keto-friendly.` });
    }
  }
  if (dietary.some((d) => d.includes("paleo"))) {
    if (ingredientTextContains(product, /wheat|grain|corn|rice|oat|soy|legume|bean|lentil|peanut|dairy|milk|cream|cheese|refined sugar|canola|vegetable oil/)) {
      risks.push({ severity: "info", category: "Diet", message: "Contains ingredients not typical in a paleo diet." });
    }
  }
  if (dietary.some((d) => d.includes("whole30") || d.includes("whole 30"))) {
    if (ingredientTextContains(product, /sugar|soy|dairy|milk|grain|wheat|corn|alcohol|legume|bean|peanut|carrageenan|msg|sulfite/)) {
      risks.push({ severity: "info", category: "Diet", message: "Contains ingredients excluded in Whole30." });
    }
  }
  if (dietary.some((d) => d.includes("fodmap") || d.includes("low fodmap"))) {
    if (ingredientTextContains(product, /garlic|onion|wheat|rye|honey|agave|apple|pear|mango|watermelon|milk|cream|lactose|sorbitol|mannitol|xylitol|inulin|chicory|fos|gos/)) {
      risks.push({ severity: "warning", category: "FODMAP", message: "Contains high-FODMAP ingredients – may cause digestive issues." });
    }
  }
  if (dietary.some((d) => d.includes("pescatarian"))) {
    if (ingredientTextContains(product, /chicken|beef|pork|lamb|turkey|veal|venison|bison|bacon|ham|sausage|salami|pepperoni/)) {
      risks.push({ severity: "warning", category: "Diet", message: "Contains meat – not suitable for pescatarian diet." });
    }
  }

  // ─── Medications ──────────────────────────────────────────

  // MAOI – tyramine interaction
  if (medications.some((m) => m.includes("maoi") || m.includes("monoamine"))) {
    if (ingredientTextContains(product, /aged cheese|fermented|soy sauce|tyramine|yeast extract|sauerkraut|miso|kimchi|salami|pepperoni|cured meat|red wine/)) {
      risks.push({ severity: "warning", category: "Medication", message: "May contain tyramine – caution with MAOI medications." });
    }
  }

  // Blood thinners / warfarin – vitamin K interaction
  if (medications.some((m) => m.includes("warfarin") || m.includes("coumadin") || m.includes("blood thinner"))) {
    if (ingredientTextContains(product, /spinach|kale|broccoli|brussels sprout|collard|swiss chard|lettuce|parsley|cilantro|basil|green tea|vitamin k/)) {
      risks.push({ severity: "info", category: "Medication", message: "Rich in vitamin K – keep intake consistent with warfarin. Don't suddenly increase or decrease." });
    }
    if (ingredientTextContains(product, /cranberry|grapefruit|alcohol/)) {
      risks.push({ severity: "warning", category: "Medication", message: "Contains cranberry/grapefruit/alcohol – may interact with warfarin." });
    }
  }

  // Statins – grapefruit interaction
  if (medications.some((m) => m.includes("statin") || m.includes("atorvastatin") || m.includes("simvastatin") || m.includes("lovastatin") || m.includes("lipitor") || m.includes("crestor") || m.includes("zocor"))) {
    if (ingredientTextContains(product, /grapefruit|pomelo/)) {
      risks.push({ severity: "warning", category: "Medication", message: "Contains grapefruit – can dangerously increase statin levels." });
    }
  }

  // ACE inhibitors – potassium interaction
  if (medications.some((m) => m.includes("ace inhibitor") || m.includes("lisinopril") || m.includes("enalapril") || m.includes("ramipril") || m.includes("benazepril"))) {
    if (ingredientTextContains(product, /potassium chloride|potassium|salt substitute|lo salt/)) {
      risks.push({ severity: "warning", category: "Medication", message: "Contains potassium – excess potassium can be dangerous with ACE inhibitors." });
    }
  }

  // Metformin – alcohol interaction
  if (medications.some((m) => m.includes("metformin") || m.includes("glucophage"))) {
    if (ingredientTextContains(product, /alcohol|ethanol|wine|beer|spirits/)) {
      risks.push({ severity: "warning", category: "Medication", message: "Contains alcohol – increases lactic acidosis risk with metformin." });
    }
  }

  // Thyroid medication – absorption interference
  if (medications.some((m) => m.includes("levothyroxine") || m.includes("synthroid") || m.includes("thyroid"))) {
    if (ingredientTextContains(product, /soy|soya|calcium carbonate|iron|fiber|walnut|cottonseed/)) {
      risks.push({ severity: "info", category: "Medication", message: "Contains soy/calcium/iron/fiber – may interfere with thyroid medication absorption. Take medication 30–60 min before eating." });
    }
  }

  // Lithium – sodium/caffeine interaction
  if (medications.some((m) => m.includes("lithium"))) {
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "info", category: "Medication", message: "High sodium – sudden changes in sodium intake can affect lithium levels." });
    }
    if (ingredientTextContains(product, /caffeine|coffee|tea|guarana/)) {
      risks.push({ severity: "info", category: "Medication", message: "Contains caffeine – may affect lithium levels." });
    }
  }

  // Antibiotics (tetracycline/fluoroquinolone) – dairy/calcium interaction
  if (medications.some((m) => m.includes("antibiotic") || m.includes("tetracycline") || m.includes("doxycycline") || m.includes("ciprofloxacin") || m.includes("cipro") || m.includes("levofloxacin"))) {
    if (ingredientTextContains(product, /milk|cream|cheese|calcium|yogurt|iron|magnesium|aluminum/)) {
      risks.push({ severity: "info", category: "Medication", message: "Dairy/calcium/minerals can reduce antibiotic absorption. Take 2 hours apart." });
    }
  }

  // Diuretics – potassium interaction
  if (medications.some((m) => m.includes("diuretic") || m.includes("furosemide") || m.includes("lasix") || m.includes("hydrochlorothiazide") || m.includes("hctz"))) {
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "info", category: "Medication", message: "High sodium – may counteract diuretic effectiveness." });
    }
  }

  // Immunosuppressants – grapefruit
  if (medications.some((m) => m.includes("cyclosporine") || m.includes("tacrolimus") || m.includes("immunosuppressant"))) {
    if (ingredientTextContains(product, /grapefruit|pomelo/)) {
      risks.push({ severity: "warning", category: "Medication", message: "Grapefruit can increase immunosuppressant drug levels – avoid." });
    }
  }

  // ─── Goals ────────────────────────────────────────────────

  if (goals.some((g) => g.includes("weight loss") || g.includes("lose weight") || g.includes("fat loss"))) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({ severity: "info", category: "Goal", message: "High in sugar – consider moderating for weight loss." });
    }
    if (kcal100 != null && kcal100 > HIGH_CALORIES_PER_100G_KCAL) {
      risks.push({ severity: "info", category: "Goal", message: "High in calories per 100 g – consider portion size for weight loss." });
    }
  }

  if (goals.some((g) => g.includes("muscle") || g.includes("protein") || g.includes("bulk") || g.includes("gain"))) {
    if (protein100 != null && protein100 >= GOOD_PROTEIN_PER_100G_G) {
      risks.push({ severity: "good", category: "Goal", message: `Good source of protein (${protein100}g per 100g) for muscle gain.` });
    }
    if (protein100 != null && protein100 < 5) {
      risks.push({ severity: "info", category: "Goal", message: "Low protein – not ideal for muscle-building goals." });
    }
  }

  if (goals.some((g) => g.includes("blood sugar") || g.includes("sugar control") || g.includes("glycemic"))) {
    if (sugar100 != null && sugar100 > HIGH_SUGAR_PER_100G_G) {
      risks.push({ severity: "warning", category: "Goal", message: "High in sugar – consider limiting for blood sugar control." });
    }
  }

  if (goals.some((g) => g.includes("heart health") || g.includes("cardiovascular"))) {
    if (satFat100 != null && satFat100 > HIGH_SAT_FAT_PER_100G_G) {
      risks.push({ severity: "info", category: "Goal", message: "High saturated fat – consider limiting for heart health." });
    }
    if (sodiumMg100 != null && sodiumMg100 > HIGH_SODIUM_PER_100G_MG) {
      risks.push({ severity: "info", category: "Goal", message: "High sodium – consider limiting for heart health." });
    }
    if (fiber100 != null && fiber100 >= GOOD_FIBER_PER_100G_G) {
      risks.push({ severity: "good", category: "Goal", message: `Good fiber (${Math.round(fiber100)}g/100g) – supports heart health.` });
    }
  }

  if (goals.some((g) => g.includes("gut health") || g.includes("digestion") || g.includes("digestive"))) {
    if (fiber100 != null && fiber100 >= GOOD_FIBER_PER_100G_G) {
      risks.push({ severity: "good", category: "Goal", message: `Good fiber (${Math.round(fiber100)}g/100g) – supports gut health.` });
    }
    if (ingredientTextContains(product, /probiotic|lactobacillus|bifidobacterium|fermented/)) {
      risks.push({ severity: "good", category: "Goal", message: "Contains probiotics/fermented ingredients – supports gut microbiome." });
    }
    if (ingredientTextContains(product, /carrageenan|polysorbate|artificial sweetener|sucralose|aspartame/)) {
      risks.push({ severity: "info", category: "Goal", message: "Contains additives that may affect gut microbiome." });
    }
  }

  if (goals.some((g) => g.includes("anti-inflam") || g.includes("inflammation") || g.includes("anti inflam"))) {
    if (ingredientTextContains(product, /turmeric|curcumin|ginger|omega.3|fish oil|flaxseed|chia/)) {
      risks.push({ severity: "good", category: "Goal", message: "Contains anti-inflammatory ingredients." });
    }
    if (sugar100 != null && sugar100 > 20) {
      risks.push({ severity: "info", category: "Goal", message: "High sugar – excess sugar can increase inflammation." });
    }
    if (ingredientTextContains(product, /trans fat|partially hydrogenated|vegetable oil|canola|soybean oil|corn oil/)) {
      risks.push({ severity: "info", category: "Goal", message: "Contains oils/fats that may promote inflammation." });
    }
  }

  if (goals.some((g) => g.includes("low carb") || g.includes("reduce carb"))) {
    if (carbs100 != null && carbs100 > 20) {
      risks.push({ severity: "info", category: "Goal", message: `Contains ${Math.round(carbs100)}g carbs/100g – consider lower-carb options.` });
    }
  }

  if (goals.some((g) => g.includes("reduce sodium") || g.includes("low sodium") || g.includes("less salt"))) {
    if (sodiumMg100 != null && sodiumMg100 > 120) {
      risks.push({ severity: "info", category: "Goal", message: `Sodium: ${Math.round(sodiumMg100)}mg/100g – look for lower-sodium alternatives.` });
    }
  }

  if (goals.some((g) => g.includes("energy") || g.includes("stamina") || g.includes("endurance"))) {
    if (carbs100 != null && carbs100 >= 30 && sugar100 != null && sugar100 < 10) {
      risks.push({ severity: "good", category: "Goal", message: "Good complex carbs with low sugar – sustained energy source." });
    }
  }

  if (goals.some((g) => g.includes("bone") || g.includes("calcium") || g.includes("bone health"))) {
    if (ingredientTextContains(product, /calcium|vitamin d|vitamin k|magnesium/)) {
      risks.push({ severity: "good", category: "Goal", message: "Contains nutrients that support bone health." });
    }
  }

  if (goals.some((g) => g.includes("skin") || g.includes("skin health") || g.includes("clear skin"))) {
    if (sugar100 != null && sugar100 > 20) {
      risks.push({ severity: "info", category: "Goal", message: "High sugar – excess sugar is linked to skin breakouts." });
    }
    if (ingredientTextContains(product, /vitamin c|vitamin e|zinc|omega.3|collagen/)) {
      risks.push({ severity: "good", category: "Goal", message: "Contains nutrients that support skin health." });
    }
  }

  return risks;
}
