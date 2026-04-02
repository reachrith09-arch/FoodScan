import type { HealthProfile, ProductResult, ScanResult } from "@/types/food";
import { searchProductsUnified } from "@/lib/search-products-online";
import { getProductByBarcode, parseQueryForBrand } from "@/lib/open-food-facts";
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
  /** Bias product search toward the same aisle/category as the scanned item */
  searchContext?: string;
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
        searchContext: rule.category,
      });
    }
    // One food family only: later rules (e.g. Bread matching "toast" in "Cinnamon Toast Crunch")
    // must not add tips after a stronger earlier match like Cereal.
    break;
  }

  if (tips.length === 0) {
    const productName = (product.product_name ?? "This product").trim();
    const displayName = productName.length > 30 ? productName.slice(0, 30) + "…" : productName;
    const nut = product.nutriments;
    const kind = inferNutrientFallbackKind(product);
    const nutRec = nut as Record<string, number | undefined> | undefined;
    pushNutrientFallbackTips(tips, seen, product, displayName, kind, {
      sugar: nut?.sugars_100g ?? nut?.sugars,
      sodium: nut?.sodium_100g ?? (nut?.sodium != null ? nut.sodium * 1000 : undefined),
      satFat: nutRec?.["saturated-fat_100g"] ?? nutRec?.["saturated-fat"],
      fiber: nut?.fiber_100g ?? nut?.fiber,
      carbs: nut?.carbohydrates_100g ?? nut?.carbohydrates,
      protein: nut?.proteins_100g ?? nut?.proteins,
    });
  }

  return tips.slice(0, 4);
}

// ─── Similar search queries & ranking (keep swaps in the same “food family”) ─

const QUERY_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "with",
  "and",
  "or",
  "for",
  "of",
  "mini",
  "pack",
  "size",
  "bar",
  "original",
  "flavor",
  "flavoured",
  "flavored",
]);

function tokenizeProductText(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t));
}

/** Deepest-looking `en:` category tag as readable words (helps search stay on-aisle). */
export function categorySearchHint(product: ProductResult): string {
  const tags = (product.categories_tags ?? []).filter((t) => /^[a-z]{2}:/i.test(t));
  if (tags.length === 0) return "";
  const best = [...tags].sort((a, b) => b.length - a.length)[0];
  return best.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ").trim();
}

/** Clean a swap tip line into a search query fragment. */
export function cleanSwapSuggestionQuery(s: string): string {
  return s
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s*—.*$/, "")
    .replace(/e\.g\.\s*/gi, "")
    .replace(/\bhomemade:.*$/i, "")
    .trim();
}

export function buildSwapSearchQuery(tip: LocalSwapTip, source: ProductResult): string {
  const base = cleanSwapSuggestionQuery(tip.suggestion);
  const ctx = (tip.searchContext ?? "").trim() || categorySearchHint(source);
  if (!ctx) return base.slice(0, 130);
  const ctxLower = ctx.toLowerCase();
  if (base.toLowerCase().includes(ctxLower)) return base.slice(0, 130);
  return `${base} ${ctx}`.replace(/\s+/g, " ").trim().slice(0, 130);
}

/**
 * 0–1: overlap between the swap tip text (brand + product words) and the OFF name/brands.
 * Used so “Healthier alternatives” rows match the suggested product, not just any high-score candy.
 */
export function productSimilarityToSwapSuggestion(
  suggestionLine: string,
  candidate: ProductResult,
): number {
  const raw = cleanSwapSuggestionQuery(suggestionLine);
  if (!raw) return 0;
  const blob = normalize(`${candidate.brands ?? ""} ${candidate.product_name ?? ""}`);
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
  if (tokens.length === 0) return 0;

  let weighted = 0;
  let totalW = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const w = i === 0 ? 1.4 : 1;
    totalW += w;
    if (blob.includes(t)) weighted += w;
  }
  let score = weighted / totalW;

  const phrase = normalize(raw).replace(/\s+/g, " ");
  if (phrase.length >= 5 && blob.includes(phrase.replace(/ /g, ""))) {
    score = Math.min(1, score + 0.25);
  } else if (phrase.length >= 6 && blob.includes(phrase)) {
    score = Math.min(1, score + 0.3);
  }

  return Math.min(1, score);
}

/**
 * Multi-word tips (e.g. "Unreal Dark Chocolate Gems") must match the leading brand token
 * in OFF data so generic "dark chocolate" products (Fin Carré, Lindt) don’t win.
 */
