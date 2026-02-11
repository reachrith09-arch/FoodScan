import type { ProductResult } from "@/types/food";

let labelLookupResults: ProductResult[] = [];
let selectedProductForLabel: ProductResult | null = null;

export function setLabelLookupResults(products: ProductResult[]): void {
  labelLookupResults = products;
}

export function getLabelLookupResults(): ProductResult[] {
  return labelLookupResults;
}

export function setSelectedProductForLabel(product: ProductResult | null): void {
  selectedProductForLabel = product;
}

export function getSelectedProductForLabel(): ProductResult | null {
  return selectedProductForLabel;
}

export function clearSelectedProductForLabel(): void {
  selectedProductForLabel = null;
}
