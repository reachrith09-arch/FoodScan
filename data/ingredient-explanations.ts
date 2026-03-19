import type { IngredientDetail } from "@/types/food";

/**
 * Curated explanations for common additives and complex ingredients.
 * Keys are normalized (lowercase, trimmed) for lookup.
 */
export const INGREDIENT_EXPLANATIONS: Record<string, Omit<IngredientDetail, "name">> = {
  "dextrose": {
    plainDescription: "Dextrose is pure glucose (simple sugar) made from corn or wheat starch. It's chemically identical to blood sugar and is absorbed into the bloodstream faster than table sugar.",
    typicalUse: "Used in this product for sweetness, to improve browning during baking, and to extend shelf life.",
    healthConsideration: "Raises blood sugar very quickly — faster than regular sugar. People with diabetes or insulin resistance should be aware. It counts toward total sugars on the nutrition label.",
  },
  "soya": {
    plainDescription: "Soya (soy) is a legume used as a protein source, emulsifier, or filler. It's one of the most common food allergens worldwide.",
    typicalUse: "Used in this product likely as a protein source or as part of an emulsifier (soya lecithin) to improve texture.",
    healthConsideration: "Soy is a top-14 allergen — avoid if you have a soy allergy. For most people it's safe and nutritious. It's a complete plant protein containing all essential amino acids.",
  },
  "e322": {
    plainDescription: "E322 is lecithin — a natural fat-like substance that acts as an emulsifier, keeping oil and water mixed so the product stays smooth and doesn't separate.",
    typicalUse: "Used in this product to maintain a consistent texture and prevent ingredients from splitting.",
    healthConsideration: "Generally safe and well-tolerated. Most commonly derived from soy or sunflower seeds. If you have a soy allergy, check whether it's soy-derived or sunflower-derived.",
  },
  "lecithin": {
    plainDescription: "Lecithin is a natural emulsifier that keeps oil and water blended together, preventing separation and giving products a smooth, consistent texture.",
    typicalUse: "Used in this product to maintain texture and prevent the product from splitting or becoming grainy.",
    healthConsideration: "Generally safe. Usually derived from soy or sunflower — people with soy allergies should check the source. Sunflower lecithin is a common soy-free alternative.",
  },
  "soya lecithin": {
    plainDescription: "Soya lecithin is an emulsifier extracted from soybeans. It keeps fat and water mixed together, preventing separation in the product.",
    typicalUse: "Used in this product to maintain a smooth, uniform texture.",
    healthConsideration: "Avoid if you have a soy allergy. The protein content is very low (most is removed during processing), but sensitive individuals should still be cautious.",
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
    plainDescription: "Vanillin is the main flavour compound in vanilla. In most packaged foods it's synthetic (made from wood pulp or guaiacol) rather than from real vanilla beans, which makes it much cheaper.",
    typicalUse: "Used in this product to add a vanilla flavour without the cost of real vanilla extract.",
    healthConsideration: "Considered safe at food levels. Synthetic vanillin is chemically identical to the compound in natural vanilla. Some people prefer real vanilla for taste, but there's no meaningful health difference.",
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
    plainDescription: "Xanthan gum is a thickener and stabiliser produced by fermenting sugar with a bacteria called Xanthomonas campestris. It's widely used in gluten-free products to mimic the stretchy texture that gluten provides.",
    typicalUse: "Used in this product to thicken, stabilise, and improve texture — preventing separation and giving a consistent mouthfeel.",
    healthConsideration: "Generally safe and acts as a soluble fibre that feeds gut bacteria. Very high amounts (far more than in food) can cause bloating or loose stools in some people.",
  },
  "gellan gum": {
    plainDescription: "Gelling and thickening agent produced by fermenting sugar with bacteria.",
    typicalUse: "Dairy alternatives, jams, desserts, and beverages to improve texture.",
    healthConsideration: "Generally recognized as safe. Used in small amounts; may cause mild digestive effects in sensitive individuals.",
  },
  "carrageenan": {
    plainDescription: "Carrageenan is a thickener and stabiliser extracted from red seaweed. It's used to give products a creamy, smooth texture and prevent separation.",
    typicalUse: "Used in this product to maintain a consistent texture and prevent ingredients from separating.",
    healthConsideration: "Considered safe by most food authorities. However, some research suggests it may cause gut inflammation in sensitive individuals, particularly those with IBS or inflammatory bowel conditions. If you have digestive issues, you may want to limit it.",
  },
  "e202": {
    plainDescription: "Potassium sorbate – preservative that inhibits mold and yeast.",
    typicalUse: "Cheese, wine, dried fruit, and many packaged foods.",
    healthConsideration: "Generally recognized as safe at permitted levels.",
  },
  "potassium sorbate": {
    plainDescription: "Potassium sorbate is a widely used preservative that stops mould, yeast, and some bacteria from growing, extending the product's shelf life.",
    typicalUse: "Used in this product to prevent spoilage and maintain freshness after opening.",
    healthConsideration: "Considered safe by the FDA and EFSA at permitted levels. It breaks down in the body into water and carbon dioxide. Some people with sensitivities may experience mild skin or digestive reactions, but this is uncommon.",
  },
  "e211": {
    plainDescription: "Sodium benzoate – preservative against bacteria and fungi.",
    typicalUse: "Soft drinks, condiments, and acidic foods.",
    healthConsideration: "Generally safe. In combination with vitamin C, small amounts of benzene can form; levels are regulated.",
  },
  "sodium benzoate": {
    plainDescription: "Sodium benzoate is a preservative that prevents bacteria, yeast, and mould from growing in acidic foods and drinks, extending their shelf life.",
    typicalUse: "Used in this product as a preservative to maintain freshness and safety.",
    healthConsideration: "Considered safe at regulated levels. When combined with vitamin C (ascorbic acid) in drinks, small amounts of benzene can form — a known carcinogen. Levels are regulated and typically very low, but some people prefer to avoid the combination. Can also trigger reactions in people with aspirin sensitivity.",
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
    plainDescription: "Natural flavors are flavouring compounds extracted from real food sources — plants, animals, spices, or fermentation. Despite the name, they can be highly processed and the exact source is rarely disclosed on the label.",
    typicalUse: "Used in this product to add or enhance a specific taste without listing every individual flavouring compound.",
    healthConsideration: "Generally considered safe. However, 'natural flavour' can come from animal sources (not suitable for vegans) or allergen sources like soy, wheat, or shellfish. If you have allergies or dietary restrictions, contact the manufacturer for the exact source.",
  },
  "skim milk": {
    plainDescription: "Skim milk is cow's milk with almost all the fat removed. It keeps the protein (~8g per cup) and calcium (~300mg per cup) of whole milk but with fewer calories.",
    typicalUse: "Used in this product to add protein, calcium, and a milky flavour with less fat than whole milk.",
    healthConsideration: "Nutritious for most people. Avoid if you have a dairy allergy or lactose intolerance. Some people find skim milk less satisfying than full-fat dairy.",
  },
  "whole milk": {
    plainDescription: "Whole milk retains its natural fat content (~3.5% fat), giving it a richer, creamier taste than skim milk. It provides protein, calcium, and fat-soluble vitamins A and D.",
    typicalUse: "Used in this product for richness, creaminess, and to carry fat-soluble flavours.",
    healthConsideration: "Nutritious and satisfying. Higher in saturated fat (~5g per 100ml) than low-fat options. Current evidence suggests moderate whole dairy consumption is not harmful for most healthy adults. Avoid if you have a dairy allergy or lactose intolerance.",
  },
  "milk": {
    plainDescription: "Milk is a nutrient-rich dairy liquid providing protein (~3.4g/100ml), calcium (~120mg/100ml), and vitamins B12 and D. It adds creaminess and structure to products.",
    typicalUse: "Used in this product to add protein, calcium, and a creamy texture.",
    healthConsideration: "Nutritious for most people. Avoid if you have a dairy allergy (immune reaction) or lactose intolerance (digestive issue with milk sugar). Lactose-free versions are available for those who are intolerant.",
  },
  "cream": {
    plainDescription: "Cream is the high-fat layer of cow's milk, containing around 18–48% fat depending on the type (single, double, or whipping cream). It adds richness, creaminess, and a smooth mouthfeel.",
    typicalUse: "Used in this product to add richness, a creamy texture, and to carry fat-soluble flavours.",
    healthConsideration: "High in saturated fat — heavy cream has about 35g of fat per 100ml. Fine in moderation as part of a balanced diet. Avoid if you have a dairy allergy or lactose intolerance.",
  },
  "cane sugar": {
    plainDescription: "Cane sugar is sucrose extracted from sugar cane — the same molecule as regular table sugar. It's 50% glucose and 50% fructose, and is used purely for sweetness.",
    typicalUse: "Used in this product as a sweetener. It's often marketed as more 'natural' than refined white sugar, but nutritionally they are identical.",
    healthConsideration: "Counts as added sugar. The WHO recommends limiting added sugar to under 25g per day for adults. Check the nutrition label to see how much this product contributes. High sugar intake is linked to weight gain, tooth decay, and blood sugar spikes.",
  },
  "coffee": {
    plainDescription: "Coffee is made from roasted coffee beans and contains caffeine, antioxidants (chlorogenic acids), and flavour compounds. It adds a bitter, roasted taste to products.",
    typicalUse: "Used in this product for its characteristic coffee flavour and natural caffeine content.",
    healthConsideration: "Moderate coffee consumption (3–4 cups/day) is associated with health benefits including reduced risk of type 2 diabetes and liver disease. Caffeine content varies — check the label if you're pregnant, sensitive to caffeine, or limiting stimulants. Avoid close to bedtime.",
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
    plainDescription: "Palm oil is a vegetable oil extracted from the fruit of oil palm trees. It's semi-solid at room temperature and has a neutral flavour, making it ideal for processed foods.",
    typicalUse: "Used in this product for texture, shelf stability, and to replace trans fats in baked goods and spreads.",
    healthConsideration: "High in saturated fat (~50%), which can raise LDL (bad) cholesterol. It's better than trans fats but less heart-healthy than olive or canola oil. Palm oil production is also linked to deforestation — look for RSPO-certified sustainable palm oil if this matters to you.",
  },
  "canola oil": {
    plainDescription: "Canola oil is pressed from canola seeds (a type of rapeseed). It's low in saturated fat (~7%) and high in heart-healthy monounsaturated fats (~63%) and omega-3 fatty acids.",
    typicalUse: "Used in this product as a cooking oil or fat source. It's a common choice because it's affordable and has a neutral taste.",
    healthConsideration: "Considered one of the healthier cooking oils. Its omega-3 content supports heart health. Most canola oil is refined at high temperatures, which can reduce some beneficial compounds — cold-pressed versions retain more nutrients.",
  },
  "rapeseed oil": {
    plainDescription: "Oil from rapeseed (canola); same as canola oil in many markets.",
    typicalUse: "Cooking, dressings, and processed foods.",
    healthConsideration: "Generally safe; canola is a type of low-erucic-acid rapeseed.",
  },
  "glucose syrup": {
    plainDescription: "Glucose syrup is a liquid sweetener made by breaking down starch (usually corn or wheat) into glucose. It's sweeter than table sugar and helps retain moisture in products.",
    typicalUse: "Used in this product for sweetness, to improve texture, and to prevent crystallisation.",
    healthConsideration: "Rapidly raises blood sugar — people with diabetes should account for it in their carb intake. If made from wheat, it may contain trace gluten. Check the label if you have coeliac disease.",
  },
  "high fructose corn syrup": {
    plainDescription: "High-fructose corn syrup (HFCS) is a liquid sweetener made from corn starch where some glucose has been converted to fructose, making it sweeter than regular corn syrup.",
    typicalUse: "Used in this product as a sweetener and to improve texture and shelf life.",
    healthConsideration: "High intake of fructose (unlike glucose) is processed mainly by the liver and has been linked to fatty liver, raised triglycerides, and insulin resistance over time. It's not more harmful than sugar in small amounts, but it's easy to overconsume in processed foods.",
  },
  "modified starch": {
    plainDescription: "Modified starch is regular starch (from corn, wheat, potato, or tapioca) that has been chemically or physically treated to improve how it behaves during cooking, freezing, or storage.",
    typicalUse: "Used in this product as a thickener or stabiliser to maintain texture across different temperatures.",
    healthConsideration: "Generally considered safe. If the source is wheat, it may contain trace gluten — relevant for people with coeliac disease. The label should specify the source if it's a common allergen.",
  },
  "ascorbic acid": {
    plainDescription: "Ascorbic acid is vitamin C — an essential nutrient and natural antioxidant. In food, it's used to prevent browning, preserve colour, and extend shelf life by stopping oxidation.",
    typicalUse: "Used in this product as a preservative and antioxidant to maintain freshness and colour.",
    healthConsideration: "Safe and beneficial — vitamin C is essential for immune function, collagen production, and iron absorption. The added form is identical to natural vitamin C. Very high supplemental doses (above 2,000mg/day) can cause digestive upset, but amounts in food are far below this.",
  },
  "e300": {
    plainDescription: "Ascorbic acid (vitamin C) – antioxidant and preservative.",
    typicalUse: "Widely used in beverages, baked goods, and preserved foods.",
    healthConsideration: "Generally safe and beneficial in normal amounts.",
  },
  "monosodium glutamate": {
    plainDescription: "MSG (monosodium glutamate) is a flavour enhancer that intensifies the savoury, umami taste of food. It's the sodium salt of glutamic acid, an amino acid found naturally in tomatoes, parmesan, and mushrooms.",
    typicalUse: "Used in this product to boost savoury flavour and make the product taste more satisfying.",
    healthConsideration: "Considered safe by the FDA, WHO, and most health bodies. The idea that MSG causes headaches ('Chinese restaurant syndrome') has not been supported by controlled studies. It does contribute to sodium intake — one concern if you're limiting salt.",
  },
  "msg": {
    plainDescription: "MSG (monosodium glutamate) is a flavour enhancer that adds a deep, savoury umami taste. It's naturally present in many foods like tomatoes and aged cheese.",
    typicalUse: "Used in this product to enhance savoury flavour.",
    healthConsideration: "Considered safe by major health authorities. Adds to sodium intake — worth noting if you're monitoring salt. Claims of headaches or sensitivity are not consistently supported by scientific evidence.",
  },
  "e621": {
    plainDescription: "E621 is monosodium glutamate (MSG) — a flavour enhancer that adds an intense savoury, umami taste to food.",
    typicalUse: "Used in this product to make the flavour taste richer and more satisfying.",
    healthConsideration: "Considered safe by the FDA and WHO. Contributes to sodium intake. The 'MSG sensitivity' claim has not been reliably proven in double-blind studies.",
  },
  "sodium": {
    plainDescription: "Sodium is an essential mineral that regulates fluid balance and nerve function. In food, it mainly comes from salt (sodium chloride) and other sodium compounds used as preservatives or flavour enhancers.",
    typicalUse: "Present in this product from salt, preservatives, or other sodium-containing ingredients.",
    healthConsideration: "The body needs about 500mg of sodium per day, but most people consume 3,400mg or more. Excess sodium raises blood pressure and increases heart disease risk. The daily limit is 2,300mg. Check the nutrition label — many processed foods provide a large chunk of this in a single serving.",
  },
  "salt": {
    plainDescription: "Salt (sodium chloride) is the most common seasoning and preservative in food. It enhances flavour, controls moisture, and inhibits bacterial growth.",
    typicalUse: "Used in this product for flavour and to help preserve it.",
    healthConsideration: "The recommended daily limit is under 2,300mg of sodium (about 1 teaspoon of salt). Most people consume too much. High sodium intake is directly linked to high blood pressure, which increases risk of heart disease and stroke. Check the nutrition label to see how much sodium this product contributes per serving.",
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
    plainDescription: "Phosphoric acid is a sharp, tangy acid that gives colas their distinctive bite. It also acts as a preservative by lowering the pH, making it harder for bacteria to grow.",
    typicalUse: "Used in this product to add tartness and act as a preservative.",
    healthConsideration: "High consumption of phosphoric acid (mainly from frequent cola drinking) has been linked to lower bone density because it can interfere with calcium absorption. It's also acidic enough to erode tooth enamel over time. Occasional consumption is generally fine.",
  },
  "acid": {
    plainDescription: "Acidity regulator or flavour – makes food/drink taste sharper or less sweet.",
    typicalUse: "Soft drinks, jams, dressings, and many processed foods.",
    healthConsideration: "Common food acids (e.g. citric, phosphoric) are generally safe at normal levels.",
  },
  "natural flavouring": {
    plainDescription: "Natural flavouring means the flavour compounds come from real food sources — plants, spices, fruit, meat, seafood, dairy, or fermentation. Despite the 'natural' label, these are often highly concentrated and processed extracts.",
    typicalUse: "Used in this product to add a specific taste using compounds derived from natural sources.",
    healthConsideration: "Generally safe. The word 'natural' doesn't automatically mean healthier — it just means the source was biological. If you have food allergies or follow a vegan diet, note that natural flavourings can come from animal sources. Contact the manufacturer if you need to know the exact origin.",
  },
  "flavouring": {
    plainDescription: "Flavouring refers to added compounds that give the product its specific taste or aroma. They can be natural (from real food sources) or artificial (synthesised in a lab). The exact compounds are usually not listed.",
    typicalUse: "Used in this product to create or enhance its characteristic taste.",
    healthConsideration: "Approved flavourings are considered safe at the amounts used in food. If you have allergies, note that 'flavouring' can sometimes contain allergen-derived compounds — contact the manufacturer if you need specifics.",
  },
  "flavoring": {
    plainDescription: "Flavoring refers to added compounds that give the product its specific taste or aroma. They can be natural (from real food sources) or artificial (synthesised in a lab).",
    typicalUse: "Used in this product to create or enhance its characteristic taste.",
    healthConsideration: "Approved flavorings are considered safe at the amounts used in food. If you have allergies, note that 'flavoring' can sometimes contain allergen-derived compounds — contact the manufacturer if you need specifics.",
  },
  "caffeine": {
    plainDescription: "Caffeine is a natural stimulant found in coffee, tea, cacao, and guarana. It works by blocking adenosine receptors in the brain, reducing feelings of tiredness and increasing alertness.",
    typicalUse: "Used in this product as a natural stimulant — either added directly or present from coffee, tea, or other caffeinated ingredients.",
    healthConsideration: "Up to 400mg/day is considered safe for healthy adults (roughly 4 cups of coffee). A typical cola has ~35mg, energy drinks ~80–150mg. Avoid or limit if you're pregnant (limit to 200mg/day), have anxiety, heart arrhythmias, or are sensitive to caffeine. Can disrupt sleep if consumed in the afternoon or evening.",
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
  "niacin": {
    plainDescription: "Niacin (vitamin B3) is an essential B vitamin added to fortify this product. It helps your body convert food into energy and supports healthy skin, nerves, and digestion.",
    typicalUse: "Added to cereals, breads, and processed foods to replace B vitamins lost during refining, or to boost nutritional value.",
    healthConsideration: "Safe and beneficial at food levels. The daily recommended amount is 14–16mg for adults. Very high supplement doses (500mg+) can cause skin flushing, but amounts in food are far below this.",
  },
  "riboflavin": {
    plainDescription: "Riboflavin (vitamin B2) is an essential B vitamin that helps your body produce energy from carbohydrates, fats, and protein. It also supports healthy skin and eyes.",
    typicalUse: "Added to fortified cereals, breads, and dairy products to replace nutrients lost in processing.",
    healthConsideration: "Safe and beneficial. The daily recommended amount is 1.1–1.3mg. Excess is excreted in urine (it turns urine bright yellow — this is harmless). Deficiency is rare in people eating a varied diet.",
  },
  "thiamin": {
    plainDescription: "Thiamin (vitamin B1) is an essential B vitamin that helps convert carbohydrates into energy and supports healthy nerve and muscle function.",
    typicalUse: "Added to fortified cereals, breads, and rice to replace B1 lost during grain refining.",
    healthConsideration: "Safe and necessary. The daily recommended amount is 1.1–1.2mg. Deficiency (rare in developed countries) causes fatigue and nerve problems. Amounts in fortified food are safe.",
  },
  "thiamine": {
    plainDescription: "Thiamine (vitamin B1) is an essential B vitamin that helps convert carbohydrates into energy and supports healthy nerve and muscle function.",
    typicalUse: "Added to fortified cereals, breads, and rice to replace B1 lost during grain refining.",
    healthConsideration: "Safe and necessary. The daily recommended amount is 1.1–1.2mg. Deficiency (rare in developed countries) causes fatigue and nerve problems. Amounts in fortified food are safe.",
  },
  "folic acid": {
    plainDescription: "Folic acid is the synthetic form of folate (vitamin B9), essential for DNA synthesis and cell growth. It's especially important during pregnancy to prevent neural tube defects.",
    typicalUse: "Added to fortified cereals, breads, and grain products. Mandatory fortification in many countries.",
    healthConsideration: "Safe and beneficial. The daily recommended amount is 400mcg (600mcg during pregnancy). High doses from supplements (above 1,000mcg/day) may mask B12 deficiency — but amounts in food are safe.",
  },
  "folate": {
    plainDescription: "Folate is vitamin B9 — essential for DNA synthesis, cell growth, and red blood cell formation. It's particularly important during pregnancy.",
    typicalUse: "Found naturally in leafy greens and legumes; added to fortified foods as folic acid.",
    healthConsideration: "Safe and important. Adults need 400mcg/day; pregnant women need 600mcg/day. Deficiency can cause anaemia and, during pregnancy, neural tube defects.",
  },
  "vitamin d": {
    plainDescription: "Vitamin D is a fat-soluble vitamin that helps your body absorb calcium and phosphorus, supporting bone health, immune function, and muscle strength.",
    typicalUse: "Added to dairy products, plant milks, cereals, and orange juice to compensate for low sun exposure in many populations.",
    healthConsideration: "Safe at food levels. The daily recommended amount is 600–800 IU (15–20mcg). Deficiency is very common — especially in northern climates. Excess from supplements (above 4,000 IU/day) can be harmful, but amounts in food are safe.",
  },
  "vitamin b12": {
    plainDescription: "Vitamin B12 is essential for nerve function, DNA synthesis, and red blood cell production. It's found almost exclusively in animal products, making it critical for vegans to supplement or get from fortified foods.",
    typicalUse: "Added to plant milks, cereals, and meat alternatives to make them suitable for people avoiding animal products.",
    healthConsideration: "Safe and essential. Adults need 2.4mcg/day. Deficiency causes anaemia and nerve damage — vegans and older adults are at higher risk. Amounts in fortified food are safe.",
  },
  "vitamin c": {
    plainDescription: "Vitamin C (ascorbic acid) is an essential antioxidant vitamin that supports immune function, collagen production, and iron absorption from plant foods.",
    typicalUse: "Added to juices, cereals, and processed foods both as a nutrient and as a natural preservative to prevent browning.",
    healthConsideration: "Safe and beneficial. Adults need 75–90mg/day. Very high supplement doses (above 2,000mg/day) can cause digestive upset, but amounts in food are well below this.",
  },
  "iron": {
    plainDescription: "Iron is an essential mineral that carries oxygen in your blood (as part of haemoglobin) and supports energy production. It's added to many cereals and grain products.",
    typicalUse: "Added to fortified cereals and breads to replace iron lost during grain processing and to help people meet daily requirements.",
    healthConsideration: "Essential for everyone, especially women of childbearing age. Adults need 8–18mg/day. Too little causes anaemia (fatigue, weakness). Too much from supplements can be harmful, but amounts in fortified food are safe.",
  },
  "zinc": {
    plainDescription: "Zinc is an essential mineral that supports immune function, wound healing, taste and smell, and DNA synthesis.",
    typicalUse: "Added to fortified cereals and some beverages to boost nutritional value.",
    healthConsideration: "Safe at food levels. Adults need 8–11mg/day. Deficiency impairs immune function and wound healing. Very high supplement doses (above 40mg/day) can interfere with copper absorption, but food amounts are safe.",
  },
  "calcium": {
    plainDescription: "Calcium is the most abundant mineral in the body, essential for strong bones and teeth, muscle contraction, and nerve signalling.",
    typicalUse: "Added to plant milks, fortified juices, and cereals to match the calcium content of dairy milk.",
    healthConsideration: "Essential for bone health. Adults need 1,000–1,200mg/day. Most people don't get enough. Excess from supplements (above 2,500mg/day) can cause kidney stones, but amounts in food are safe.",
  },
  "potassium": {
    plainDescription: "Potassium is an essential mineral that regulates fluid balance, muscle contractions, and nerve signals. It also helps counteract the blood-pressure-raising effects of sodium.",
    typicalUse: "Present naturally in many foods; sometimes added to sports drinks and processed foods.",
    healthConsideration: "Most people don't get enough potassium (recommended 2,600–3,400mg/day). High potassium intake from food is safe for healthy people. People with kidney disease should monitor intake as impaired kidneys can't remove excess potassium.",
  },
  "magnesium": {
    plainDescription: "Magnesium is an essential mineral involved in over 300 enzyme reactions, including energy production, protein synthesis, muscle function, and blood sugar control.",
    typicalUse: "Present naturally in nuts, seeds, and whole grains; sometimes added to fortified foods and drinks.",
    healthConsideration: "Adults need 310–420mg/day. Many people fall short. Deficiency is linked to muscle cramps, fatigue, and poor sleep. Amounts in food are safe; very high supplement doses can cause digestive upset.",
  },
  "added sugar": {
    plainDescription: "Added sugar refers to any sugar that was added during manufacturing — not the sugar naturally present in fruit or milk. It includes white sugar, honey, syrups, and other caloric sweeteners.",
    typicalUse: "Listed on the nutrition label to show how much extra sugar was added beyond what's naturally in the ingredients.",
    healthConsideration: "The WHO recommends limiting added sugar to under 25g (6 teaspoons) per day for adults. High added sugar intake is linked to weight gain, tooth decay, blood sugar spikes, and increased risk of type 2 diabetes over time.",
  },
  "sugar": {
    plainDescription: "Sugar (sucrose) is made of equal parts glucose and fructose. It's the most common sweetener in processed food and is extracted from sugar cane or sugar beets.",
    typicalUse: "Used in this product as a primary sweetener and to improve texture, colour (browning), and shelf life.",
    healthConsideration: "Counts as added sugar. The WHO recommends keeping added sugar under 25g per day. Check the nutrition label — many products contain more sugar than you'd expect. High intake over time is linked to weight gain, tooth decay, and metabolic issues.",
  },
  "water": {
    plainDescription: "Water is the most common ingredient in food and drinks. It acts as a solvent, helps with texture, and is essential for cooking and processing.",
    typicalUse: "Used in this product as a base ingredient, to dissolve other ingredients, or to achieve the right consistency.",
    healthConsideration: "Completely safe. Its presence means the product has a higher water content, which can dilute calories and nutrients per gram.",
  },
  "wheat flour": {
    plainDescription: "Wheat flour is ground wheat grain. It provides structure and texture in baked goods through gluten — a protein network that forms when flour is mixed with water.",
    typicalUse: "Used in this product as the main structural ingredient, providing body, texture, and chewiness.",
    healthConsideration: "Contains gluten — avoid if you have coeliac disease or non-coeliac gluten sensitivity. Refined white wheat flour has most of the fibre and nutrients removed; whole wheat flour retains more. Wheat is also a common allergen.",
  },
  "corn starch": {
    plainDescription: "Corn starch is a fine white powder extracted from corn kernels. It's a pure carbohydrate with no protein or fat, used mainly as a thickener.",
    typicalUse: "Used in this product to thicken sauces, improve texture, or keep powdered ingredients from clumping.",
    healthConsideration: "Generally safe. Has a high glycaemic index — it raises blood sugar quickly, similar to white bread. People with diabetes should account for it in their carb intake. Gluten-free.",
  },
  "sunflower oil": {
    plainDescription: "Sunflower oil is pressed from sunflower seeds. It's high in polyunsaturated fats (mainly omega-6 linoleic acid) and has a mild, neutral flavour.",
    typicalUse: "Used in this product as a cooking oil or fat source. It's a common choice for frying and baking due to its high smoke point.",
    healthConsideration: "Generally considered healthy in moderation. However, it's very high in omega-6 fatty acids — most Western diets already have too much omega-6 relative to omega-3, which can promote inflammation. High-oleic sunflower oil (a variant) has a better omega-6 to omega-3 ratio.",
  },
  "rapeseed oil": {
    plainDescription: "Rapeseed oil (canola oil in North America) is pressed from rapeseed. It's low in saturated fat and high in heart-healthy monounsaturated fats and omega-3 fatty acids.",
    typicalUse: "Used in this product as a cooking oil or fat source.",
    healthConsideration: "One of the healthier cooking oils available. Its omega-3 content (about 9%) is higher than most vegetable oils. Generally considered heart-healthy when used in moderation.",
  },
  "maltodextrin": {
    plainDescription: "Maltodextrin is a processed carbohydrate powder made by partially breaking down starch (usually corn, wheat, or potato). It dissolves easily and has almost no flavour.",
    typicalUse: "Used in this product as a filler, thickener, or to improve texture and shelf life.",
    healthConsideration: "Has a very high glycaemic index (GI of 85–136, higher than table sugar at 65). It raises blood sugar very quickly and has little nutritional value. People with diabetes or insulin resistance should be aware. It also feeds certain gut bacteria that can promote inflammation.",
  },
  "sodium chloride": {
    plainDescription: "Sodium chloride is table salt — the most common seasoning and preservative in food. It's made of sodium and chloride ions.",
    typicalUse: "Used in this product for flavour and to help preserve it by inhibiting microbial growth.",
    healthConsideration: "Essential in small amounts but most people consume too much. The recommended daily limit is 2,300mg of sodium (about 1 teaspoon of salt). Excess sodium is directly linked to high blood pressure and increased cardiovascular risk.",
  },
  "e202": {
    plainDescription: "E202 is potassium sorbate — a widely used preservative that prevents mould, yeast, and bacteria from growing in food.",
    typicalUse: "Used in this product to extend shelf life and prevent spoilage.",
    healthConsideration: "Considered safe by the FDA and EFSA at permitted levels. It breaks down naturally in the body. Rare cases of skin or digestive sensitivity have been reported.",
  },
  "e320": {
    plainDescription: "E320 is BHA (butylated hydroxyanisole) — a synthetic antioxidant that prevents fats and oils from going rancid.",
    typicalUse: "Used in this product to extend shelf life by preventing fat oxidation.",
    healthConsideration: "Permitted in small amounts in many countries. Some animal studies at very high doses showed potential carcinogenic effects, leading some health bodies to recommend limiting intake. The amounts used in food are regulated and much lower than those used in studies.",
  },
  "e321": {
    plainDescription: "E321 is BHT (butylated hydroxytoluene) — a synthetic antioxidant that prevents fats and oils from going rancid.",
    typicalUse: "Used in this product to prevent oxidation and extend shelf life.",
    healthConsideration: "Generally considered safe at permitted food levels. Some people prefer to avoid it as a precaution. Some research suggests it may have both antioxidant and pro-oxidant effects depending on dose.",
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
