import { clearPendingBarcodes, getPendingBarcodes, isOnline } from "@/lib/offline";
import { getProductByBarcode } from "@/lib/open-food-facts";

export async function syncPendingLookups(): Promise<{ attempted: number; resolved: number }> {
  const online = await isOnline().catch(() => true);
  if (!online) return { attempted: 0, resolved: 0 };
  const pending = await getPendingBarcodes();
  const resolved: string[] = [];
  for (const code of pending) {
    const product = await getProductByBarcode(code);
    if (product) resolved.push(code);
  }
  if (resolved.length) await clearPendingBarcodes(resolved);
  return { attempted: pending.length, resolved: resolved.length };
}