function suggestionLeadingBrandMatchesCandidate(
  suggestionLine: string,
  candidate: ProductResult,
): boolean {
  const raw = cleanSwapSuggestionQuery(suggestionLine);
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
  if (tokens.length < 2) return true;
  const lead = tokens[0];
  if (lead.length < 4) return true;
  const blob = normalize(`${candidate.brands ?? ""} ${candidate.product_name ?? ""}`);
  return blob.includes(lead);
}

const SWAP_RANK_WEIGHTS = { health: 0.22, sourceSim: 0.18, suggestionSim: 0.6 };

/** Minimum suggestion match to prefer a hit over random high-health products. */
const SWAP_SUGGESTION_ACCEPT_FLOOR = 0.14;
const SWAP_SUGGESTION_WEAK_FLOOR = 0.06;

/**
 * Pick the database row that best matches the written swap tip (not only the scanned item).
 */
export function pickBestProductForSwapTip(
  sourceProduct: ProductResult,
  tip: Pick<LocalSwapTip, "suggestion">,
  candidates: ProductResult[],
  alreadyChosen: Set<string>,
  profile: HealthProfile | null,
): { product: ProductResult; score: number; label: string } | null {
  const filtered = candidates.filter(
    (r) =>
      r.code &&
      r.code !== sourceProduct.code &&
      !alreadyChosen.has(r.code) &&
      (r.product_name ?? "").trim().length > 0,
  );
  if (filtered.length === 0) return null;

  const scored = filtered.map((r) => {
    const analysis = analyzeProduct(profile, r);
    const simSource = productSimilarityToSource(sourceProduct, r);
    let simSug = productSimilarityToSwapSuggestion(tip.suggestion, r);
    if (!suggestionLeadingBrandMatchesCandidate(tip.suggestion, r)) {
      simSug = 0;
    }
    const h = Math.min(100, Math.max(0, analysis.overallScore)) / 100;
    const combined =
      h * SWAP_RANK_WEIGHTS.health +
      simSource * SWAP_RANK_WEIGHTS.sourceSim +
      simSug * SWAP_RANK_WEIGHTS.suggestionSim;
    return {
      product: r,
      score: analysis.overallScore,
      label: analysis.overallLabel,
      simSug,
      combined,
    };
  });
  scored.sort((a, b) => b.combined - a.combined);

  const strong = scored.filter((s) => s.simSug >= SWAP_SUGGESTION_ACCEPT_FLOOR);
  const pool = strong.length > 0 ? strong : scored.filter((s) => s.simSug >= SWAP_SUGGESTION_WEAK_FLOOR);
  const pick = pool.length > 0 ? pool[0] : null;
  if (!pick) return null;
  if (pick.simSug < SWAP_SUGGESTION_WEAK_FLOOR) return null;
  return { product: pick.product, score: pick.score, label: pick.label };
}

/**
 * When the strict ranker finds nothing (e.g. brand token mismatch in OFF), pick the closest
 * name match to the written tip so tap-to-open can still land on the right product.
 */
function pickBestBySuggestionTextOnly(
  sourceProduct: ProductResult,
  tip: Pick<LocalSwapTip, "suggestion">,
  candidates: ProductResult[],
  profile: HealthProfile | null,
  alreadyChosen: Set<string> = new Set(),
): { product: ProductResult; score: number; label: string } | null {
  const filtered = candidates.filter(
    (r) =>
      r.code &&
      r.code !== sourceProduct.code &&
      !alreadyChosen.has(r.code) &&
      (r.product_name ?? "").trim().length > 0,
  );
  if (filtered.length === 0) return null;

  const scored = filtered.map((r) => {
    const sim = productSimilarityToSwapSuggestion(tip.suggestion, r);
    const analysis = analyzeProduct(profile, r);
    return { product: r, sim, score: analysis.overallScore, label: analysis.overallLabel };
  });
  scored.sort((a, b) => b.sim - a.sim || b.score - a.score);
  const best = scored[0];
  if (!best || best.sim < 0.09) return null;
  return { product: best.product, score: best.score, label: best.label };
}

