import type { ProductResult } from "@/types/food";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCaseIfMostlyLowercase(input: string): string {
  const s = input.trim();
  if (!s) return s;
  const letters = s.replace(/[^a-zA-Z]/g, "");
  const lower = letters.replace(/[^a-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "");
  // If there are no letters or it's already mixed/upper, leave it.
  if (!letters || upper.length > lower.length * 0.4) return s;

  return s
    .split(/\s+/)
    .map((word) => {
      // Preserve e-numbers like e621, E621
      if (/^e\d{3,4}[a-z]?$/i.test(word)) return word.toUpperCase();
      // Preserve words with existing uppercase (brands/acronyms)
      if (/[A-Z]/.test(word)) return word;
      // Capitalize first letter
      return word.length ? word[0].toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

export function getDisplayBrand(product: ProductResult): string | null {
  const b = (product.brands ?? "").trim();
  if (!b) return null;
  // OFF often returns comma-separated brands; show the first.
  return b.split(",")[0]?.trim() || null;
}

export function getDisplayProductName(product: ProductResult): string {
  const raw = (
    product.product_name_en ??
    product.generic_name_en ??
    product.product_name ??
    product.generic_name ??
    ""
  ).trim();
  if (!raw) return "Unknown product";

  const brand = getDisplayBrand(product);
  let name = raw;

  // Remove duplicated brand from product name (common in some datasets).
  if (brand) {
    const n = normalize(name);
    const b = normalize(brand);
    if (b && n.includes(b)) {
      // Remove brand occurrences case-insensitively
      name = name.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), "").trim();
      name = name.replace(/^[\s\-–—,:]+|[\s\-–—,:]+$/g, "").trim();
    }
  }

  name = name.replace(/\s+/g, " ").trim();
  name = titleCaseIfMostlyLowercase(name);
  return name || "Unknown product";
}

