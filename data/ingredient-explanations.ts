import type { IngredientDetail } from "@/types/food";

/**
 * Curated explanations for common additives and complex ingredients.
 * Keys are normalized (lowercase, trimmed) for lookup.
 */
export const INGREDIENT_EXPLANATIONS: Record<string, Omit<IngredientDetail, "name">> = {
  "e322": {
    plainDescription: "Lecithin – an emulsifier that helps mix oil and water.",
    typicalUse: "Common in chocolate, margarine, baked goods, and dressings.",
    healthConsideration: "Generally recognized as safe. Often from soy; some people prefer to avoid if allergic.",
  },
  "lecithin": {
    plainDescription: "Emulsifier that keeps fats and water blended.",
    typicalUse: "Found in chocolate, spreads, and processed foods.",
    healthConsideration: "Generally safe. Can be derived from soy or eggs; check if you have allergies.",
  },
  "soya lecithin": {
    plainDescription: "Lecithin derived from soybeans; emulsifier.",
    typicalUse: "Common in chocolate and packaged foods.",
    healthConsideration: "Avoid if you have a soy allergy.",
  },
  "e322i": {
    plainDescription: "Soy lecithin – same as E322 when from soy.",
    typicalUse: "Used in chocolate, spreads, and baked goods.",
    healthConsideration: "Avoid if allergic to soy.",
  },
  "e322ii": {
    plainDescription: "Lecithin from other sources (e.g. sunflower).",
    typicalUse: "Alternative to soy lecithin in many products.",
    healthConsideration: "Generally recognized as safe.",
  },
  "vanillin": {
    plainDescription: "Vanilla flavoring; can be natural or synthetic.",
    typicalUse: "Used in sweets, baked goods, and beverages.",
    healthConsideration: "Generally safe. Synthetic vanillin is widely used.",
  },
  "e320": {
    plainDescription: "BHA (butylated hydroxyanisole) – antioxidant preservative.",
    typicalUse: "Used to prevent fats and oils from going rancid.",
    healthConsideration: "Some studies suggest limiting intake; permitted in small amounts in many countries.",
  },
  "e321": {
    plainDescription: "BHT (butylated hydroxytoluene) – antioxidant preservative.",
    typicalUse: "Prevents oxidation in fats, cereals, and packaged snacks.",
    healthConsideration: "Generally considered safe at permitted levels; some prefer to avoid.",
  },
  "e330": {
    plainDescription: "Citric acid – natural acid from citrus or fermented sugar.",
    typicalUse: "Flavor, preservative, and pH adjuster in drinks and foods.",
    healthConsideration: "Generally recognized as safe and very common.",
  },
  "citric acid": {
    plainDescription: "Natural acid that adds tartness and helps preserve food.",
    typicalUse: "Beverages, jams, canned goods, and many processed foods.",
    healthConsideration: "Widely considered safe.",
  },
  "e415": {
    plainDescription: "Xanthan gum – thickening and stabilizing agent.",
    typicalUse: "Sauces, dressings, gluten-free baked goods, and ice cream.",
    healthConsideration: "Generally safe. Can cause digestive sensitivity in large amounts.",
  },
  "xanthan gum": {
    plainDescription: "Thickener and stabilizer made by fermenting sugar.",
    typicalUse: "Gluten-free products, dressings, and syrups.",
    healthConsideration: "Generally safe; some people may experience mild digestive effects.",
  },
  "gellan gum": {
    plainDescription: "Gelling and thickening agent produced by fermenting sugar with bacteria.",
    typicalUse: "Dairy alternatives, jams, desserts, and beverages to improve texture.",
    healthConsideration: "Generally recognized as safe. Used in small amounts; may cause mild digestive effects in sensitive individuals.",
  },
  "carrageenan": {
    plainDescription: "Extract from seaweed used as a thickener and stabilizer.",
    typicalUse: "Dairy products, plant milks, and processed foods.",
    healthConsideration: "Generally considered safe; some prefer to avoid it due to digestive sensitivity.",
  },
  "e202": {
    plainDescription: "Potassium sorbate – preservative that inhibits mold and yeast.",
    typicalUse: "Cheese, wine, dried fruit, and many packaged foods.",
    healthConsideration: "Generally recognized as safe at permitted levels.",
  },
  "potassium sorbate": {
    plainDescription: "Preservative that helps prevent mold and yeast growth.",
    typicalUse: "Common in cheese, wine, and packaged foods.",
    healthConsideration: "Considered safe in regulated amounts.",
  },
  "e211": {
    plainDescription: "Sodium benzoate – preservative against bacteria and fungi.",
    typicalUse: "Soft drinks, condiments, and acidic foods.",
    healthConsideration: "Generally safe. In combination with vitamin C, small amounts of benzene can form; levels are regulated.",
  },
  "sodium benzoate": {
    plainDescription: "Preservative used to extend shelf life of acidic products.",
    typicalUse: "Sodas, dressings, and pickled foods.",
    healthConsideration: "Considered safe at allowed concentrations.",
  },
  "e500": {
    plainDescription: "Sodium carbonates (e.g. baking soda) – leavening and pH regulator.",
    typicalUse: "Baked goods, some beverages, and processed foods.",
    healthConsideration: "Generally safe. High intake can affect sodium balance.",
  },
  "sodium bicarbonate": {
    plainDescription: "Baking soda – used for leavening and as an antacid.",
    typicalUse: "Baking, some beverages, and antacid products.",
    healthConsideration: "Generally safe in food use.",
  },
  "potassium phosphate": {
    plainDescription: "A mineral salt used to regulate acidity, improve texture, and prevent separation in liquids.",
    typicalUse: "Dairy alternatives, processed cheese, beverages, and canned foods.",
    healthConsideration: "Generally recognized as safe at permitted levels. Used in small amounts; people on potassium-restricted diets may want to check labels.",
  },
  "potassium carbonate": {
    plainDescription: "A mineral salt used to adjust acidity and improve texture, especially in cocoa and some beverages.",
    typicalUse: "Cocoa products, wine, and some processed foods.",
    healthConsideration: "Generally safe at food-use levels; regulated as a food additive.",
  },
  "natural flavors": {
    plainDescription: "Flavourings derived from natural sources (plants, animals, or fermentation) rather than synthetic.",
    typicalUse: "Widely used to give a specific taste; the exact source is often not listed.",
    healthConsideration: "Generally considered safe. If you avoid certain allergens, check with the manufacturer as “natural flavour” can come from various sources.",
  },
  "skim milk": {
    plainDescription: "Milk with most of the fat removed; adds protein and calcium with fewer calories than whole milk.",
    typicalUse: "Beverages, baked goods, and many processed foods.",
    healthConsideration: "Generally nutritious. Avoid if you have a dairy allergy or lactose intolerance.",
  },
  "whole milk": {
    plainDescription: "Milk that keeps its natural fat content; adds creaminess, protein, and calcium.",
    typicalUse: "Drinks, desserts, and processed foods.",
    healthConsideration: "Nutritious but higher in saturated fat than skim or low-fat milk. Avoid if you have a dairy allergy.",
  },
  "milk": {
    plainDescription: "Dairy liquid that adds protein, calcium, and texture.",
    typicalUse: "Widely used in drinks, baked goods, and processed foods.",
    healthConsideration: "Generally nutritious. Check the label if you avoid dairy or have an allergy.",
  },
  "cream": {
    plainDescription: "High-fat dairy product that adds richness and texture.",
    typicalUse: "Coffee, desserts, sauces, and many packaged foods.",
    healthConsideration: "Higher in saturated fat. Avoid if you have a dairy allergy.",
  },
  "cane sugar": {
    plainDescription: "Sugar made from sugar cane; same as sucrose, used for sweetness.",
    typicalUse: "Beverages, baked goods, and many processed foods.",
    healthConsideration: "Like other added sugars, best in moderation; check the amount per serving if you're limiting sugar.",
  },
  "coffee": {
    plainDescription: "Roasted coffee beans or extract; adds flavour and caffeine.",
    typicalUse: "Drinks, desserts, and flavoured foods.",
    healthConsideration: "Generally safe. Check the label for caffeine content if you're limiting it.",
  },
  "cocoa butter": {
    plainDescription: "Fat from cocoa beans; gives chocolate its smooth texture and melt.",
    typicalUse: "Chocolate, confectionery, and some baked goods.",
    healthConsideration: "Generally safe. High in saturated fat; fine in normal amounts as part of chocolate or treats.",
  },
  "emulsifier": {
    plainDescription: "Substance that helps mix oil and water so they don't separate.",
    typicalUse: "Common in chocolate, ice cream, margarine, and dressings.",
    healthConsideration: "Many emulsifiers are well tolerated; specific type may matter for allergies.",
  },
  "emulsifiers": {
    plainDescription: "Ingredients that keep fats and water blended in food.",
    typicalUse: "Used in many processed and packaged foods.",
    healthConsideration: "Generally safe; check for allergen sources (e.g. soy, egg).",
  },
  "palm oil": {
    plainDescription: "Vegetable oil from the fruit of oil palm trees.",
    typicalUse: "Spreads, snacks, baked goods, and many packaged foods.",
    healthConsideration: "High in saturated fat. Sourcing can raise environmental concerns.",
  },
  "canola oil": {
    plainDescription: "Oil from canola (rapeseed) seeds; low in saturated fat, high in unsaturated fats.",
    typicalUse: "Cooking, dressings, baked goods, and many packaged foods.",
    healthConsideration: "Generally considered a heart-healthy oil when used in moderation.",
  },
  "rapeseed oil": {
    plainDescription: "Oil from rapeseed (canola); same as canola oil in many markets.",
    typicalUse: "Cooking, dressings, and processed foods.",
    healthConsideration: "Generally safe; canola is a type of low-erucic-acid rapeseed.",
  },
  "glucose syrup": {
    plainDescription: "Sweetener made from starch (often corn or wheat).",
    typicalUse: "Candy, ice cream, and processed foods for sweetness and texture.",
    healthConsideration: "Rapidly absorbed; people with diabetes should account for it. May contain gluten if from wheat.",
  },
  "high fructose corn syrup": {
    plainDescription: "Sweetener made from corn starch; contains fructose and glucose.",
    typicalUse: "Soft drinks, sweets, and many processed foods in some regions.",
    healthConsideration: "Excess intake is linked to weight gain and metabolic concerns; moderate use.",
  },
  "modified starch": {
    plainDescription: "Starch treated to improve texture or stability in food.",
    typicalUse: "Sauces, soups, and many packaged products.",
    healthConsideration: "Generally considered safe. Source (e.g. wheat) may matter for allergies.",
  },
  "ascorbic acid": {
    plainDescription: "Vitamin C – used as antioxidant and acidity regulator.",
    typicalUse: "Bread, drinks, and processed foods to prevent browning and extend shelf life.",
    healthConsideration: "Safe and essential vitamin; added form is well tolerated.",
  },
  "e300": {
    plainDescription: "Ascorbic acid (vitamin C) – antioxidant and preservative.",
    typicalUse: "Widely used in beverages, baked goods, and preserved foods.",
    healthConsideration: "Generally safe and beneficial in normal amounts.",
  },
  "monosodium glutamate": {
    plainDescription: "MSG – flavor enhancer that adds umami taste.",
    typicalUse: "Savoury snacks, soups, and restaurant foods.",
    healthConsideration: "Generally recognized as safe. Some people report sensitivity; evidence is mixed.",
  },
  "msg": {
    plainDescription: "Monosodium glutamate – flavor enhancer.",
    typicalUse: "Savoury and processed foods.",
    healthConsideration: "Considered safe by major health bodies; some individuals prefer to limit it.",
  },
  "e621": {
    plainDescription: "Monosodium glutamate (MSG) – flavor enhancer.",
    typicalUse: "Savoury snacks, soups, and prepared foods.",
    healthConsideration: "Generally recognized as safe; some people choose to avoid it.",
  },
  "sodium": {
    plainDescription: "Sodium (salt) – essential mineral and preservative.",
    typicalUse: "Present in most processed and packaged foods.",
    healthConsideration: "Needed in small amounts; excess is linked to high blood pressure. Check labels if limiting salt.",
  },
  "salt": {
    plainDescription: "Sodium chloride – seasoning and preservative.",
    typicalUse: "Virtually all categories of food.",
    healthConsideration: "Excess intake can raise blood pressure; moderate use recommended.",
  },
  "disaccharide": {
    plainDescription: "A type of sugar made of two simple sugars (e.g. sucrose, lactose).",
    typicalUse: "Often listed when sugar is broken down into types; common in sweetened drinks and foods.",
    healthConsideration: "Counts as sugar/carbs. People limiting sugar or managing blood sugar should account for it.",
  },
  "colour": {
    plainDescription: "Food colouring added to give a specific look.",
    typicalUse: "Soft drinks, sweets, snacks, and many processed foods.",
    healthConsideration: "Permitted colours are generally considered safe at allowed levels; some people prefer to avoid certain ones.",
  },
  "color": {
    plainDescription: "Food colouring added to give a specific look.",
    typicalUse: "Soft drinks, sweets, snacks, and many processed foods.",
    healthConsideration: "Permitted colours are generally considered safe at allowed levels.",
  },
  "e150d": {
    plainDescription: "Caramel colour (ammonia sulphite process) – gives brown colour to colas and other drinks.",
    typicalUse: "Cola, dark soft drinks, sauces, and some baked goods.",
    healthConsideration: "Permitted in many countries. Some studies on high intake; normal consumption is generally considered safe.",
  },
  "e338": {
    plainDescription: "Phosphoric acid – adds tartness and acts as a preservative.",
    typicalUse: "Colas and other acidic soft drinks.",
    healthConsideration: "In large amounts can affect tooth enamel and bone; typical drink amounts are within permitted levels.",
  },
  "phosphoric acid": {
    plainDescription: "Acid that adds tartness and helps preserve drinks.",
    typicalUse: "Common in colas and other carbonated beverages.",
    healthConsideration: "Moderate consumption is generally considered safe; excess may affect teeth and mineral balance.",
  },
  "acid": {
    plainDescription: "Acidity regulator or flavour – makes food/drink taste sharper or less sweet.",
    typicalUse: "Soft drinks, jams, dressings, and many processed foods.",
    healthConsideration: "Common food acids (e.g. citric, phosphoric) are generally safe at normal levels.",
  },
  "natural flavouring": {
    plainDescription: "Flavour from natural sources (e.g. plants, spices), not synthetic.",
    typicalUse: "Widely used in drinks, snacks, and processed foods.",
    healthConsideration: "Generally safe; exact source may matter for allergies.",
  },
  "flavouring": {
    plainDescription: "Added flavour – can be natural or synthetic.",
    typicalUse: "Soft drinks, sweets, snacks, and many packaged foods.",
    healthConsideration: "Permitted flavourings are considered safe at normal use.",
  },
  "flavoring": {
    plainDescription: "Added flavour – can be natural or synthetic.",
    typicalUse: "Soft drinks, sweets, snacks, and many packaged foods.",
    healthConsideration: "Permitted flavourings are considered safe at normal use.",
  },
  "caffeine": {
    plainDescription: "Stimulant that occurs naturally in coffee, tea, and some drinks.",
    typicalUse: "Colas, energy drinks, and some foods.",
    healthConsideration: "Moderate amounts are fine for most adults; limit if sensitive or pregnant.",
  },
  "caffeine flavour": {
    plainDescription: "Flavouring that gives a caffeine-like or bitter note, often in colas.",
    typicalUse: "Soft drinks and some energy drinks.",
    healthConsideration: "Generally safe at permitted levels; check label for actual caffeine content if you are limiting it.",
  },
  "carbonated water": {
    plainDescription: "Water with dissolved CO₂ – makes drinks fizzy.",
    typicalUse: "Soft drinks, sparkling water, and sodas.",
    healthConsideration: "Generally safe; the rest of the drink (sugar, acids) matters more for health.",
  },
  "added sugar": {
    plainDescription: "Sugar added during processing, not naturally present in the raw ingredients.",
    typicalUse: "Listed on labels to show how much extra sugar is in the product.",
    healthConsideration: "Health bodies recommend limiting added sugar; check the amount per serving.",
  },
};

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getIngredientDetail(ingredientName: string): IngredientDetail | null {
  const key = normalizeKey(ingredientName);
  if (!key) return null;
  const entry = INGREDIENT_EXPLANATIONS[key];
  if (!entry) {
    // Try matching without "en:" prefix (OFF style)
    const withoutPrefix = key.replace(/^en:/, "");
    const entry2 = INGREDIENT_EXPLANATIONS[withoutPrefix];
    if (entry2)
      return { name: ingredientName, ...entry2 };
    return null;
  }
  return { name: ingredientName, ...entry };
}