/** Last resort: leading token of the tip appears in OFF name/brands (e.g. “SmartSweets …”). */
function pickByLeadingBrandLoose(
  sourceProduct: ProductResult,
  tip: Pick<LocalSwapTip, "suggestion">,
  candidates: ProductResult[],
  profile: HealthProfile | null,
  alreadyChosen: Set<string> = new Set(),
): { product: ProductResult; score: number; label: string } | null {
  const raw = cleanSwapSuggestionQuery(tip.suggestion);
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t));
  if (tokens.length === 0) return null;
  const lead = tokens[0];
  if (lead.length < 3) return null;

  const filtered = candidates.filter(
    (r) =>
      r.code &&
      r.code !== sourceProduct.code &&
      !alreadyChosen.has(r.code) &&
      (r.product_name ?? "").trim().length > 0,
  );
  const blobMatches = filtered.filter((r) => {
    const blob = normalize(`${r.brands ?? ""} ${r.product_name ?? ""}`);
    return blob.includes(lead);
  });
  if (blobMatches.length === 0) return null;

  const scored = blobMatches.map((r) => {
    const sim = productSimilarityToSwapSuggestion(tip.suggestion, r);
    const analysis = analyzeProduct(profile, r);
    return { product: r, sim, score: analysis.overallScore, label: analysis.overallLabel };
  });
  scored.sort((a, b) => b.sim - a.sim || b.score - a.score);
  const best = scored[0];
  if (!best || best.sim < 0.055) return null;
  return { product: best.product, score: best.score, label: best.label };
}

/**
 * Strict ranked pick, then looser text match, then leading-brand match — used for preload and tap resolve.
 */
export function pickSwapProductFromCandidates(
  sourceProduct: ProductResult,
  tip: LocalSwapTip,
  candidates: ProductResult[],
  alreadyChosen: Set<string>,
  profile: HealthProfile | null,
): { product: ProductResult; score: number; label: string } | null {
  const strict = pickBestProductForSwapTip(sourceProduct, tip, candidates, alreadyChosen, profile);
  if (strict) return strict;
  const text = pickBestBySuggestionTextOnly(sourceProduct, tip, candidates, profile, alreadyChosen);
  if (text) return text;
  return pickByLeadingBrandLoose(sourceProduct, tip, candidates, profile, alreadyChosen);
}

/** Fetch full OFF v2 payload by barcode so the result screen has complete nutrition/ingredients. */
export async function hydrateProductForSwapNavigation(product: ProductResult): Promise<ProductResult> {
  const code = String(product.code ?? "").trim();
  if (!code || code.startsWith("online-")) return product;
  try {
    const full = await getProductByBarcode(code);
    return full ?? product;
  } catch {
    return product;
  }
}

function swapTipSearchQueryExtras(tip: LocalSwapTip): string[] {
  const raw = cleanSwapSuggestionQuery(tip.suggestion);
  const words = raw.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 2);
  const out: string[] = [];
  if (words[0] && words[0].length >= 3) out.push(words[0]);
  if (words.length >= 2) out.push(`${words[0]} ${words[1]}`);
  if (words.length >= 3) out.push(`${words[0]} ${words[1]} ${words[2]}`);
  return out;
}

function dedupeSearchQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const k = q.toLowerCase().replace(/\s+/g, " ").trim();
    if (k.length < 3 || seen.has(k)) continue;
    seen.add(k);
    out.push(q.trim());
  }
  return out;
}

/** Merge unified-search hits for all query variants for one tip (preload + tap). */
export async function fetchCandidatesForSwapTip(
  sourceProduct: ProductResult,
  tip: LocalSwapTip,
  profile: HealthProfile | null,
  pageSize = 56,
): Promise<ProductResult[]> {
  const queries = dedupeSearchQueries([
    buildSwapSearchQuery(tip, sourceProduct),
    cleanSwapSuggestionQuery(tip.suggestion),
    ...swapTipSearchQueryExtras(tip),
  ]);

  const byCode = new Map<string, ProductResult>();
  for (const q of queries) {
    try {
      const results = await searchProductsUnified(q, {
        pageSize,
        countryCode: profile?.countryCode,
      });
      for (const r of results) {
        if (r.code && !byCode.has(r.code)) byCode.set(r.code, r);
      }
    } catch {
      /* try next query */
    }
  }
  return [...byCode.values()];
}

/**
 * Resolve a swap tip to a single catalog product (e.g. user tapped a recommendation).
 * Merges results from multiple queries, then strict pick → looser name match.
 */
export async function findProductForSwapTip(
  sourceProduct: ProductResult,
  tip: LocalSwapTip,
  profile: HealthProfile | null,
): Promise<{ product: ProductResult; score: number; label: string } | null> {
  const merged = await fetchCandidatesForSwapTip(sourceProduct, tip, profile);
  if (merged.length === 0) return null;
  return pickSwapProductFromCandidates(sourceProduct, tip, merged, new Set(), profile);
}

