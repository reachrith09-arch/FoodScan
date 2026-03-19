/**
 * Common names for E-number food additives.
 * Keys are normalized (lowercase, no spaces).
 */
export const E_NUMBER_NAMES: Record<string, string> = {
  e102: "Tartrazine",
  e104: "Quinoline yellow",
  e110: "Sunset yellow",
  e120: "Cochineal",
  e122: "Carmoisine",
  e124: "Ponceau 4R",
  e129: "Allura red",
  e150a: "Plain caramel",
  e150b: "Caustic sulphite caramel",
  e150c: "Ammonia caramel",
  e150d: "Sulphite ammonia caramel",
  e160a: "Carotenes",
  e171: "Titanium dioxide",
  e200: "Sorbic acid",
  e202: "Potassium sorbate",
  e211: "Sodium benzoate",
  e212: "Potassium benzoate",
  e213: "Calcium benzoate",
  e220: "Sulphur dioxide",
  e250: "Sodium nitrite",
  e251: "Sodium nitrate",
  e300: "Ascorbic acid",
  e320: "BHA",
  e321: "BHT",
  e322: "Lecithin",
  e330: "Citric acid",
  e338: "Phosphoric acid",
  e415: "Xanthan gum",
  e500: "Sodium carbonate",
  e621: "MSG",
  e951: "Aspartame",
  e952: "Cyclamate",
  e955: "Sucralose",
};

/**
 * Get the common name for an E-number or additive tag.
 * Returns the name if found, otherwise returns the original key formatted nicely.
 */
export function getAdditiveDisplayName(key: string): string {
  const normalized = key.toLowerCase().replace(/\s+/g, "").trim();
  const name = E_NUMBER_NAMES[normalized];
  if (name) return name;
  // Fallback: capitalize first letter of each word
  return key
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
