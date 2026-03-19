import type { HealthProfile, ProductResult, ScanResult } from "@/types/food";
import { searchProductsUnified } from "@/lib/search-products-online";
import { parseQueryForBrand } from "@/lib/open-food-facts";
import { analyzeProduct } from "@/lib/scoring";

export interface SwapRecommendation {
  product: ProductResult;
  score: number;
  label: string;
}

export interface LocalSwapTip {
  original: string;
  suggestion: string;
  reason: string;
}

// ─── Local swap knowledge base ──────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractFoodItems(product: ProductResult): string[] {
  const name = normalize(product.product_name ?? "");
  const items: string[] = [];

  const blendedMatch = name.match(/blended meal\s*\(([^)]+)\)/i);
  if (blendedMatch) {
    items.push(...blendedMatch[1].split(",").map((s) => s.trim()).filter(Boolean));
  }

  const plusSplit = name.split(/\s*\+\s*/);
  if (plusSplit.length > 1) {
    items.push(...plusSplit.map((s) => s.trim().replace(/\d+\s*more$/, "").trim()).filter(Boolean));
  }

  if (items.length === 0 && name) {
    items.push(name);
  }

  return items;
}

interface CategoryRule {
  patterns: RegExp;
  category: string;
  swaps: { suggestion: string; reason: string }[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { patterns: /cereal|corn flakes|frosted flakes|cheerios|granola|froot loops|lucky charms|cinnamon toast|captain crunch|cocoa puffs|special k|raisin bran|chex|life cereal/i, category: "Cereal",
    swaps: [
      { suggestion: "Bob's Red Mill Steel Cut Oats", reason: "Whole grain, 7g protein, 4g fiber per serving, no added sugar" },
      { suggestion: "Barbara's Morning Oat Crunch", reason: "Low sugar cereal with 5g fiber, whole grain oats" },
    ]},
  { patterns: /yogurt|yoghurt|activia|chobani|yoplait|dannon|skyr/i, category: "Yogurt",
    swaps: [
      { suggestion: "Fage Total 0% Plain Greek Yogurt", reason: "18g protein, 0g fat, no added sugar" },
      { suggestion: "Siggi's Plain Skyr", reason: "15g protein, only 4g sugar, thick and creamy" },
    ]},
  { patterns: /ice cream|gelato|frozen dessert|häagen|ben.*jerry|magnum|breyer/i, category: "Ice cream",
    swaps: [
      { suggestion: "Yasso Frozen Greek Yogurt Bars", reason: "5g protein, 80-100 cal per bar, creamy texture" },
      { suggestion: "Halo Top Vanilla Bean", reason: "280 cal per pint, 20g protein, low sugar" },
    ]},
  { patterns: /chocolate bar|milk chocolate|dark chocolate|snickers|twix|kit kat|m&m|reese|hershey|cadbury|butterfinger|milky way|3 musketeers/i, category: "Chocolate",
    swaps: [
      { suggestion: "Hu Kitchen Dark Chocolate Bar", reason: "No refined sugar, organic cacao, simple ingredients" },
      { suggestion: "Lily's Dark Chocolate (stevia sweetened)", reason: "No sugar added, 3g net carbs, fair trade cocoa" },
    ]},
  { patterns: /chip|crisp|dorito|cheeto|lay.*s|pringles|ruffles|tostito|takis|funyun|sun chip|hot fries|frito|bugles/i, category: "Chips",
    swaps: [
      { suggestion: "Siete Grain-Free Tortilla Chips", reason: "Made from cassava, avocado oil, no seed oils" },
      { suggestion: "Beanitos Black Bean Chips", reason: "6g protein, 5g fiber per serving, whole bean based" },
      { suggestion: "PopCorners Popped Corn Chips", reason: "Never fried, 120 cal per serving, whole grain corn" },
    ]},
  { patterns: /soda|coca.cola|coke|pepsi|sprite|fanta|mountain dew|dr.pepper|7.up|root beer|crush|sierra mist/i, category: "Soda",
    swaps: [
      { suggestion: "Olipop Vintage Cola", reason: "Only 2g sugar, 9g fiber, prebiotics for gut health" },
      { suggestion: "Spindrift Sparkling Water", reason: "Real fruit juice, 0-5 cal, no artificial sweeteners" },
    ]},
  { patterns: /energy drink|red bull|monster|bang|celsius|rockstar|nos|reign|ghost/i, category: "Energy drink",
    swaps: [
      { suggestion: "Guayaki Yerba Mate (Unsweetened)", reason: "Natural caffeine, antioxidants, no crash" },
      { suggestion: "Matcha Love Unsweetened", reason: "Natural L-theanine + caffeine, calm focus, zero sugar" },
    ]},
  { patterns: /juice|orange juice|apple juice|grape juice|cranberry juice|tropicana|minute maid|welch|simply orange|naked juice/i, category: "Juice",
    swaps: [
      { suggestion: "Eat the whole fruit (orange, apple, grapes)", reason: "Same vitamins + fiber, no blood sugar spike" },
      { suggestion: "Hint Water (fruit-infused)", reason: "Zero sugar, zero sweeteners, just fruit essence" },
    ]},
  { patterns: /cookie|biscuit|oreo|chips ahoy|girl scout|shortbread|nutter butter|fig newton/i, category: "Cookies",
    swaps: [
      { suggestion: "Simple Mills Almond Flour Cookies", reason: "Grain-free, no seed oils, simple ingredients" },
      { suggestion: "GoMacro MacroBar", reason: "10g plant protein, organic, whole food ingredients" },
    ]},
  { patterns: /cake|cupcake|muffin|pastry|donut|doughnut|croissant|danish|brownie|pie\b|little debbie|hostess|entenmann/i, category: "Pastry",
    swaps: [
      { suggestion: "Kodiak Cakes Muffin Mix (make at home)", reason: "14g protein per serving, whole grains" },
      { suggestion: "RXBAR (Chocolate Sea Salt)", reason: "12g protein, egg whites, dates, nuts — simple ingredients" },
    ]},
  { patterns: /candy|gummy|skittles|jolly rancher|starburst|haribo|sour patch|jelly bean|licorice|swedish fish|nerds|airhead|mike.*ike/i, category: "Candy",
    swaps: [
      { suggestion: "SmartSweets Gummy Bears", reason: "Only 3g sugar per bag, plant-based, same gummy texture" },
      { suggestion: "Unreal Dark Chocolate Gems", reason: "Less sugar than M&M's, fair trade chocolate, no artificial colors" },
    ]},
  { patterns: /pizza|digiorno|tombstone|totino|red baron|ellio/i, category: "Pizza",
    swaps: [
      { suggestion: "Caulipower Cauliflower Crust Pizza", reason: "Less carbs, veggie-based crust, fewer calories" },
      { suggestion: "Banza Chickpea Crust Pizza", reason: "13g protein, 4g fiber per serving, gluten-free" },
    ]},
  { patterns: /burger|hamburger|cheeseburger|big mac|whopper|quarter pounder/i, category: "Burger",
    swaps: [
      { suggestion: "Applegate Organic Turkey Burger", reason: "Less saturated fat, no antibiotics, organic" },
      { suggestion: "Dr. Praeger's All American Veggie Burger", reason: "Only 11 ingredients, vegetables first, 110 cal" },
    ]},
  { patterns: /bacon|sausage|hot dog|salami|pepperoni|bologna|bratwurst|jimmy dean|oscar mayer|spam/i, category: "Processed meat",
    swaps: [
      { suggestion: "Applegate Uncured Turkey Bacon", reason: "No nitrates, 60% less fat than pork bacon" },
      { suggestion: "Bilinski's Organic Chicken Sausage", reason: "Organic, no fillers, no antibiotics, lean" },
    ]},
  { patterns: /bread|sandwich|toast|bun\b|roll\b|baguette|ciabatta|wonder bread|sara lee/i, category: "Bread",
    swaps: [
      { suggestion: "Ezekiel 4:9 Sprouted Whole Grain Bread", reason: "Sprouted grains, 4g protein, 3g fiber, no flour" },
      { suggestion: "Dave's Killer Bread (Thin-Sliced)", reason: "Whole grains, 3g fiber, organic, 60 cal/slice" },
    ]},
  { patterns: /pasta|spaghetti|penne|fettuccine|macaroni|noodle|lasagna|ravioli|linguine|barilla|ronzoni/i, category: "Pasta",
    swaps: [
      { suggestion: "Banza Chickpea Pasta", reason: "25g protein, 13g fiber per box, gluten-free" },
      { suggestion: "Barilla Protein+ Pasta", reason: "10g protein per serving, made with lentils and chickpeas" },
    ]},
  { patterns: /mac.*cheese|macaroni.*cheese|kraft|velveeta|annie.*mac/i, category: "Mac & cheese",
    swaps: [
      { suggestion: "Banza Chickpea Mac & Cheese", reason: "14g protein, fewer carbs, gluten-free" },
      { suggestion: "Annie's Organic Shells & White Cheddar", reason: "Organic, no artificial colors/flavors" },
    ]},
  { patterns: /ramen|instant noodle|cup noodle|maruchan|nissin|top ramen|samyang/i, category: "Instant ramen",
    swaps: [
      { suggestion: "Lotus Foods Millet & Brown Rice Ramen", reason: "Whole grains, 75% less sodium, organic" },
      { suggestion: "Mike's Mighty Good Craft Ramen", reason: "Steamed (not fried) noodles, real ingredients" },
    ]},
  { patterns: /french fries|fries|tater tot|hash brown|ore.ida/i, category: "Fries",
    swaps: [
      { suggestion: "Alexia Sweet Potato Fries", reason: "Non-GMO, more vitamin A, baked not fried" },
      { suggestion: "Dr. Praeger's Sweet Potato Littles", reason: "Made with real sweet potatoes, baked" },
    ]},
  { patterns: /fried chicken|chicken nugget|chicken tender|chicken finger|popcorn chicken|tyson nugget/i, category: "Fried chicken",
    swaps: [
      { suggestion: "Applegate Natural Chicken Nuggets", reason: "No antibiotics, no fillers, baked" },
      { suggestion: "Perdue Simply Smart Grilled Chicken Strips", reason: "Pre-grilled, no breading, 21g protein" },
    ]},
  { patterns: /ketchup|bbq sauce|barbecue sauce|heinz|hunt/i, category: "Ketchup / BBQ sauce",
    swaps: [
      { suggestion: "Primal Kitchen Unsweetened Ketchup", reason: "No added sugar, organic tomatoes, simple ingredients" },
      { suggestion: "Tessemae's Organic BBQ Sauce", reason: "No added sugar, no seed oils, USDA organic" },
    ]},
  { patterns: /mayonnaise|mayo|hellmann|miracle whip|duke/i, category: "Mayo",
    swaps: [
      { suggestion: "Primal Kitchen Avocado Oil Mayo", reason: "Made with avocado oil instead of seed oils, organic" },
      { suggestion: "Sir Kensington's Classic Mayo", reason: "Sunflower oil, cage-free eggs, non-GMO" },
    ]},
  { patterns: /ranch|caesar|creamy dressing|salad dressing|hidden valley|wish.bone/i, category: "Dressing",
    swaps: [
      { suggestion: "Primal Kitchen Ranch (avocado oil)", reason: "No seed oils, no dairy, no artificial ingredients" },
      { suggestion: "Tessemae's Organic Caesar Dressing", reason: "No added sugar, organic, simple ingredients" },
    ]},
  { patterns: /nutella|chocolate spread|hazelnut spread/i, category: "Chocolate spread",
    swaps: [
      { suggestion: "Justin's Chocolate Hazelnut Butter", reason: "Less sugar, organic, sustainably sourced" },
      { suggestion: "Nuttzo Power Fuel Butter", reason: "7 nut & seed blend, organic, packed with omega-3s" },
    ]},
  { patterns: /granola bar|protein bar|energy bar|clif|kind bar|nature valley|rxbar|quest bar|perfect bar/i, category: "Snack bar",
    swaps: [
      { suggestion: "RXBAR (e.g. Chocolate Sea Salt)", reason: "Only egg whites, dates, nuts — no added sugar, 12g protein" },
      { suggestion: "Larabar (e.g. Cashew Cookie)", reason: "Only 2-3 ingredients, dates + nuts, no added sugar" },
    ]},
  { patterns: /sports drink|gatorade|powerade|body armor|prime/i, category: "Sports drink",
    swaps: [
      { suggestion: "LMNT Electrolyte Drink Mix", reason: "No sugar, no fillers, science-backed electrolyte ratios" },
      { suggestion: "Vita Coco Coconut Water", reason: "Natural electrolytes, only 45 cal, no artificial sweeteners" },
    ]},
  { patterns: /butter\b|margarine|i can.*believe|country crock/i, category: "Butter / margarine",
    swaps: [
      { suggestion: "Kerrygold Grass-Fed Butter (in moderation)", reason: "More omega-3s and vitamin K2 than regular butter" },
      { suggestion: "Nutiva Organic Coconut Oil", reason: "Medium-chain fats, no trans fats, minimally processed" },
    ]},
  { patterns: /cream cheese|sour cream|cool whip|whipped cream|philadelphia/i, category: "Cream / spread",
    swaps: [
      { suggestion: "Kite Hill Almond Cream Cheese", reason: "Plant-based, no lactose, clean ingredients" },
      { suggestion: "Good Culture Low-Fat Cottage Cheese", reason: "14g protein, live cultures, simple ingredients" },
    ]},
  { patterns: /white rice|jasmine rice|basmati|uncle ben|minute rice/i, category: "White rice",
    swaps: [
      { suggestion: "Lundberg Organic Brown Rice", reason: "3x the fiber, more iron and magnesium" },
      { suggestion: "Ancient Harvest Quinoa", reason: "Complete protein (8g/serving), more iron and fiber" },
    ]},
  { patterns: /tortilla|wrap|mission tortilla|old el paso/i, category: "Tortilla / wrap",
    swaps: [
      { suggestion: "Siete Almond Flour Tortillas", reason: "Grain-free, only 7 ingredients, 4g protein" },
      { suggestion: "La Tortilla Factory Low Carb Wraps", reason: "Only 50 cal, 11g fiber, 5g protein" },
    ]},
  { patterns: /pancake|waffle|french toast|eggo|aunt jemima|bisquick/i, category: "Pancakes / waffles",
    swaps: [
      { suggestion: "Kodiak Cakes Power Cakes Mix", reason: "14g protein per serving, 100% whole grains" },
      { suggestion: "Birch Benders Protein Pancake Mix", reason: "16g protein, grain-free, paleo-friendly" },
    ]},
  { patterns: /bagel|thomas bagel|lender/i, category: "Bagel",
    swaps: [
      { suggestion: "Dave's Killer Bagels (Thin-Sliced)", reason: "Organic whole grains, 260 cal, 12g protein" },
      { suggestion: "Ezekiel 4:9 Sprouted Grain English Muffin", reason: "Sprouted grains, 4g fiber, 6g protein, 160 cal" },
    ]},
  { patterns: /cracker|ritz|pretzel|goldfish|cheez.it|triscuit|wheat thin/i, category: "Crackers / pretzels",
    swaps: [
      { suggestion: "Simple Mills Almond Flour Crackers", reason: "Grain-free, no seed oils, 3g protein" },
      { suggestion: "Mary's Gone Crackers (Original)", reason: "Organic, gluten-free, made from whole seeds" },
    ]},
  { patterns: /milkshake|smoothie|frappe|frappuccino|jamba/i, category: "Milkshake / smoothie",
    swaps: [
      { suggestion: "Homemade: banana + spinach + protein powder + almond milk", reason: "You control the sugar, 20g+ protein, whole food" },
      { suggestion: "Orgain Organic Nutrition Shake", reason: "16g protein, 21 vitamins, only 1g sugar" },
    ]},
  { patterns: /nachos|tostada/i, category: "Nachos",
    swaps: [
      { suggestion: "Siete Grain-Free Nacho Chips with homemade salsa", reason: "No seed oils, cassava-based, real food toppings" },
      { suggestion: "Bell pepper nachos (sliced peppers as base)", reason: "All the toppings, fraction of the carbs and calories" },
    ]},
  { patterns: /deli meat|lunch meat|ham\b|salami|prosciutto|oscar mayer|hillshire/i, category: "Deli meat",
    swaps: [
      { suggestion: "Applegate Organic Roasted Turkey Breast", reason: "No antibiotics, no nitrates, organic" },
      { suggestion: "Diestel Turkey Breast (sliced)", reason: "Family-farmed, no added hormones, simple ingredients" },
    ]},
  { patterns: /peanut butter|almond butter|nut butter|jif|skippy|peter pan/i, category: "Nut butter",
    swaps: [
      { suggestion: "Once Again Organic Peanut Butter (no stir)", reason: "Only peanuts and salt, no palm oil or sugar" },
      { suggestion: "Justin's Classic Almond Butter", reason: "Dry-roasted almonds + palm oil only, no added sugar" },
    ]},
  { patterns: /jam|jelly|preserves|marmalade|smucker/i, category: "Jam / jelly",
    swaps: [
      { suggestion: "St. Dalfour Fruit Spread", reason: "No sugar added, sweetened only with grape juice" },
      { suggestion: "Crofter's Organic Just Fruit Spread", reason: "Only fruit and pectin, no cane sugar, organic" },
    ]},
  { patterns: /syrup|maple syrup|pancake syrup|mrs\. butterworth|log cabin/i, category: "Syrup",
    swaps: [
      { suggestion: "100% Real Maple Syrup (Grade A Dark)", reason: "Has manganese, zinc, no corn syrup or artificial flavors" },
      { suggestion: "Lakanto Maple Flavored Syrup (sugar-free)", reason: "Zero calories, monk fruit sweetened, no blood sugar spike" },
    ]},
  { patterns: /popcorn|orville|act ii|movie popcorn|skinny ?pop/i, category: "Popcorn",
    swaps: [
      { suggestion: "Lesser Evil Organic Popcorn", reason: "Coconut oil, Himalayan salt, no artificial flavors" },
      { suggestion: "Boom Chicka Pop (Lightly Sweet)", reason: "Only 35 cal/cup, minimal ingredients, whole grain" },
    ]},
  { patterns: /vegetable oil|canola oil|soybean oil|corn oil|crisco|wesson/i, category: "Cooking oil",
    swaps: [
      { suggestion: "California Olive Ranch Extra Virgin Olive Oil", reason: "Heart-healthy monounsaturated fats, antioxidants" },
      { suggestion: "Chosen Foods Avocado Oil", reason: "High smoke point (500°F), neutral flavor, no seed oils" },
    ]},
  { patterns: /fried rice|chow mein|lo mein/i, category: "Fried rice / noodles",
    swaps: [
      { suggestion: "Green Giant Cauliflower Fried Rice", reason: "80% fewer carbs, veggies first, quick to make" },
      { suggestion: "Lotus Foods Brown Rice Ramen", reason: "Whole grain, organic, not fried" },
    ]},
  { patterns: /beer|wine|alcohol|liquor|cocktail|vodka|whiskey|rum\b|white claw|truly|bud light|corona|modelo/i, category: "Alcohol",
    swaps: [
      { suggestion: "Athletic Brewing Non-Alcoholic IPA", reason: "Full beer flavor, <0.5% ABV, only 70 cal" },
      { suggestion: "Hop Water (Lagunitas or HopLark)", reason: "Zero cal, zero alcohol, refreshing hop flavor" },
    ]},
  { patterns: /coffee.*cream|latte|mocha|cappuccino|macchiato|starbucks.*bottle/i, category: "Coffee drink",
    swaps: [
      { suggestion: "Califia Farms Unsweetened Oat Barista Blend", reason: "Froths well, 0g sugar, 60 cal per cup" },
      { suggestion: "Black coffee + splash of oat milk", reason: "Near-zero calories, full caffeine, no sugar crash" },
    ]},
  { patterns: /fish stick|fish finger|fried fish|fish fillet|gorton|van de kamp/i, category: "Fried fish",
    swaps: [
      { suggestion: "Wild Planet Wild Alaskan Salmon (canned)", reason: "Wild-caught, rich in omega-3s, no fillers, BPA-free" },
      { suggestion: "Dr. Praeger's Lightly Breaded Fish Fillets", reason: "No preservatives, whole fillets, baked not fried" },
    ]},
  { patterns: /cheese|cheddar|american cheese|processed cheese|string cheese|cheese spread|kraft singles|babybel/i, category: "Cheese",
    swaps: [
      { suggestion: "Organic Valley Grass-Fed Cheddar", reason: "Pasture-raised, more omega-3s, no growth hormones" },
      { suggestion: "Good Culture Low-Fat Cottage Cheese", reason: "14g protein per serving, live cultures, simple ingredients" },
    ]},
  { patterns: /\bmilk\b|whole milk|2% milk|chocolate milk|fairlife|horizon/i, category: "Milk",
    swaps: [
      { suggestion: "Oatly Oat Milk (Original)", reason: "Lower saturated fat, no cholesterol, fortified with vitamins" },
      { suggestion: "Fairlife Ultra-Filtered Milk (2%)", reason: "50% more protein, 50% less sugar than regular milk" },
    ]},
  { patterns: /jerky|beef jerky|turkey jerky|biltong|slim jim|jack link|oberto|epic bar|meat stick|meat snack/i, category: "Jerky / meat snack",
    swaps: [
      { suggestion: "Epic Venison Sea Salt Pepper Bar", reason: "Grass-fed, no added sugar, 11g protein, Whole30 approved" },
      { suggestion: "Chomps Original Beef Stick", reason: "Grass-fed, no sugar, no MSG, Whole30 & keto friendly" },
    ]},
  { patterns: /frozen dinner|frozen meal|lean cuisine|stouffer|hungry man|marie callender|banquet|smart ones|healthy choice/i, category: "Frozen meal",
    swaps: [
      { suggestion: "Saffron Road Chicken Tikka Masala", reason: "No preservatives, antibiotic-free chicken, halal" },
      { suggestion: "Amy's Organic Light & Lean meals", reason: "Organic, under 300 cal, no preservatives" },
    ]},
  { patterns: /soup|campbell|progresso|bone broth|chicken soup|tomato soup|chili\b/i, category: "Soup",
    swaps: [
      { suggestion: "Pacific Foods Organic Soup", reason: "Organic, low sodium options, no preservatives" },
      { suggestion: "Kettle & Fire Bone Broth", reason: "Grass-fed, collagen-rich, no additives" },
    ]},
  { patterns: /salsa|hot sauce|sriracha|tabasco|cholula|frank.*red/i, category: "Hot sauce / salsa",
    swaps: [
      { suggestion: "Siete Salsa (any flavor)", reason: "No seed oils, no added sugar, clean ingredients" },
      { suggestion: "Yellowbird Hot Sauce", reason: "Organic, no preservatives, real vegetable-based" },
    ]},
  { patterns: /frozen fruit|frozen veggie|frozen vegetable|birds eye|green giant frozen/i, category: "Frozen produce",
    swaps: [
      { suggestion: "Cascadian Farm Organic Frozen Vegetables", reason: "USDA organic, no additives, flash-frozen for nutrients" },
      { suggestion: "Wyman's Wild Blueberries (frozen)", reason: "Wild-harvested, 2x the antioxidants of regular blueberries" },
    ]},
  { patterns: /trail mix|mixed nuts|nut mix|planter|blue diamond/i, category: "Nuts / trail mix",
    swaps: [
      { suggestion: "Trader Joe's Raw Mixed Nuts (unsalted)", reason: "No oil roasting, no added salt, whole food fats" },
      { suggestion: "Daily Crunch Sprouted Almonds", reason: "Sprouted for better digestion, lightly seasoned" },
    ]},
  { patterns: /protein shake|protein powder|whey|muscle milk|ensure|boost|premier protein/i, category: "Protein shake",
    swaps: [
      { suggestion: "Orgain Organic Protein Powder", reason: "Plant-based, 21g protein, no artificial sweeteners" },
      { suggestion: "Garden of Life Raw Organic Protein", reason: "22g protein, sprouted, no fillers, USDA organic" },
    ]},
  { patterns: /hummus|sabra|cedar|roasted garlic/i, category: "Hummus / dip",
    swaps: [
      { suggestion: "Hope Foods Organic Hummus", reason: "Organic, no preservatives, cold-pressed" },
      { suggestion: "Ithaca Fresh Lemon Garlic Hummus", reason: "Cold-crafted, never heated, clean ingredients" },
    ]},
  { patterns: /rice cake|rice cracker|quaker rice/i, category: "Rice cakes",
    swaps: [
      { suggestion: "Lundberg Organic Rice Cakes", reason: "Organic whole grain, no artificial flavors" },
      { suggestion: "Mary's Gone Crackers Super Seed", reason: "Whole seeds, organic, gluten-free, more protein" },
    ]},
  { patterns: /canned tuna|canned salmon|canned sardine|starkist|bumble bee|chicken of the sea/i, category: "Canned fish",
    swaps: [
      { suggestion: "Wild Planet Albacore Wild Tuna", reason: "Pole-caught, lower mercury, no fillers, BPA-free can" },
      { suggestion: "Safe Catch Elite Wild Tuna", reason: "Mercury-tested every fish, no added water or fillers" },
    ]},
  { patterns: /canned bean|canned chickpea|canned lentil|bush.*bean|goya/i, category: "Canned beans",
    swaps: [
      { suggestion: "Eden Organic Beans (any variety)", reason: "BPA-free can, organic, no added sugar, pre-soaked" },
      { suggestion: "365 Organic Black Beans (no salt added)", reason: "Organic, no salt added, simple ingredients" },
    ]},
  { patterns: /tomato sauce|pasta sauce|marinara|prego|ragu|bertolli|classico/i, category: "Pasta sauce",
    swaps: [
      { suggestion: "Rao's Homemade Marinara", reason: "No added sugar, simple ingredients, Italian tomatoes" },
      { suggestion: "Muir Glen Organic Pasta Sauce", reason: "Organic, no added sugar, BPA-free can" },
    ]},
  { patterns: /soy sauce|teriyaki|worcestershire|fish sauce|oyster sauce|hoisin/i, category: "Asian sauce",
    swaps: [
      { suggestion: "Coconut Aminos (Coconut Secret)", reason: "73% less sodium than soy sauce, soy-free, gluten-free" },
      { suggestion: "San-J Organic Tamari (reduced sodium)", reason: "Organic, gluten-free, 25% less sodium" },
    ]},
  { patterns: /frozen waffle|frozen pancake|toaster strudel|pop.tart|toaster pastry/i, category: "Toaster pastry",
    swaps: [
      { suggestion: "Kodiak Cakes Frozen Waffles", reason: "100% whole grains, 12g protein, high fiber" },
      { suggestion: "Nature's Path Organic Toaster Pastries", reason: "Organic, no artificial colors, real fruit filling" },
    ]},
  { patterns: /dried fruit|raisin|dried mango|dried cranberry|fruit snack|fruit roll|gushers|welch.*fruit/i, category: "Fruit snack / dried fruit",
    swaps: [
      { suggestion: "That's It Fruit Bars", reason: "Only 2 ingredients (real fruit), no added sugar" },
      { suggestion: "Bare Baked Crunchy Apple Chips", reason: "Just apples, baked not fried, no added sugar" },
    ]},
  { patterns: /water.*flavor|mio|crystal light|drink mix|liquid iv|drip drop/i, category: "Drink mix",
    swaps: [
      { suggestion: "LMNT Electrolyte Mix", reason: "No sugar, no artificial ingredients, science-based formula" },
      { suggestion: "True Lemon Crystallized Lemon", reason: "Just crystallized citrus, zero calories, no sweeteners" },
    ]},
  { patterns: /oat\b|oatmeal|quaker oat|instant oat|steel cut|overnight oat/i, category: "Oatmeal",
    swaps: [
      { suggestion: "Bob's Red Mill Organic Steel Cut Oats", reason: "Minimally processed, 7g protein, 4g fiber" },
      { suggestion: "Purely Elizabeth Granola", reason: "Ancient grains, coconut sugar, no refined grains" },
    ]},
  { patterns: /coffee creamer|creamer|coffeemate|international delight|silk creamer/i, category: "Coffee creamer",
    swaps: [
      { suggestion: "Nutpods Original (unsweetened)", reason: "No sugar, no carrageenan, dairy-free, Whole30" },
      { suggestion: "Califia Farms Better Half (unsweetened)", reason: "15 cal, no sugar, coconut cream + almond milk" },
    ]},
  { patterns: /frozen burrito|frozen taquito|el monterey|jose ole/i, category: "Frozen Mexican",
    swaps: [
      { suggestion: "Sweet Earth Frozen Burritos", reason: "Plant-based protein, organic ingredients, no artificial" },
      { suggestion: "Siete Frozen Burritos", reason: "Grain-free tortilla, no seed oils, clean ingredients" },
    ]},
  { patterns: /instant coffee|k.cup|keurig|nescafe|folger/i, category: "Coffee",
    swaps: [
      { suggestion: "Purity Coffee (organic, tested clean)", reason: "Mold-free, high antioxidant, USDA organic" },
      { suggestion: "Four Sigmatic Mushroom Coffee", reason: "Organic, lion's mane + chaga, less jitter, more focus" },
    ]},
  { patterns: /tea\b|green tea|black tea|herbal tea|lipton|arizona tea|snapple/i, category: "Tea",
    swaps: [
      { suggestion: "Pukka Organic Herbal Teas", reason: "Organic, sustainably sourced, no artificial flavors" },
      { suggestion: "Numi Organic Tea", reason: "Fair trade, organic, no artificial flavors or fragrances" },
    ]},
  { patterns: /vitamin.*water|coconut water|aloe.*drink|kombucha|gt.*kombucha/i, category: "Functional beverage",
    swaps: [
      { suggestion: "GT's Synergy Kombucha (Original)", reason: "Raw, organic, billions of probiotics, low sugar" },
      { suggestion: "Harmless Harvest Organic Coconut Water", reason: "Fair trade, organic, no added sugars" },
    ]},
  { patterns: /steak|ribeye|sirloin|t.bone|filet|ground beef|beef\b/i, category: "Beef",
    swaps: [
      { suggestion: "Grass-fed ground beef (90/10 or leaner)", reason: "More omega-3s, less total fat, no antibiotics" },
      { suggestion: "Bison (ground or steak)", reason: "Leaner than beef, more iron, always grass-fed" },
    ]},
  { patterns: /chicken breast|chicken thigh|rotisserie|whole chicken|chicken\b/i, category: "Chicken",
    swaps: [
      { suggestion: "Organic boneless skinless chicken breast", reason: "No antibiotics, no hormones, humanely raised" },
      { suggestion: "Wild-caught salmon fillet", reason: "Omega-3s, vitamin D, anti-inflammatory benefits" },
    ]},
  { patterns: /pork|pork chop|pork loin|pulled pork|pork tenderloin/i, category: "Pork",
    swaps: [
      { suggestion: "Pork tenderloin (leanest cut)", reason: "Only 120 cal, 3g fat per serving, high protein" },
      { suggestion: "Chicken breast or turkey breast", reason: "Leaner alternatives with similar protein" },
    ]},
  { patterns: /salmon|tuna steak|swordfish|mahi|halibut|shrimp|prawn|seafood|crab|lobster|scallop/i, category: "Seafood",
    swaps: [
      { suggestion: "Wild-caught Alaskan salmon", reason: "Low mercury, rich omega-3s, sustainably sourced" },
      { suggestion: "Wild-caught Pacific sardines", reason: "Tiny fish = lowest mercury, highest omega-3 per oz" },
    ]},
  { patterns: /egg\b|eggs|egg white|hard boil/i, category: "Eggs",
    swaps: [
      { suggestion: "Vital Farms Pasture-Raised Eggs", reason: "More omega-3s and vitamin D than conventional eggs" },
      { suggestion: "Handsome Brook Farm Pasture-Raised Eggs", reason: "Certified humane, organic feed, richer yolk" },
    ]},
  { patterns: /tofu|tempeh|seitan|beyond|impossible|plant.based meat|veggie burger/i, category: "Plant-based protein",
    swaps: [
      { suggestion: "Organic extra-firm tofu (baked or grilled)", reason: "Minimal processing, 10g protein, versatile" },
      { suggestion: "Lightlife Organic Tempeh", reason: "Fermented (better digestion), 18g protein, whole soy" },
    ]},
  { patterns: /frozen pizza roll|pizza bite|bagel bite|totino.*pizza/i, category: "Pizza snack",
    swaps: [
      { suggestion: "Caulipower Cauliflower Pizza Bites", reason: "Veggie-based crust, less sodium, fewer calories" },
      { suggestion: "Amy's Cheese Pizza Snacks", reason: "Organic, no artificial ingredients, real cheese" },
    ]},
  { patterns: /pudding|jello|gelatin|custard|flan/i, category: "Pudding / dessert",
    swaps: [
      { suggestion: "Chia pudding (homemade with almond milk)", reason: "5g fiber, omega-3s, no added sugar" },
      { suggestion: "Hu Kitchen Chocolate Pudding Cups", reason: "No refined sugar, clean ingredients, vegan" },
    ]},
  { patterns: /applesauce|fruit cup|fruit puree|mott|dole.*cup/i, category: "Applesauce / fruit cup",
    swaps: [
      { suggestion: "Whole fresh fruit (apple, orange, banana)", reason: "More fiber, more filling, no packaging waste" },
      { suggestion: "GoGo Squeez Organic Applesauce", reason: "Organic, no added sugar, portable" },
    ]},
  { patterns: /tortilla chip|corn chip|tostito|mission chip/i, category: "Tortilla chips",
    swaps: [
      { suggestion: "Siete Grain-Free Tortilla Chips", reason: "Avocado oil, cassava-based, no seed oils" },
      { suggestion: "Late July Organic Tortilla Chips", reason: "Organic corn, non-GMO, minimal ingredients" },
    ]},
  { patterns: /frozen breakfast|breakfast burrito|jimmy dean breakfast|hot pocket/i, category: "Frozen breakfast",
    swaps: [
      { suggestion: "Sweet Earth Breakfast Burrito", reason: "Plant-based, organic, no artificial ingredients" },
      { suggestion: "Good Food Made Simple Egg White Burrito", reason: "Cage-free eggs, whole wheat, under 300 cal" },
    ]},
];

export function getLocalSwapTips(product: ProductResult): LocalSwapTip[] {
  const tips: LocalSwapTip[] = [];
  const seen = new Set<string>();
  const items = extractFoodItems(product);
  const categories = (product.categories_tags ?? []).map((t) => t.replace(/^en:/, "").replace(/-/g, " ")).join(" ");

  const nameText = [...items, categories].join(" ");

  for (const rule of CATEGORY_RULES) {
    if (!rule.patterns.test(nameText)) continue;

    let label = rule.category;
    for (const item of items) {
      if (rule.patterns.test(item)) {
        label = item.charAt(0).toUpperCase() + item.slice(1);
        break;
      }
    }

    for (const swap of rule.swaps) {
      const key = `${label}→${swap.suggestion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tips.push({
        original: label,
        suggestion: swap.suggestion,
        reason: swap.reason,
      });
    }
    if (tips.length >= 4) break;
  }

  if (tips.length === 0) {
    const productName = (product.product_name ?? "This product").trim();
    const displayName = productName.length > 30 ? productName.slice(0, 30) + "…" : productName;
    const nut = product.nutriments;
    const sugar = nut?.sugars_100g ?? nut?.sugars;
    const sodium = nut?.sodium_100g ?? (nut?.sodium != null ? nut.sodium * 1000 : undefined);
    const satFat = nut?.["saturated-fat_100g"] ?? nut?.["saturated-fat"];
    const fiber = nut?.fiber_100g ?? nut?.fiber;
    const carbs = nut?.carbohydrates_100g ?? nut?.carbohydrates;
    const protein = nut?.proteins_100g ?? nut?.proteins;

    if (sugar != null && sugar > 15) {
      tips.push({ original: displayName, suggestion: "Chomps Original Beef Stick", reason: `Zero sugar, 10g protein, grass-fed — vs ${Math.round(sugar)}g sugar in this` });
      tips.push({ original: displayName, suggestion: "RXBAR Chocolate Sea Salt", reason: `Only 12g sugar from dates, 12g protein, no added sugar` });
    }
    if (sodium != null && sodium > 600) {
      tips.push({ original: displayName, suggestion: "Epic Venison Sea Salt Bar", reason: `Only 300mg sodium vs ${Math.round(sodium)}mg in this, grass-fed, Whole30` });
    }
    if (satFat != null && satFat > 8) {
      tips.push({ original: displayName, suggestion: "Primal Kitchen Collagen Bar", reason: `Only 3g sat fat, 12g protein, no seed oils` });
    }
    if (fiber != null && fiber < 2 && carbs != null && carbs > 15) {
      tips.push({ original: displayName, suggestion: "Banza Chickpea Snacks", reason: "5g fiber, 6g protein per serving — way more fiber than this" });
    }
    if (protein != null && protein > 10 && tips.length < 2) {
      tips.push({ original: displayName, suggestion: "Chomps Original Beef Stick", reason: "10g protein, zero sugar, grass-fed, only 100 cal" });
    }
    if (tips.length === 0) {
      tips.push({ original: displayName, suggestion: "Epic Provisions Bar", reason: "Whole food protein bar, grass-fed, no fillers, clean snack" });
      tips.push({ original: displayName, suggestion: "Simple Mills Almond Flour Crackers", reason: "Whole food snack, no seed oils, grain-free" });
    }
  }

  return tips.slice(0, 4);
}

// ─── API-based swap recommendations ─────────────────────────────────────────

export async function getSwapRecommendations(
  current: ProductResult,
  profile: HealthProfile | null,
  max = 3,
): Promise<SwapRecommendation[]> {
  const fullName = (current.product_name || "").trim();
  const brand = (current.brands || "").trim();

  const blendedMatch = fullName.match(/blended meal\s*\(([^)]+)\)/i);
  const plusItems = fullName.split(/\s*\+\s*/);

  let queries: string[] = [];

  if (blendedMatch) {
    queries = blendedMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  } else if (plusItems.length > 1) {
    queries = plusItems.map((s) => s.trim()).filter(Boolean);
  } else {
    const q = [fullName, brand].filter(Boolean).join(" ").trim();
    if (!q) return [];
    const { brand: parsedBrand, productTerms } = parseQueryForBrand(q);
    queries = [parsedBrand && productTerms ? `${productTerms} ${parsedBrand}` : q];
  }

  const allResults: ProductResult[] = [];

  const searchPromises = queries.slice(0, 3).map(async (searchQuery) => {
    try {
      const results = await searchProductsUnified(searchQuery, { pageSize: 10, countryCode: profile?.countryCode });
      return results;
    } catch {
      return [];
    }
  });

  const batchResults = await Promise.all(searchPromises);
  for (const results of batchResults) {
    allResults.push(...results);
  }

  const seenCodes = new Set<string>();
  if (current.code) seenCodes.add(current.code);
  const filtered = allResults.filter((p) => {
    if (!p.code || seenCodes.has(p.code)) return false;
    seenCodes.add(p.code);
    return true;
  });

  const ranked = filtered
    .map((p) => {
      const analysis = analyzeProduct(profile, p);
      return { product: p, score: analysis.overallScore, label: analysis.overallLabel };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  return ranked;
}

export function makeSwapScanResult(
  product: ProductResult,
  profile: HealthProfile | null,
): ScanResult {
  const analysis = analyzeProduct(profile, product);
  return {
    id: `${Date.now()}-${product.code}`,
    timestamp: Date.now(),
    source: "search",
    barcode: product.code,
    product,
    healthRisks: analysis.healthRisks,
    analysis,
  };
}

