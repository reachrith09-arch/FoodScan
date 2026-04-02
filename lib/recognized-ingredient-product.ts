/**
 * Synthetic ProductResult rows for AI-recognized meal ingredients.
 * Used for photo-scan scoring so the combined score reflects estimated nutrition
 * for each named ingredient, not the first barcode product that matches a search.
 */
import type { Nutriments, ProductResult } from "@/types/food";

type Template = { nutriments: Nutriments; nova_group: number };

const SPICES_HERBS = new Set([
  "basil",
  "oregano",
  "thyme",
  "rosemary",
  "parsley",
  "cilantro",
  "mint",
  "dill",
  "cumin",
  "paprika",
  "turmeric",
  "ginger",
  "cinnamon",
  "nutmeg",
  "clove",
  "chili powder",
  "coriander",
  "zaatar",
  "sumac",
  "bay leaf",
  "sage",
  "chive",
  "tarragon",
  "marjoram",
  "seasoning",
  "herb",
  "spice",
  "garam masala",
  "five spice",
  "allspice",
  "black pepper",
  "white pepper",
]);

/** Garnish / pinch ingredients (per 100g — typical portions are small). */
const PINCH: Template = {
  nutriments: {
    "energy-kcal_100g": 25,
    proteins_100g: 2,
    carbohydrates_100g: 4,
    fat_100g: 0.5,
    fiber_100g: 2,
    sodium_100g: 20,
    sugars_100g: 0.5,
    "saturated-fat_100g": 0.1,
  },
  nova_group: 2,
};

const DEFAULT_WHOLE_FOOD: Template = {
  nutriments: {
    "energy-kcal_100g": 120,
    proteins_100g: 5,
    carbohydrates_100g: 12,
    fat_100g: 4,
    fiber_100g: 3,
    sodium_100g: 80,
    sugars_100g: 3,
    "saturated-fat_100g": 1.2,
  },
  nova_group: 1,
};

