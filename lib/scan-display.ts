import { getDisplayBrand, getDisplayProductName } from "@/lib/product-display";
import type { ScanResult } from "@/types/food";

/** Scan saved from photo flow with explicit ingredient lines (AI + user). */
export function isScannedMeal(scan: ScanResult): boolean {
  return Array.isArray(scan.mealIngredients) && scan.mealIngredients.length > 0;
}

export function getScanResultTitle(scan: ScanResult): string {
  const dish = scan.mealDishSummary?.trim();
  if (dish) return dish;
  return getDisplayProductName(scan.product);
}

export function getScanResultSubtitle(scan: ScanResult): string {
  if (isScannedMeal(scan)) {
    const n = scan.mealIngredients?.length ?? 0;
    return `Scanned meal · ${n} ingredient${n === 1 ? "" : "s"}`;
  }
  return getDisplayBrand(scan.product) ?? "Unknown";
}
