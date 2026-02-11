import type { ProductResult } from "@/types/food";
export { getIngredientDetail } from "@/data/ingredient-explanations";

/**
 * Returns true if the segment is likely NOT a food ingredient (metadata, URL, certification text, etc.).
 * Used to filter parsed ingredients_text so only actual ingredients are shown.
 */
export function isLikelyNonIngredient(segment: string): boolean {
  const s = segment.trim();
  if (!s || s.length < 2) return true;

  const lower = s.toLowerCase();

  // URL / web
  if (/^https?:\/\//i.test(s) || lower === "www" || /^www\./i.test(s)) return true;
  if (lower === "info" || lower === "contact" || lower === "see" || lower === "visit") return true;

  // Certification / trade text only (not "Fairtrade cocoa" which mentions an ingredient)
  if (/^\s*fairtrade\s*$/i.test(s)) return true;
  if (/^\s*fair\s*trade\s*$/i.test(s)) return true;
  if (/exclusion\s+of\s+water|excusion\s+of\s+water/i.test(s)) return true;
  if (/traded\s+in\s+(agreement|overeenstemming)|verhandeld\s+in\s+over/i.test(s)) return true;
  // Dutch: "coffee and sugar traded in agreement" (trade/origin statement, not an ingredient list item)
  if (/\b(koffie|coffee|suiker|sugar)\s+(en|and)\s+.*\s+verhandeld/i.test(s)) return true;
  if (/verhandeld\s+in\s+(overeenstemming|overent)/i.test(s)) return true;

  // Only numbers/symbols
  if (/^[\d\s.%\-()]+$/i.test(s.replace(/\s/g, ""))) return true;

  // Copyright / legal
  if (/^[©®™]\s*|^\s*[©®™]/.test(s)) return true;

  // Very short non-food tokens
  if (s.length <= 3 && !/^e\d{2,4}[a-z]?$/i.test(s) && !/^[a-z]{2,3}$/i.test(s)) return true;

  return false;
}

/**
 * Parse ingredients_text (comma/semicolon separated) into a list of ingredient strings.
 * Expands parenthesized groups so "X (a, b, c)" yields X, a, b, c for a fuller list.
 * Filters out segments that are clearly not ingredients (URLs, certification text, etc.).
 */
export function parseIngredientsList(ingredientsText: string | undefined): string[] {
  if (!ingredientsText || typeof ingredientsText !== "string") return [];
  const parts: string[] = [];
  // Split by comma/semicolon, but first expand parenthesized blocks into separate items
  const withParens = ingredientsText
    .replace(/\s*\(/g, " ( ")
    .replace(/\)\s*/g, " ) ");
  const tokens = withParens.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  function trimIng(s: string): string {
    return s
      .replace(/\s*\)\s*\.?\s*$/, "")
      .replace(/[.)\s]+$/, "")
      .replace(/^[\s(]+/, "")
      .trim();
  }
  for (const t of tokens) {
    const open = t.indexOf("(");
    if (open >= 0) {
      const before = trimIng(t.slice(0, open));
      const after = trimIng(t.slice(open + 1));
      if (before && !isLikelyNonIngredient(before)) parts.push(before);
      if (after && !isLikelyNonIngredient(after)) parts.push(after);
    } else {
      const cleaned = trimIng(t);
      if (cleaned && !isLikelyNonIngredient(cleaned)) parts.push(cleaned);
    }
  }
  return parts.length ? parts : ingredientsText
    .split(/[,;]/)
    .map((s) => trimIng(s))
    .filter(Boolean)
    .filter((s) => !isLikelyNonIngredient(s));
}

function looksFrench(text: string): boolean {
  // Simple heuristic: accents + common French label words.
  return (
    /[àâçéèêëîïôùûüÿœ]/i.test(text) ||
    /\b(farine|bl[eé]|eau|sucre|huile|sel|vinaigre|levure|ar[oô]me|extrait|peut contenir|traces|oeuf|lait|soja|s[eé]same)\b/i.test(
      text,
    )
  );
}

function replaceAllCI(input: string, re: RegExp, replacement: string): string {
  // Ensure global + case-insensitive.
  const flags = `${re.ignoreCase ? "i" : ""}g`;
  const rx = new RegExp(re.source, flags);
  return input.replace(rx, replacement);
}

/**
 * Best-effort French → English ingredient translation (display-only).
 * This is intentionally small and safe: it focuses on common label terms.
 */
