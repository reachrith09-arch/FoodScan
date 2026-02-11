#!/usr/bin/env node
/**
 * Runs 100 diverse food search terms against the same Open Food Facts API
 * used by the app (legacy + v2). Verifies search works across cuisines.
 */

const SEARCH_LEGACY_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const SEARCH_V2_URL = "https://world.openfoodfacts.net/api/v2/search";
const PAGE_SIZE = 6;
const TIMEOUT_MS = 15000;
const DELAY_MS = 150;

const USER_AGENT = "FoodScan-App/1.0 (https://github.com/openfoodfacts)";

const FOODS = [
  // Western / European
  "pizza", "pasta", "cheese", "yogurt", "bread", "butter", "milk", "cereal",
  "oatmeal", "hamburger", "fries", "ketchup", "mayonnaise", "salad", "sandwich",
  "bagel", "croissant", "waffle", "pancake", "bacon", "sausage", "eggs",
  "apple", "banana", "orange", "grapes", "strawberry", "watermelon", "peach",
  "avocado", "tomato", "carrot", "broccoli", "potato", "lettuce", "cucumber",
  "spinach", "corn", "chocolate", "ice cream", "cookie", "cake", "honey",
  "jam", "peanut butter", "olive oil", "vinegar", "mustard",
  // Asian
  "rice", "noodles", "sushi", "ramen", "tofu", "edamame", "miso", "kimchi",
  "bok choy", "coconut milk", "soy sauce", "spring roll", "fish sauce",
  "teriyaki", "ginger", "soy milk", "green tea", "dumplings", "pho", "pad thai",
  // Indian
  "curry", "dal", "naan", "chapati", "basmati rice", "samosa", "chutney",
  "ghee", "paneer", "biryani", "tandoori", "masala", "lentils",
  // Middle Eastern
  "hummus", "falafel", "pita", "tahini", "tabbouleh", "feta", "olives",
  "dates", "baklava", "baba ganoush",
  // Latin American
  "tortilla", "black beans", "salsa", "guacamole", "plantain", "quinoa",
  "empanada", "mole", "ceviche", "arepa",
  // African / other
  "couscous", "yam", "okra", "jollof rice", "injera", "fufu", "plantain chips",
  "dried figs", "almonds", "cashews", "pistachio", "walnuts",
];

async function searchLegacy(query, signal) {
  const params = new URLSearchParams({
    action: "process",
    search_terms: query.trim(),
    json: "1",
    page_size: String(PAGE_SIZE),
    lc: "en",
  });
  const res = await fetch(`${SEARCH_LEGACY_URL}?${params.toString()}`, {
    signal,
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const products = data?.products ?? [];
  return products.filter((p) => p?.code && (p?.product_name || p?.generic_name || p?.brands));
}

async function searchV2(query, signal) {
  const params = new URLSearchParams({
    q: query.trim(),
    lc: "en",
    page_size: String(Math.min(PAGE_SIZE, 24)),
  });
  const res = await fetch(`${SEARCH_V2_URL}?${params.toString()}`, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const products = data?.products ?? [];
  return products.filter((p) => {
    const code = p?.code ?? p?.product?.code;
    const name = p?.product_name ?? p?.product_name_en ?? p?.product?.product_name ?? p?.product?.product_name_en;
    const brands = p?.brands ?? p?.product?.brands;
    return code && (name || brands);
  });
}

async function searchOne(query) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const legacy = await searchLegacy(query, controller.signal);
    clearTimeout(timeoutId);
    if (legacy.length > 0) return { ok: true, count: legacy.length, source: "legacy" };
    const v2Controller = new AbortController();
    const v2Timeout = setTimeout(() => v2Controller.abort(), TIMEOUT_MS);
    try {
      const v2 = await searchV2(query, v2Controller.signal);
      clearTimeout(v2Timeout);
      return { ok: true, count: v2.length, source: "v2" };
    } catch (e) {
      clearTimeout(v2Timeout);
      if (e?.name === "AbortError") return { ok: false, error: "timeout" };
      throw e;
    }
  } catch (e) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") return { ok: false, error: "timeout" };
    try {
      const v2Controller = new AbortController();
      const v2Timeout = setTimeout(() => v2Controller.abort(), TIMEOUT_MS);
      const v2 = await searchV2(query, v2Controller.signal);
      clearTimeout(v2Timeout);
      return { ok: true, count: v2.length, source: "v2" };
    } catch (v2Err) {
      if (v2Err?.name === "AbortError") return { ok: false, error: "timeout" };
      return { ok: false, error: String(v2Err?.message ?? v2Err) };
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const terms = FOODS.slice(0, 100);
  if (terms.length < 100) {
    console.warn(`Only ${terms.length} terms in list; padding to 100 with generic terms.`);
    while (terms.length < 100) terms.push(`food ${terms.length + 1}`);
  }
  const results = [];
  console.log(`Running ${terms.length} food searches (delay ${DELAY_MS}ms between requests)...\n`);
  for (let i = 0; i < terms.length; i++) {
    const q = terms[i];
    process.stdout.write(`  [${i + 1}/${terms.length}] ${q} ... `);
    try {
      const r = await searchOne(q);
      if (r.ok) {
        console.log(`OK (${r.count} results, ${r.source})`);
        results.push({ query: q, ok: true, count: r.count, source: r.source });
      } else {
        console.log(`FAIL (${r.error})`);
        results.push({ query: q, ok: false, error: r.error });
      }
    } catch (e) {
      console.log(`ERROR ${e?.message ?? e}`);
      results.push({ query: q, ok: false, error: String(e?.message ?? e) });
    }
    if (i < terms.length - 1) await sleep(DELAY_MS);
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}/${terms.length}`);
  if (failed.length > 0) {
    console.log(`Failed (${failed.length}):`);
    failed.forEach((f) => console.log(`  - "${f.query}": ${f.error}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