/** Minimum name/category overlap vs scanned product for a swap to count as same “aisle”. */
export const SWAP_SIMILARITY_FLOOR = 0.14;

/** 0–1: shared Open Food Facts categories + name token overlap with the scanned product. */
export function productSimilarityToSource(source: ProductResult, candidate: ProductResult): number {
  let score = 0;

  const normTag = (t: string) => t.replace(/^[a-z]{2}:/i, "").toLowerCase();
  const tagsA = (source.categories_tags ?? []).map(normTag);
  const tagsB = new Set((candidate.categories_tags ?? []).map(normTag));
  let catHits = 0;
  for (const t of tagsA) {
    if (!t) continue;
    if (tagsB.has(t)) catHits += 1;
    else {
      for (const u of tagsB) {
        if (t.length >= 6 && (u.includes(t) || t.includes(u))) {
          catHits += 0.45;
          break;
        }
      }
    }
  }
  score += Math.min(0.55, catHits * 0.14);

  const ta = new Set(tokenizeProductText(source.product_name ?? ""));
  const tb = new Set(tokenizeProductText(candidate.product_name ?? ""));
  if (ta.size > 0 && tb.size > 0) {
    let inter = 0;
    for (const x of ta) {
      if (tb.has(x)) inter += 1;
    }
    const union = ta.size + tb.size - inter;
    if (union > 0) score += 0.45 * (inter / union);
  }

  return Math.min(1, score);
}

type NutrientFallbackKind =
  | "beverages"
  | "snacks_sweet"
  | "snacks_salty"
  | "dairy"
  | "bread_grains"
  | "condiments"
  | "frozen_meals"
  | "unknown";

function inferNutrientFallbackKind(product: ProductResult): NutrientFallbackKind {
  const tags = (product.categories_tags ?? []).join(" ").toLowerCase();
  const name = normalize(product.product_name ?? "");
  const blob = `${tags} ${name}`;

  if (
    /\b(beverages|drink|juice|soda|soft-drink|tea|coffee|water|smoothie|milk)\b/.test(blob) ||
    /\b(beverage|nectar|cola|energy-drink)\b/.test(tags)
  ) {
    return "beverages";
  }
  if (
    /\b(chocolate|candy|confection|dessert|biscuit|cookie|cake|sweet-snack|spreads)\b/.test(blob)
  ) {
    return "snacks_sweet";
  }
  if (/\b(snack|chip|cracker|pretzel|salty-snack)\b/.test(blob)) return "snacks_salty";
  if (/\b(dairy|yoghurt|yogurt|cheese|cream|butter|milk)\b/.test(blob)) return "dairy";
  if (/\b(cereal|bread|pasta|rice|flour|breakfast)\b/.test(blob)) return "bread_grains";
  if (/\b(sauce|dressing|condiment|spread|seasoning|vinegar)\b/.test(blob)) return "condiments";
  if (/\b(frozen|ready-to-eat|microwave|pizza)\b/.test(blob)) return "frozen_meals";
  return "unknown";
}

const NUTRIENT_FALLBACKS: Record<
  NutrientFallbackKind,
  { suggestion: string; reason: string }[]
> = {
  beverages: [
    {
      suggestion: "Spindrift Sparkling Water",
      reason: "Same drink occasion, real fruit, no added sugar vs sugary beverages",
    },
    {
      suggestion: "Olipop Vintage Cola",
      reason: "Soda-like taste with minimal sugar and added fiber",
    },
  ],
  snacks_sweet: [
    {
      suggestion: "Larabar Peanut Butter Cookie",
      reason: "Sweet snack from dates and nuts — no added sugar, similar use as a treat",
    },
    {
      suggestion: "Hu Kitchen Dark Chocolate Bar",
      reason: "Chocolate category swap: less sugar, simple ingredients",
    },
  ],
  snacks_salty: [
    {
      suggestion: "Siete Grain-Free Tortilla Chips",
      reason: "Same crunchy snack occasion, better oils and simpler ingredients",
    },
    {
      suggestion: "Simple Mills Almond Flour Crackers",
      reason: "Savory snack swap without seed oils or refined flour",
    },
  ],
  dairy: [
    {
      suggestion: "Siggi's Plain Icelandic Yogurt",
      reason: "Same dairy aisle: high protein, much less sugar than sweetened options",
    },
    {
      suggestion: "Good Culture Low-Fat Cottage Cheese",
      reason: "High protein dairy snack, minimal ingredients",
    },
  ],
  bread_grains: [
    {
      suggestion: "Dave's Killer Bread Thin-Sliced",
      reason: "Same bread/grain occasion with more whole grains and fiber",
    },
    {
      suggestion: "Banza Chickpea Pasta",
      reason: "Pasta-style meal with more protein and fiber, similar prep",
    },
  ],
  condiments: [
    {
      suggestion: "Primal Kitchen Unsweetened Ketchup",
      reason: "Same condiment role with no added sugar and cleaner oils",
    },
    {
      suggestion: "Sir Kensington's Avocado Oil Mayo",
      reason: "Spread/dressing swap with better fat profile",
    },
  ],
  frozen_meals: [
    {
      suggestion: "Amy's Organic Light & Lean Bowl",
      reason: "Frozen meal aisle: organic, simpler ingredients, controlled calories",
    },
    {
      suggestion: "Saffron Road Chicken Tikka Masala",
      reason: "Frozen entrée with cleaner protein and no artificial preservatives",
    },
  ],
  unknown: [
    {
      suggestion: "RXBAR Chocolate Sea Salt",
      reason: "Whole-food bar when macros are unclear — protein from eggs and nuts",
    },
    {
      suggestion: "Simple Mills Almond Flour Crackers",
      reason: "Versatile lower-ultraprocessed snack when category is ambiguous",
    },
  ],
};

