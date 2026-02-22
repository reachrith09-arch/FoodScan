import * as React from "react";
import { getFavorites, getScanHistory } from "@/lib/storage";
import type { ScanResult } from "@/types/food";

export function useScanResult(id: string | undefined): { result: ScanResult | null; loading: boolean } {
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [loading, setLoading] = React.useState(!!id);

  React.useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const [history, favorites] = await Promise.all([
        getScanHistory(),
        getFavorites(),
      ]);
      const found = [...history, ...favorites].find((r) => r.id === id) ?? null;
      if (mounted) {
        setResult(found);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return { result, loading };
}