const RULES: { test: (n: string) => boolean; template: Template }[] = [
  {
    test: (n) =>
      /\b(salt|salting)\b/.test(n) ||
      n.includes("sea salt") ||
      n.includes("kosher salt"),
    template: {
      nutriments: {
        "energy-kcal_100g": 0,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 38_800,
        sugars_100g: 0,
        "saturated-fat_100g": 0,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) =>
      n.includes("soy sauce") ||
      n.includes("tamari") ||
      n.includes("fish sauce") ||
      n.includes("worcestershire"),
    template: {
      nutriments: {
        "energy-kcal_100g": 60,
        proteins_100g: 10,
        carbohydrates_100g: 5,
        fat_100g: 0.6,
        fiber_100g: 0,
        sodium_100g: 5600,
        sugars_100g: 0.4,
        "saturated-fat_100g": 0.1,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      n.includes("olive oil") ||
      n.includes("vegetable oil") ||
      n.includes("canola oil") ||
      n.includes("sunflower oil") ||
      n.includes("coconut oil") ||
      n.includes("sesame oil") ||
      n.includes("avocado oil") ||
      n.includes("grapeseed oil") ||
      (/\boil\b/.test(n) && !n.includes("eggplant")),
    template: {
      nutriments: {
        "energy-kcal_100g": 884,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 100,
        fiber_100g: 0,
        sodium_100g: 0,
        sugars_100g: 0,
        "saturated-fat_100g": 14,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) =>
      n.includes("butter") ||
      n.includes("ghee") ||
      n.includes("lard") ||
      n.includes("shortening") ||
      n.includes("margarine"),
    template: {
      nutriments: {
        "energy-kcal_100g": 717,
        proteins_100g: 0.9,
        carbohydrates_100g: 0.1,
        fat_100g: 81,
        fiber_100g: 0,
        sodium_100g: 11,
        sugars_100g: 0.1,
        "saturated-fat_100g": 51,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) =>
      n.includes("mayo") || n.includes("mayonnaise") || n.includes("aioli"),
    template: {
      nutriments: {
        "energy-kcal_100g": 680,
        proteins_100g: 1,
        carbohydrates_100g: 2,
        fat_100g: 75,
        fiber_100g: 0,
        sodium_100g: 635,
        sugars_100g: 1,
        "saturated-fat_100g": 12,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      n.includes("honey") ||
      n.includes("maple syrup") ||
      n.includes("molasses") ||
      (n.includes("syrup") && !n.includes("corn syrup")),
    template: {
      nutriments: {
        "energy-kcal_100g": 304,
        proteins_100g: 0.3,
        carbohydrates_100g: 82,
        fat_100g: 0,
        fiber_100g: 0.2,
        sodium_100g: 5,
        sugars_100g: 82,
        "saturated-fat_100g": 0,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) =>
      /\b(sugar|sucrose|icing sugar|powdered sugar|caster sugar)\b/.test(n) ||
      n.includes("jaggery"),
    template: {
      nutriments: {
        "energy-kcal_100g": 387,
        proteins_100g: 0,
        carbohydrates_100g: 100,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 1,
        sugars_100g: 100,
        "saturated-fat_100g": 0,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) =>
      n.includes("cola") || n.includes("soda pop") || /\bsoda\b/.test(n),
    template: {
      nutriments: {
        "energy-kcal_100g": 42,
        proteins_100g: 0,
        carbohydrates_100g: 11,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 4,
        sugars_100g: 11,
        "saturated-fat_100g": 0,
      },
      nova_group: 4,
    },
  },
  {
    test: (n) =>
      n.includes("juice") || n.includes("smoothie") || n.includes("nectar"),
    template: {
      nutriments: {
        "energy-kcal_100g": 45,
        proteins_100g: 0.5,
        carbohydrates_100g: 11,
        fat_100g: 0.1,
        fiber_100g: 0.2,
        sodium_100g: 2,
        sugars_100g: 9,
        "saturated-fat_100g": 0,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      /\b(water|seltzer|sparkling water)\b/.test(n) &&
      !n.includes("coconut water"),
    template: {
      nutriments: {
        "energy-kcal_100g": 0,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 2,
        sugars_100g: 0,
        "saturated-fat_100g": 0,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) => n.includes("coconut water"),
    template: {
      nutriments: {
        "energy-kcal_100g": 19,
        proteins_100g: 0.7,
        carbohydrates_100g: 3.7,
        fat_100g: 0.2,
        fiber_100g: 0,
        sodium_100g: 105,
        sugars_100g: 2.6,
        "saturated-fat_100g": 0.2,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("beer") ||
      n.includes("wine") ||
      n.includes("cocktail") ||
      /\b(rum|whisky|whiskey|vodka|gin|brandy|liqueur)\b/.test(n),
    template: {
      nutriments: {
        "energy-kcal_100g": 230,
        proteins_100g: 0,
        carbohydrates_100g: 5,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 1,
        sugars_100g: 3,
        "saturated-fat_100g": 0,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      /\b(coffee|espresso|latte|cappuccino|americano|tea)\b/.test(n) &&
      !n.includes("milk tea"),
    template: {
      nutriments: {
        "energy-kcal_100g": 2,
        proteins_100g: 0.1,
        carbohydrates_100g: 0,
        fat_100g: 0,
        fiber_100g: 0,
        sodium_100g: 1,
        sugars_100g: 0,
        "saturated-fat_100g": 0,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("bacon") ||
      n.includes("sausage") ||
      n.includes("pepperoni") ||
      n.includes("salami") ||
      n.includes("hot dog"),
    template: {
      nutriments: {
        "energy-kcal_100g": 450,
        proteins_100g: 18,
        carbohydrates_100g: 2,
        fat_100g: 42,
        fiber_100g: 0,
        sodium_100g: 1500,
        sugars_100g: 1,
        "saturated-fat_100g": 16,
      },
      nova_group: 4,
    },
  },
  {
    test: (n) =>
      n.includes("chicken") || n.includes("turkey") || n.includes("duck"),
    template: {
      nutriments: {
        "energy-kcal_100g": 190,
        proteins_100g: 28,
        carbohydrates_100g: 0,
        fat_100g: 8,
        fiber_100g: 0,
        sodium_100g: 85,
        sugars_100g: 0,
        "saturated-fat_100g": 2.2,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("beef") ||
      n.includes("pork") ||
      n.includes("lamb") ||
      n.includes("veal") ||
      n.includes("steak") ||
      n.includes("ground meat"),
    template: {
      nutriments: {
        "energy-kcal_100g": 250,
        proteins_100g: 26,
        carbohydrates_100g: 0,
        fat_100g: 16,
        fiber_100g: 0,
        sodium_100g: 72,
        sugars_100g: 0,
        "saturated-fat_100g": 6,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("salmon") ||
      n.includes("tuna") ||
      n.includes("cod") ||
      n.includes("tilapia") ||
      n.includes("shrimp") ||
      n.includes("prawn") ||
      n.includes("crab") ||
      n.includes("lobster") ||
      (/\b(fish)\b/.test(n) && !n.includes("fish sauce")),
    template: {
      nutriments: {
        "energy-kcal_100g": 180,
        proteins_100g: 22,
        carbohydrates_100g: 0,
        fat_100g: 10,
        fiber_100g: 0,
        sodium_100g: 90,
        sugars_100g: 0,
        "saturated-fat_100g": 2,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) => n.includes("egg") && !n.includes("eggplant"),
    template: {
      nutriments: {
        "energy-kcal_100g": 155,
        proteins_100g: 13,
        carbohydrates_100g: 1.1,
        fat_100g: 11,
        fiber_100g: 0,
        sodium_100g: 124,
        sugars_100g: 1.1,
        "saturated-fat_100g": 3.5,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("tofu") || n.includes("tempeh") || n.includes("edamame"),
    template: {
      nutriments: {
        "energy-kcal_100g": 144,
        proteins_100g: 17,
        carbohydrates_100g: 3,
        fat_100g: 9,
        fiber_100g: 2,
        sodium_100g: 14,
        sugars_100g: 1,
        "saturated-fat_100g": 1.3,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("cheese") ||
      n.includes("parmesan") ||
      n.includes("cheddar") ||
      n.includes("mozzarella") ||
      n.includes("feta") ||
      n.includes("ricotta"),
    template: {
      nutriments: {
        "energy-kcal_100g": 350,
        proteins_100g: 22,
        carbohydrates_100g: 3,
        fat_100g: 28,
        fiber_100g: 0,
        sodium_100g: 700,
        sugars_100g: 1,
        "saturated-fat_100g": 16,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      (n.includes("milk") &&
        !n.includes("coconut milk") &&
        !n.includes("almond milk") &&
        !n.includes("oat milk") &&
        !n.includes("soy milk") &&
        !n.includes("rice milk")) ||
      (n.includes("yogurt") && !n.includes("coconut")),
    template: {
      nutriments: {
        "energy-kcal_100g": 60,
        proteins_100g: 3.2,
        carbohydrates_100g: 4.8,
        fat_100g: 3.3,
        fiber_100g: 0,
        sodium_100g: 40,
        sugars_100g: 4.8,
        "saturated-fat_100g": 1.9,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      n.includes("almond milk") ||
      n.includes("oat milk") ||
      n.includes("soy milk") ||
      n.includes("rice milk") ||
      n.includes("cashew milk") ||
      n.includes("coconut milk"),
    template: {
      nutriments: {
        "energy-kcal_100g": 40,
        proteins_100g: 1,
        carbohydrates_100g: 6,
        fat_100g: 1.5,
        fiber_100g: 0.5,
        sodium_100g: 50,
        sugars_100g: 4,
        "saturated-fat_100g": 0.2,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      (n.includes("cream") || n.includes("heavy cream")) &&
      !n.includes("ice cream") &&
      !n.includes("sour cream") &&
      !n.includes("cream cheese"),
    template: {
      nutriments: {
        "energy-kcal_100g": 340,
        proteins_100g: 2.8,
        carbohydrates_100g: 3,
        fat_100g: 35,
        fiber_100g: 0,
        sodium_100g: 30,
        sugars_100g: 3,
        "saturated-fat_100g": 22,
      },
      nova_group: 2,
    },
  },
  {
    test: (n) => n.includes("sour cream"),
    template: {
      nutriments: {
        "energy-kcal_100g": 198,
        proteins_100g: 3.5,
        carbohydrates_100g: 4.6,
        fat_100g: 20,
        fiber_100g: 0,
        sodium_100g: 50,
        sugars_100g: 3.4,
        "saturated-fat_100g": 13,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) => n.includes("ice cream"),
    template: {
      nutriments: {
        "energy-kcal_100g": 250,
        proteins_100g: 4,
        carbohydrates_100g: 28,
        fat_100g: 14,
        fiber_100g: 0,
        sodium_100g: 60,
        sugars_100g: 24,
        "saturated-fat_100g": 8,
      },
      nova_group: 4,
    },
  },
  {
    test: (n) =>
      n.includes("pasta") ||
      n.includes("noodle") ||
      n.includes("spaghetti") ||
      n.includes("linguine") ||
      n.includes("fettuccine") ||
      n.includes("rice") ||
      n.includes("quinoa") ||
      n.includes("couscous") ||
      n.includes("bulgur") ||
      n.includes("tortilla") ||
      n.includes("bread") ||
      n.includes("bun") ||
      n.includes("bagel") ||
      n.includes("croissant") ||
      n.includes("wrap") ||
      n.includes("cracker") ||
      n.includes("cereal") ||
      n.includes("oat") ||
      n.includes("granola") ||
      n.includes("flour tortilla") ||
      /\b(flour|semolina|durum)\b/.test(n),
    template: {
      nutriments: {
        "energy-kcal_100g": 350,
        proteins_100g: 11,
        carbohydrates_100g: 72,
        fat_100g: 2,
        fiber_100g: 3,
        sodium_100g: 180,
        sugars_100g: 2,
        "saturated-fat_100g": 0.5,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      n.includes("potato") || n.includes("sweet potato") || n.includes("yam"),
    template: {
      nutriments: {
        "energy-kcal_100g": 85,
        proteins_100g: 2,
        carbohydrates_100g: 18,
        fat_100g: 0.1,
        fiber_100g: 2.5,
        sodium_100g: 10,
        sugars_100g: 1,
        "saturated-fat_100g": 0,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("lentil") ||
      n.includes("chickpea") ||
      n.includes("garbanzo") ||
      (n.includes("bean") &&
        !n.includes("green bean") &&
        !n.includes("string bean")) ||
      n.includes("black bean") ||
      n.includes("kidney bean") ||
      n.includes("pinto") ||
      n.includes("navy bean"),
    template: {
      nutriments: {
        "energy-kcal_100g": 135,
        proteins_100g: 9,
        carbohydrates_100g: 22,
        fat_100g: 0.6,
        fiber_100g: 8,
        sodium_100g: 10,
        sugars_100g: 1,
        "saturated-fat_100g": 0.1,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("peanut") ||
      n.includes("almond") ||
      n.includes("walnut") ||
      n.includes("cashew") ||
      n.includes("pecan") ||
      n.includes("pistachio") ||
      n.includes("hazelnut") ||
      n.includes("macadamia") ||
      (/\b(nut|nuts)\b/.test(n) && !n.includes("doughnut")),
    template: {
      nutriments: {
        "energy-kcal_100g": 575,
        proteins_100g: 20,
        carbohydrates_100g: 15,
        fat_100g: 50,
        fiber_100g: 10,
        sodium_100g: 10,
        sugars_100g: 4,
        "saturated-fat_100g": 6,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("ketchup") ||
      n.includes("marinara") ||
      n.includes("tomato sauce") ||
      n.includes("tomato paste") ||
      n.includes("salsa"),
    template: {
      nutriments: {
        "energy-kcal_100g": 75,
        proteins_100g: 2,
        carbohydrates_100g: 16,
        fat_100g: 0.5,
        fiber_100g: 2,
        sodium_100g: 420,
        sugars_100g: 10,
        "saturated-fat_100g": 0.1,
      },
      nova_group: 3,
    },
  },
  {
    test: (n) =>
      n.includes("dressing") ||
      n.includes("vinaigrette") ||
      n.includes("ranch") ||
      n.includes("caesar dressing"),
    template: {
      nutriments: {
        "energy-kcal_100g": 430,
        proteins_100g: 1,
        carbohydrates_100g: 5,
        fat_100g: 45,
        fiber_100g: 0,
        sodium_100g: 750,
        sugars_100g: 4,
        "saturated-fat_100g": 7,
      },
      nova_group: 4,
    },
  },
  {
    test: (n) =>
      n.includes("lettuce") ||
      n.includes("spinach") ||
      n.includes("kale") ||
      n.includes("arugula") ||
      n.includes("cabbage") ||
      n.includes("broccoli") ||
      n.includes("cauliflower") ||
      n.includes("zucchini") ||
      n.includes("cucumber") ||
      n.includes("celery") ||
      n.includes("bell pepper") ||
      n.includes("sweet pepper") ||
      n.includes("jalapeño") ||
      n.includes("jalapeno") ||
      n.includes("habanero") ||
      n.includes("poblano") ||
      n.includes("mushroom") ||
      n.includes("onion") ||
      n.includes("garlic") ||
      n.includes("carrot") ||
      n.includes("asparagus") ||
      n.includes("green bean") ||
      (n.includes("tomato") && !n.includes("sauce") && !n.includes("paste")),
    template: {
      nutriments: {
        "energy-kcal_100g": 30,
        proteins_100g: 2,
        carbohydrates_100g: 5,
        fat_100g: 0.4,
        fiber_100g: 3,
        sodium_100g: 40,
        sugars_100g: 3,
        "saturated-fat_100g": 0.1,
      },
      nova_group: 1,
    },
  },
  {
    test: (n) =>
      n.includes("apple") ||
      n.includes("banana") ||
      n.includes("orange") ||
      n.includes("berry") ||
      n.includes("grape") ||
      n.includes("mango") ||
      n.includes("pineapple") ||
      n.includes("melon") ||
      n.includes("peach") ||
      n.includes("pear") ||
      n.includes("plum") ||
      n.includes("cherry"),
    template: {
      nutriments: {
        "energy-kcal_100g": 55,
        proteins_100g: 0.5,
        carbohydrates_100g: 14,
        fat_100g: 0.2,
        fiber_100g: 2.5,
        sodium_100g: 1,
        sugars_100g: 10,
        "saturated-fat_100g": 0,
      },
      nova_group: 1,
    },
  },
];

function isPinchSpice(n: string): boolean {
  const t = n.trim().toLowerCase();
  if (t.length <= 2) return false;
  for (const w of t.split(/[\s,/&]+/)) {
    const x = w.replace(/[^a-z-]/g, "");
    if (x.length >= 3 && SPICES_HERBS.has(x)) return true;
  }
  return false;
}

const GENERIC_DRINK: Template = {
  nutriments: {
    "energy-kcal_100g": 40,
    proteins_100g: 0.5,
    carbohydrates_100g: 9,
    fat_100g: 0,
    fiber_100g: 0,
    sodium_100g: 15,
    sugars_100g: 9,
    "saturated-fat_100g": 0,
  },
  nova_group: 3,
};

function pickTemplate(name: string, isDrink: boolean): Template {
  const n = name.trim().toLowerCase();
  if (!n) return DEFAULT_WHOLE_FOOD;
  if (isPinchSpice(n)) return PINCH;
  for (const { test, template } of RULES) {
    if (test(n)) return template;
  }
  return isDrink ? GENERIC_DRINK : DEFAULT_WHOLE_FOOD;
}

let seq = 0;

/**
 * Build a minimal OFF-shaped product for meal scoring from an AI / user ingredient line.
 */
export function productFromRecognizedIngredient(
  name: string,
  opts?: { isDrink?: boolean },
): ProductResult {
  const trimmed = name.trim() || "Ingredient";
  const { nutriments, nova_group } = pickTemplate(
    trimmed,
    Boolean(opts?.isDrink),
  );
  return {
    code: `ai-ingredient-${Date.now()}-${++seq}`,
    product_name: trimmed,
    product_name_en: trimmed,
    ingredients_text: trimmed,
    nutriments,
    nova_group,
    additives_tags: [],
    additives_n: 0,
  };
}