function pushNutrientFallbackTips(
  tips: LocalSwapTip[],
  seen: Set<string>,
  product: ProductResult,
  displayName: string,
  kind: NutrientFallbackKind,
  options: { sugar?: number; sodium?: number; satFat?: number; fiber?: number; carbs?: number; protein?: number },
): void {
  const pool = NUTRIENT_FALLBACKS[kind];
  const hint = categorySearchHint(product);
  const ctx = (hint || kind.replace(/_/g, " ")).trim() || displayName.slice(0, 28).trim();

  const tryPush = (suggestion: string, reason: string) => {
    const key = `${displayName}→${suggestion}`;
    if (seen.has(key) || tips.length >= 4) return;
    seen.add(key);
    tips.push({
      original: displayName,
      suggestion,
      reason,
      searchContext: ctx,
    });
  };

  if (options.sugar != null && options.sugar > 15) {
    const s = pool[0];
    if (s) tryPush(s.suggestion, `${s.reason} (this product ~${Math.round(options.sugar)}g sugar / 100g)`);
  }
  if (options.sodium != null && options.sodium > 600) {
    const s = pool[1] ?? pool[0];
    if (s)
      tryPush(
        s.suggestion,
        `${s.reason} (this product ~${Math.round(options.sodium)}mg sodium / 100g)`,
      );
  }
  if (options.satFat != null && options.satFat > 8) {
    const s = pool[0];
    if (s)
      tryPush(
        s.suggestion,
        `${s.reason} (this product ~${Math.round(options.satFat)}g sat fat / 100g)`,
      );
  }
  if (
    options.fiber != null &&
    options.fiber < 2 &&
    options.carbs != null &&
    options.carbs > 15
  ) {
    const s = kind === "bread_grains" ? pool[0] : NUTRIENT_FALLBACKS.bread_grains[0];
    tryPush(
      s.suggestion,
      `${s.reason} — more fiber than this product`,
    );
  }
  if (options.protein != null && options.protein > 10 && tips.length < 2) {
    const s = pool[1] ?? pool[0];
    if (s) tryPush(s.suggestion, `${s.reason} — complements higher-protein items like this`);
  }
  if (tips.length === 0) {
    for (const s of pool.slice(0, 2)) {
      tryPush(s.suggestion, s.reason);
      if (tips.length >= 2) break;
    }
  }
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

  const hint = categorySearchHint(current);
  if (hint) {
    queries = queries.map((q) => `${q} ${hint}`.replace(/\s+/g, " ").trim().slice(0, 130));
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

  const scored = filtered.map((p) => {
    const analysis = analyzeProduct(profile, p);
    const sim = productSimilarityToSource(current, p);
    const combined = analysis.overallScore * 0.52 + sim * 100 * 0.48;
    return { product: p, score: analysis.overallScore, label: analysis.overallLabel, combined, sim };
  });
  scored.sort((a, b) => b.combined - a.combined);
  const pool = scored.filter((x) => x.sim >= SWAP_SIMILARITY_FLOOR);
  const pick = pool.length > 0 ? pool : scored;
  return pick.slice(0, max).map(({ product, score, label }) => ({ product, score, label }));
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

