import type { ProductResult } from "@/types/food";

let lastSearchProducts: ProductResult[] = [];

export function setLastSearchResults(products: ProductResult[]): void {
  lastSearchProducts = products;
}

export function getLastSearchResults(): ProductResult[] {
  return lastSearchProducts;
}
