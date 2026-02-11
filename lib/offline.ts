import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProductResult } from "@/types/food";

const KEYS = {
  PRODUCT_CACHE: "PRODUCT_CACHE",
  PENDING_BARCODES: "PENDING_BARCODES",
} as const;

type ProductCache = Record<string, { product: ProductResult; cachedAt: number }>;

type NetInfoModule = typeof import("@react-native-community/netinfo");
let netInfoModule: NetInfoModule | null | undefined;
function getNetInfo(): NetInfoModule | null {
  if (netInfoModule !== undefined) return netInfoModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    netInfoModule = require("@react-native-community/netinfo") as NetInfoModule;
    return netInfoModule;
  } catch {
    netInfoModule = null;
    return null;
  }
}

export async function isOnline(): Promise<boolean> {
  const NetInfo = getNetInfo();
  if (!NetInfo) return true; // best-effort fallback
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected);
}

async function loadCache(): Promise<ProductCache> {
  const raw = await AsyncStorage.getItem(KEYS.PRODUCT_CACHE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ProductCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCache(cache: ProductCache): Promise<void> {
  await AsyncStorage.setItem(KEYS.PRODUCT_CACHE, JSON.stringify(cache));
}

export async function getCachedProduct(barcode: string): Promise<ProductResult | null> {
  const code = String(barcode).trim();
  if (!code) return null;
  const cache = await loadCache();
  return cache[code]?.product ?? null;
}

export async function cacheProduct(product: ProductResult): Promise<void> {
  const code = String(product.code).trim();
  if (!code) return;
  const cache = await loadCache();
  cache[code] = { product, cachedAt: Date.now() };

  // Keep cache from growing indefinitely
  const entries = Object.entries(cache).sort((a, b) => b[1].cachedAt - a[1].cachedAt).slice(0, 200);
  const next: ProductCache = {};
  for (const [k, v] of entries) next[k] = v;
  await saveCache(next);
}

export async function addPendingBarcode(barcode: string): Promise<void> {
  const code = String(barcode).trim();
  if (!code) return;
  const raw = await AsyncStorage.getItem(KEYS.PENDING_BARCODES);
  const list = raw ? (JSON.parse(raw) as string[]) : [];
  const next = [code, ...(Array.isArray(list) ? list : [])].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 100);
  await AsyncStorage.setItem(KEYS.PENDING_BARCODES, JSON.stringify(next));
}

export async function getPendingBarcodes(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.PENDING_BARCODES);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function clearPendingBarcodes(codes: string[]): Promise<void> {
  const set = new Set(codes);
  const list = await getPendingBarcodes();
  const next = list.filter((c) => !set.has(c));
  await AsyncStorage.setItem(KEYS.PENDING_BARCODES, JSON.stringify(next));
}