export function translateIngredientToEnglish(ingredient: string): string {
  const s = ingredient.trim();
  if (!s) return s;
  if (!looksFrench(s)) return s;

  let out = s;

  // Phrases first (more specific → less specific).
  out = replaceAllCI(out, /\bfarine\s+de\s+bl[eé]\b/i, "wheat flour");
  out = replaceAllCI(out, /\bgluten\s+de\s+bl[eé]\b/i, "wheat gluten");
  out = replaceAllCI(out, /\bhuile\s+de\s+colza\b/i, "rapeseed oil");
  out = replaceAllCI(out, /\bfarine\s+de\s+f[eé]ves\b/i, "bean flour");
  out = replaceAllCI(out, /\bfruits\s*[àa]\s+coque\b/i, "tree nuts");
  out = replaceAllCI(out, /\bgraines\s+de\s+s[eé]same\b/i, "sesame seeds");
  out = replaceAllCI(out, /\bextrait\s+d['’]ac[eé]rola\b/i, "acerola extract");
  out = replaceAllCI(out, /\bpeut\s+contenir\s+des\s+traces\s+d['’]oeuf\b/i, "may contain traces of egg");
  out = replaceAllCI(out, /\bcontient\s+alcool\b/i, "contains alcohol");

  // Single words.
  out = replaceAllCI(out, /\beau\b/i, "water");
  out = replaceAllCI(out, /\bsucre\b/i, "sugar");
  out = replaceAllCI(out, /\bsel\b/i, "salt");
  out = replaceAllCI(out, /\bvinaigre\b/i, "vinegar");
  out = replaceAllCI(out, /\blevure\b/i, "yeast");
  out = replaceAllCI(out, /\bsoja\b/i, "soy");
  out = replaceAllCI(out, /\blait\b/i, "milk");
  out = replaceAllCI(out, /\boeuf\b/i, "egg");
  out = replaceAllCI(out, /\bar[oô]me\b/i, "flavoring");
  out = replaceAllCI(out, /\bbl[eé]\b/i, "wheat");
  out = replaceAllCI(out, /\bcolza\b/i, "rapeseed");

  // Normalize spaces around punctuation a bit.
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Best-effort translation of an ingredient string to English for lookup/display.
 * Handles French, Spanish, German, Dutch (common Open Food Facts languages) so
 * the app works for any product in any region.
 */
export function translateIngredientToEnglishMulti(ingredient: string): string {
  let s = ingredient.trim();
  if (!s) return s;
  const lower = s.toLowerCase().replace(/\s+/g, " ").trim();

  // Phrase replacements (order: longer first)
  const phrases: [RegExp | string, string][] = [
    ["lait ecreme", "skim milk"],
    ["lait ecrémé", "skim milk"],
    ["lait entier", "whole milk"],
    ["sucre de canne", "cane sugar"],
    ["leche desnatada", "skim milk"],
    ["leche entera", "whole milk"],
    ["azucar de cana", "cane sugar"],
    ["magere melk", "skim milk"],
    ["volle melk", "whole milk"],
    ["rietsuiker", "cane sugar"],
    ["magermilch", "skim milk"],
    ["vollmilch", "whole milk"],
    ["rohrzucker", "cane sugar"],
    ["natrium", "sodium"],
    ["kalium", "potassium"],
  ];
  let out = lower;
  for (const [from, to] of phrases) {
    const pattern = typeof from === "string" ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : from;
    out = out.replace(pattern, to);
  }

  // Single-word replacements (multi-language)
  const words: [RegExp | string, string][] = [
    // French
    [/\blait\b/gi, "milk"],
    [/\becreme\b|\bécrémé\b/gi, "skim"],
    [/\bcreme\b|\bcrème\b/gi, "cream"],
    [/\bcafe\b|\bcafé\b/gi, "coffee"],
    [/\beau\b/gi, "water"],
    [/\bsucre\b/gi, "sugar"],
    [/\bsel\b/gi, "salt"],
    [/\bhuile\b/gi, "oil"],
    [/\bfarine\b/gi, "flour"],
    [/\barome\b|\barôme\b/gi, "flavoring"],
    [/\bsoja\b/gi, "soy"],
    [/\boeuf\b/gi, "egg"],
    [/\bble\b|\bblé\b/gi, "wheat"],
    // Spanish
    [/\bleche\b/gi, "milk"],
    [/\bazucar\b|\bazúcar\b/gi, "sugar"],
    [/\bnata\b/gi, "cream"],
    [/\bcrema\b/gi, "cream"],
    [/\bcafe\b/gi, "coffee"],
    [/\bagua\b/gi, "water"],
    [/\bsal\b/gi, "salt"],
    [/\baceite\b/gi, "oil"],
    [/\bharina\b/gi, "flour"],
    [/\bsoja\b/gi, "soy"],
    [/\bhuevo\b/gi, "egg"],
    [/\btrigo\b/gi, "wheat"],
    // German
    [/\bmilch\b/gi, "milk"],
    [/\bzucker\b/gi, "sugar"],
    [/\bsahne\b/gi, "cream"],
    [/\bkaffee\b/gi, "coffee"],
    [/\bwasser\b/gi, "water"],
    [/\bsalz\b/gi, "salt"],
    [/\böl\b|\boel\b/gi, "oil"],
    [/\bmehl\b/gi, "flour"],
    [/\bsoja\b/gi, "soy"],
    [/\bei\b/gi, "egg"],
    [/\bweizen\b/gi, "wheat"],
    // Dutch
    [/\bmelk\b/gi, "milk"],
    [/\bsuiker\b/gi, "sugar"],
    [/\broom\b/gi, "cream"],
    [/\bkoffie\b/gi, "coffee"],
    [/\bwater\b/gi, "water"],
    [/\bzout\b/gi, "salt"],
    [/\bolie\b/gi, "oil"],
    [/\bmeel\b/gi, "flour"],
    [/\bsoja\b/gi, "soy"],
    [/\bei\b/gi, "egg"],
    [/\btarwe\b/gi, "wheat"],
  ];
  for (const [from, to] of words) {
    out = out.replace(from, to);
  }

  return out.replace(/\s+/g, " ").trim() || s;
}

export function translateIngredientsListToEnglish(ingredients: string[]): string[] {
  return ingredients.map(translateIngredientToEnglish);
}

function cleanupTag(tag: string): string {
  // Example: "en:wheat-flour" -> "wheat flour"
  const noPrefix = tag.replace(/^[a-z]{2,3}:/i, "");
  return noPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** First letter of each word caps, rest lowercase (e.g. "GELLAN GUM" → "Gellan gum"). */
export function toIngredientDisplayCase(input: string): string {
  const s = input.trim();
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((word) => {
      if (/^e\d{3,4}[a-z]?$/i.test(word)) return word.toUpperCase();
      const lower = word.toLowerCase();
      return lower.length ? lower[0].toUpperCase() + lower.slice(1) : word;
    })
    .join(" ");
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove duplicates and redundant entries: keep the more specific ingredient when one
 * is a substring of another (e.g. keep "Instant coffee", drop "Coffee").
 */
function deduplicateIngredients(raw: string[], display: string[]): { raw: string[]; display: string[] } {
  if (raw.length <= 1) return { raw, display };
  const normalized = raw.map(normalizeForCompare);
  const keep = new Set<number>();

  for (let i = 0; i < raw.length; i++) {
    const ni = normalized[i];
    let isSubsumed = false;
    for (let j = 0; j < raw.length; j++) {
      if (i === j) continue;
      const nj = normalized[j];
      if (ni === nj) {
        if (j < i) isSubsumed = true;
        break;
      }
      if (ni.length < nj.length && nj.includes(ni)) {
        isSubsumed = true;
        break;
      }
    }
    if (!isSubsumed) keep.add(i);
  }

  const indices = [...keep].sort((a, b) => a - b);
  return {
    raw: indices.map((i) => raw[i]),
    display: indices.map((i) => display[i]),
  };
}

export function getDisplayIngredientsFromProduct(product: ProductResult): {
  raw: string[];
  display: string[];
} {
  // Prefer OFF taxonomy tags when available: they’re canonical and usually English-ish.
  const textSource = product.ingredients_text_en ?? product.ingredients_text ?? "";
  const fromText = parseIngredientsList(textSource || undefined);
  const tags = product.ingredients_tags?.filter(Boolean) ?? [];
  const fromTags =
    tags.length > 0
      ? tags
          .map(cleanupTag)
          .filter(Boolean)
          .filter((s) => !isLikelyNonIngredient(s))
          .filter((v, i, arr) => arr.indexOf(v) === i)
      : [];
  const useTextFirst = fromText.length >= fromTags.length || fromTags.length === 0;
  const raw = useTextFirst ? fromText : fromTags;
  const display = raw.map((r) =>
    toIngredientDisplayCase(translateIngredientToEnglishMulti(r)),
  );
  return deduplicateIngredients(raw, display);
}
