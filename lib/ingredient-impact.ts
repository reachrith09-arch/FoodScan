import type { HealthProfile } from "@/types/food";

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function conditionMatch(conditions: string[], ...terms: string[]): boolean {
  return conditions.some((c) => terms.some((t) => c.includes(t)));
}

const ALLERGY_TERMS: Record<string, string[]> = {
  nuts: ["nut", "almond", "hazelnut", "walnut", "cashew", "pistachio", "pecan", "macadamia", "brazil nut"],
  peanut: ["peanut", "groundnut", "arachis"],
  dairy: ["milk", "cream", "whey", "cheese", "butter", "lactose", "casein", "caseinate", "yogurt", "ghee"],
  gluten: ["wheat", "gluten", "barley", "rye", "spelt", "kamut", "triticale"],
  wheat: ["wheat", "flour", "semolina", "durum", "spelt", "kamut", "farina"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "shellfish"],
  fish: ["fish", "anchov", "sardine", "tuna", "salmon", "cod", "tilapia", "pollock", "mackerel", "herring"],
  soy: ["soy", "soya", "soybean", "tofu", "edamame", "tempeh"],
  eggs: ["egg", "albumin", "lysozyme", "mayonnaise", "egg white", "egg yolk"],
  sesame: ["sesame", "tahini"],
  mustard: ["mustard"],
  celery: ["celery", "celeriac"],
  lupin: ["lupin", "lupine", "lupini"],
  sulfite: ["sulfite", "sulphite", "sulfur dioxide", "sulphur dioxide", "metabisulfi", "so2"],
  corn: ["corn", "maize", "cornstarch", "corn syrup", "dextrose", "maltodextrin"],
  coconut: ["coconut", "copra"],
  mollusc: ["mollusc", "mollusk", "squid", "octopus", "clam", "mussel", "oyster", "scallop"],
};

