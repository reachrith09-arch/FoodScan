import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { addToScanHistory, getHealthProfile } from "@/lib/storage";
import { analyzeProduct } from "@/lib/scoring";
import { searchProductsUnified, enrichProduct } from "@/lib/search-products-online";
import { getLabelLookupResults } from "@/lib/label-pick-store";
import { getDisplayProductName } from "@/lib/product-display";
import type { ProductResult, ScanResult } from "@/types/food";

export default function LabelPickScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [products, setProducts] = React.useState<ProductResult[]>(() =>
    getLabelLookupResults()
  );
  const [loading, setLoading] = React.useState(false);
  const [selecting, setSelecting] = React.useState(false);

  const params = useLocalSearchParams<{ q?: string; product?: string; brand?: string }>();
  const query = typeof params.q === "string" ? decodeURIComponent(params.q || "").trim() : "";
  const productParam = typeof params.product === "string" ? decodeURIComponent(params.product || "").trim() : "";
  const brandParam = typeof params.brand === "string" ? decodeURIComponent(params.brand || "").trim() : "";

  React.useEffect(() => {
    if (products.length > 0) return;
    if (!query) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getHealthProfile()
      .then((profile) =>
        searchProductsUnified(query, {
          pageSize: 30,
          countryCode: profile?.countryCode,
          brandText: brandParam || undefined,
        })
      )
      .then(async (list) => {
        if (!cancelled) {
          if (list.length === 0) {
            const profile = await getHealthProfile().catch(() => null);
            const fallback = await searchProductsUnified("", {
              pageSize: 30,
              countryCode: profile?.countryCode,
            });
            setProducts(fallback);
          } else {
            setProducts(list);
          }
        }
      })
      .catch((e) => {
        console.error("[LabelPick] search error:", e);
        if (!cancelled) {
          getHealthProfile()
            .then((profile) =>
              searchProductsUnified("", { pageSize: 30, countryCode: profile?.countryCode })
            )
            .then((fallback) => {
              if (!cancelled) setProducts(fallback);
            })
            .catch(() => {
              if (!cancelled) setProducts([]);
            });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, productParam, brandParam]);

  const onSelectProduct = async (product: ProductResult) => {
    setSelecting(true);
    try {
      const fullProduct = await enrichProduct(product);
      const profile = await getHealthProfile();
      const analysis = analyzeProduct(profile, fullProduct);
      const result: ScanResult = {
        id: `${Date.now()}-${fullProduct.code}`,
        timestamp: Date.now(),
        source: "label",
        barcode: fullProduct.code,
        product: fullProduct,
        healthRisks: analysis.healthRisks,
        analysis,
      };
      await addToScanHistory(result);
      router.replace(`/results/${result.id}`);
    } finally {
      setSelecting(false);
    }
  };

  const cardBg = isDark ? "#141414" : "#ffffff";
  const borderColor = isDark ? "#333" : "#e2e8f0";
  const mutedColor = isDark ? "#a1a1aa" : "#64748b";

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: isDark ? "#0a0a0a" : "#f8fafc",
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onPress={() => router.back()}
          accessibilityLabel="Back"
          className="rounded-xl border-border"
          style={isDark ? { borderColor: "#525252" } : undefined}
        >
          <ArrowLeft size={22} color={isDark ? "#f4f4f5" : "#18181b"} />
        </Button>
        <Text
          className="text-lg font-semibold"
          style={{ color: isDark ? "#f4f4f5" : "#18181b" }}
        >
          Pick a product
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {query ? (
        <Text className="mb-3 text-sm" style={{ color: mutedColor }}>
          Results for &quot;{query}&quot;
        </Text>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="mt-3 text-sm" style={{ color: mutedColor }}>
            Searching…
          </Text>
        </View>
      ) : products.length === 0 ? (
        <View
          style={{
            paddingVertical: 48,
            alignItems: "center",
            paddingHorizontal: 24,
            gap: 12,
          }}
        >
          <Text
            className="text-center text-base"
            style={{ color: mutedColor }}
          >
            No matches. Try a different name or brand, or check your connection.
          </Text>
          <Button
            variant="outline"
            onPress={() => router.back()}
          >
            <Text style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
              Back to label
            </Text>
          </Button>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {products.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => onSelectProduct(item)}
              disabled={selecting}
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View className="flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: isDark ? "#f4f4f5" : "#18181b" }}
                >
                  {getDisplayProductName(item)}
                </Text>
                {item.brands ? (
                  <Text className="mt-1 text-sm" style={{ color: mutedColor }}>
                    {item.brands}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={20} color={mutedColor} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {selecting && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="mt-2 text-sm text-white">Opening product…</Text>
        </View>
      )}
    </View>
  );
}