export function getIngredientImpactForUser(
  ingredientRaw: string,
  profile: HealthProfile | null,
): string | null {
  if (!profile) return null;
  const ing = normalizeForMatch(ingredientRaw);

  // ─── Allergies ────────────────────────────────────────────
  for (const allergy of profile.allergies) {
    const a = normalizeForMatch(allergy);
    if (!a) continue;
    if (ing.includes(a)) return `Avoid: you're allergic to ${allergy}.`;
    for (const [key, terms] of Object.entries(ALLERGY_TERMS)) {
      if (!a.includes(key)) continue;
      if (terms.some((t) => ing.includes(t))) return `Avoid: you're allergic to ${allergy}.`;
    }
  }

  // ─── Conditions ───────────────────────────────────────────
  const conditions = profile.conditions.map(normalizeForMatch);

  if (conditionMatch(conditions, "hypertension", "blood pressure", "high bp") && /sodium|salt|\bna\b/i.test(ing)) {
    return "Watch: sodium may affect blood pressure.";
  }

  if (conditionMatch(conditions, "diabetes", "diabetic", "blood sugar", "type 1", "type 2", "t1d", "t2d") &&
      /sugar|glucose|fructose|sucrose|honey|syrup|dextrose|maltose|agave/i.test(ing)) {
    return "Watch: may affect blood sugar levels.";
  }

  if (conditionMatch(conditions, "celiac", "coeliac") && /wheat|gluten|barley|rye|spelt|kamut/i.test(ing)) {
    return "Contains gluten – avoid with celiac disease.";
  }

  if (conditionMatch(conditions, "kidney", "renal", "ckd")) {
    if (/sodium|salt|\bna\b/i.test(ing)) return "Watch: sodium – limit with kidney disease.";
    if (/potassium|phosph/i.test(ing)) return "Watch: may need to limit potassium/phosphorus with kidney disease.";
  }

  if (conditionMatch(conditions, "heart", "cardiovascular", "cvd", "coronary") && /trans fat|partially hydrogenated/i.test(ing)) {
    return "Contains trans fats – avoid for heart health.";
  }

  if (conditionMatch(conditions, "cholesterol", "hypercholesterol", "hyperlipid") && /trans fat|partially hydrogenated/i.test(ing)) {
    return "Trans fats can raise LDL cholesterol – avoid.";
  }

  if (conditionMatch(conditions, "ibs", "irritable bowel")) {
    if (/sorbitol|mannitol|xylitol|maltitol|isomalt|lactitol|erythritol|inulin|chicory|fructooligosaccharide|fos/i.test(ing))
      return "Sugar alcohol/FODMAP – may trigger IBS symptoms.";
    if (/garlic|onion|wheat|rye|honey|high fructose|agave/i.test(ing))
      return "High-FODMAP ingredient – may worsen IBS.";
    if (/lactose|milk powder/i.test(ing))
      return "Lactose – a common IBS trigger.";
  }

  if (conditionMatch(conditions, "gerd", "acid reflux", "reflux", "heartburn")) {
    if (/caffeine|coffee|chocolate|cocoa|mint|peppermint|citric acid|tomato|vinegar|chili|capsaicin|hot pepper/i.test(ing))
      return "May trigger acid reflux.";
  }

  if (conditionMatch(conditions, "gout", "uric acid", "hyperuricemia")) {
    if (/liver|kidney|anchov|sardine|herring|mackerel|organ meat|yeast extract/i.test(ing))
      return "High in purines – may trigger gout flares.";
    if (/high fructose corn syrup|hfcs/i.test(ing))
      return "HFCS may raise uric acid – caution with gout.";
  }

  if (conditionMatch(conditions, "lactose", "lactose intolerant")) {
    if (/lactose|milk|cream|whey|milk powder|condensed milk|buttermilk/i.test(ing))
      return "Contains lactose – may cause digestive discomfort.";
  }

  if (conditionMatch(conditions, "fructose intoleran", "fructose malabsorption", "hereditary fructose")) {
    if (/fructose|high fructose|hfcs|agave|honey|apple juice|pear juice/i.test(ing))
      return "Contains fructose – avoid with fructose intolerance.";
    if (/sorbitol|xylitol|mannitol/i.test(ing))
      return "Sugar alcohol converts to fructose – avoid.";
  }

  if (conditionMatch(conditions, "pku", "phenylketonuria")) {
    if (/aspartame|phenylalanine/i.test(ing))
      return "Contains phenylalanine – dangerous with PKU.";
  }

  if (conditionMatch(conditions, "histamine", "histamine intoleran")) {
    if (/fermented|aged cheese|parmesan|cheddar|wine|vinegar|sauerkraut|kimchi|soy sauce|cured|smoked|salami|anchov|sardine|tuna|yeast extract|miso/i.test(ing))
      return "May be high in histamine – caution.";
  }

  if (conditionMatch(conditions, "thyroid", "hypothyroid", "hashimoto", "graves")) {
    if (/soy|soya|soybean/i.test(ing))
      return "Soy may affect thyroid hormone absorption.";
  }

  if (conditionMatch(conditions, "crohn", "ibd", "inflammatory bowel", "ulcerative colitis", "colitis")) {
    if (/carrageenan|polysorbate|carboxymethylcellulose|cmc/i.test(ing))
      return "Emulsifier/additive – may worsen IBD symptoms.";
    if (/artificial sweetener|sucralose|aspartame|saccharin|acesulfame/i.test(ing))
      return "Artificial sweetener – may affect gut microbiome.";
  }

  if (conditionMatch(conditions, "pcos", "polycystic")) {
    if (/sugar|glucose|fructose|sucrose|honey|syrup|dextrose/i.test(ing))
      return "Added sugar – may worsen insulin resistance with PCOS.";
  }

  if (conditionMatch(conditions, "fatty liver", "nafld", "liver")) {
    if (/high fructose corn syrup|hfcs/i.test(ing))
      return "HFCS – linked to fatty liver progression.";
    if (/alcohol|ethanol|wine|beer/i.test(ing))
      return "Alcohol – avoid with liver disease.";
  }

  if (conditionMatch(conditions, "asthma")) {
    if (/sulfite|sulphite|sulfur dioxide|metabisulfi/i.test(ing))
      return "Sulfites – can trigger asthma attacks.";
    if (/tartrazine|yellow 5|e102|benzoate|e211/i.test(ing))
      return "May trigger asthma in sensitive individuals.";
  }

  if (conditionMatch(conditions, "migraine", "chronic headache")) {
    if (/tyramine|aged cheese|msg|monosodium glutamate|nitrate|nitrite|aspartame/i.test(ing))
      return "Potential migraine trigger.";
  }

  if (conditionMatch(conditions, "g6pd", "favism")) {
    if (/fava|faba|broad bean|quinine|tonic water|menthol/i.test(ing))
      return "May trigger hemolysis with G6PD deficiency.";
  }

  if (conditionMatch(conditions, "osteoporosis", "osteopenia", "bone density")) {
    if (/phosphoric acid/i.test(ing))
      return "Phosphoric acid may affect calcium absorption.";
  }

  if (conditionMatch(conditions, "eczema", "dermatitis", "atopic")) {
    if (/artificial color|food dye|red 40|yellow 5|yellow 6|tartrazine|sunset yellow|e102|e110|e129|benzoate|e211/i.test(ing))
      return "Artificial color/preservative – may worsen eczema.";
  }

  if (conditionMatch(conditions, "adhd", "attention deficit")) {
    if (/artificial color|food dye|red 40|yellow 5|yellow 6|tartrazine|sunset yellow|e102|e110|e129|benzoate|e211/i.test(ing))
      return "Artificial color/preservative – some studies link to hyperactivity.";
  }

  // ─── Medications ──────────────────────────────────────────
  const medications = (profile.medications ?? []).map(normalizeForMatch);

  if (medications.some((m) => m.includes("maoi") || m.includes("monoamine"))) {
    if (/aged cheese|fermented|soy sauce|tyramine|yeast extract|sauerkraut|miso|kimchi|salami|cured meat/i.test(ing))
      return "Tyramine-rich – caution with MAOI medications.";
  }

  if (medications.some((m) => m.includes("warfarin") || m.includes("coumadin") || m.includes("blood thinner"))) {
    if (/spinach|kale|broccoli|brussels sprout|collard|swiss chard|lettuce|parsley|cilantro|basil|vitamin k/i.test(ing))
      return "Rich in vitamin K – keep consistent with warfarin.";
    if (/cranberry|grapefruit/i.test(ing))
      return "May interact with warfarin – use caution.";
  }

  if (medications.some((m) => m.includes("statin") || m.includes("atorvastatin") || m.includes("simvastatin") || m.includes("lovastatin") || m.includes("lipitor") || m.includes("crestor"))) {
    if (/grapefruit|pomelo/i.test(ing))
      return "Grapefruit increases statin levels – avoid.";
  }

  if (medications.some((m) => m.includes("ace inhibitor") || m.includes("lisinopril") || m.includes("enalapril") || m.includes("ramipril"))) {
    if (/potassium chloride|potassium|salt substitute/i.test(ing))
      return "Excess potassium – dangerous with ACE inhibitors.";
  }

  if (medications.some((m) => m.includes("metformin") || m.includes("glucophage"))) {
    if (/alcohol|ethanol|wine|beer/i.test(ing))
      return "Alcohol increases lactic acidosis risk with metformin.";
  }

  if (medications.some((m) => m.includes("levothyroxine") || m.includes("synthroid") || m.includes("thyroid"))) {
    if (/soy|soya|calcium carbonate|iron|walnut/i.test(ing))
      return "May interfere with thyroid medication absorption.";
  }

  if (medications.some((m) => m.includes("lithium"))) {
    if (/caffeine|coffee|guarana/i.test(ing))
      return "Caffeine may affect lithium levels.";
  }

  if (medications.some((m) => m.includes("antibiotic") || m.includes("tetracycline") || m.includes("doxycycline") || m.includes("ciprofloxacin") || m.includes("cipro"))) {
    if (/milk|cream|cheese|calcium|yogurt|iron|magnesium/i.test(ing))
      return "Dairy/minerals reduce antibiotic absorption – take 2 hours apart.";
  }

  if (medications.some((m) => m.includes("cyclosporine") || m.includes("tacrolimus") || m.includes("immunosuppressant"))) {
    if (/grapefruit|pomelo/i.test(ing))
      return "Grapefruit increases immunosuppressant levels – avoid.";
  }

  // ─── Dietary preferences ──────────────────────────────────
  const dietary = profile.dietaryPreferences.map(normalizeForMatch);

  if (dietary.some((d) => d.includes("vegan"))) {
    if (/milk|cream|whey|cheese|butter|gelatin|honey|egg|fish|meat|casein|caseinate|lard|tallow|anchov|rennet/i.test(ing))
      return "Not vegan – animal-derived ingredient.";
  }
  if (dietary.some((d) => d.includes("vegetarian"))) {
    if (/meat|fish|gelatin|chicken|beef|pork|lamb|turkey|anchov|lard|tallow|rennet/i.test(ing))
      return "Not vegetarian – animal-derived ingredient.";
  }
  if (dietary.some((d) => d.includes("gluten") || d.includes("gluten-free"))) {
    if (/wheat|barley|rye|gluten|spelt|kamut|triticale/i.test(ing)) return "Contains gluten.";
  }
  if (dietary.some((d) => d.includes("dairy-free") || d.includes("dairy free"))) {
    if (/milk|cream|butter|whey|casein|caseinate|cheese|lactose|yogurt|ghee/i.test(ing))
      return "Contains dairy.";
  }
  if (dietary.some((d) => d.includes("halal"))) {
    if (/pork|bacon|ham|lard|gelatin|alcohol|wine|beer|rum/i.test(ing))
      return "May not be halal.";
  }
  if (dietary.some((d) => d.includes("kosher"))) {
    if (/pork|bacon|ham|lard|shellfish|shrimp|crab|lobster/i.test(ing))
      return "May not be kosher.";
  }
  if (dietary.some((d) => d.includes("fodmap") || d.includes("low fodmap"))) {
    if (/garlic|onion|wheat|rye|honey|agave|apple|pear|mango|watermelon|milk|cream|lactose|sorbitol|mannitol|xylitol|inulin|chicory|fos|gos/i.test(ing))
      return "High-FODMAP ingredient.";
  }
  if (dietary.some((d) => d.includes("paleo"))) {
    if (/wheat|grain|corn|rice|oat|soy|legume|bean|lentil|peanut|dairy|milk|cream|cheese|refined sugar|canola|vegetable oil/i.test(ing))
      return "Not typical in a paleo diet.";
  }
  if (dietary.some((d) => d.includes("pescatarian"))) {
    if (/chicken|beef|pork|lamb|turkey|veal|venison|bacon|ham|sausage|salami|pepperoni/i.test(ing))
      return "Contains meat – not pescatarian.";
  }

  return null;
}
