import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, useColorScheme, View } from "react-native";
import { ArrowRight, Lightbulb } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ProFeaturePaywall } from "@/components/pro-feature-paywall";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getLocalSwapTips, makeSwapScanResult } from "@/lib/swaps";
import type { LocalSwapTip } from "@/lib/swaps";
import { searchProductsUnified } from "@/lib/search-products-online";
import { analyzeProduct } from "@/lib/scoring";
import { getHealthProfile } from "@/lib/storage";
import { addToScanHistory } from "@/lib/storage";
import { useScanResult } from "@/lib/use-scan-result";
import { useSubscription } from "@/lib/revenuecat";
import { getDisplayProductName, getDisplayBrand } from "@/lib/product-display";
import type { ProductResult } from "@/types/food";
import { THEME } from "@/lib/theme";

interface RecommendedProduct {
  product: ProductResult;
  score: number;
  label: string;
  tipSuggestion: string;
}

export default function SwapsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
  const { isPro, showPaywall, refresh: refreshSubscription } = useSubscription();
  const { result, loading } = useScanResult(id);

  useFocusEffect(
    React.useCallback(() => {
      refreshSubscription();
    }, [refreshSubscription]),
  );
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>> | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [localTips, setLocalTips] = React.useState<LocalSwapTip[]>([]);
  const [recommended, setRecommended] = React.useState<RecommendedProduct[]>([]);
  const [loadingRecs, setLoadingRecs] = React.useState(true);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);

  React.useEffect(() => {
    if (!result) return;
    setLocalTips(getLocalSwapTips(result.product));
  }, [result]);

  React.useEffect(() => {
    if (localTips.length === 0) {
      setLoadingRecs(false);
      return;
    }
    let mounted = true;
    setLoadingRecs(true);

    const cleanQuery = (s: string) => s.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*—.*$/, "").replace(/e\.g\.\s*/gi, "").trim();

    const timeout = setTimeout(() => {
      if (mounted) setLoadingRecs(false);
    }, 12_000);

    (async () => {
      try {
        const p = await getHealthProfile();
        const seen = new Set<string>();
        const recs: RecommendedProduct[] = [];

        const uniqueQueries: { query: string; tip: LocalSwapTip }[] = [];
        const seenQueries = new Set<string>();
        for (const tip of localTips) {
          const q = cleanQuery(tip.suggestion);
          if (q && q.length >= 3 && !seenQueries.has(q.toLowerCase())) {
            seenQueries.add(q.toLowerCase());
            uniqueQueries.push({ query: q, tip });
          }
        }

        for (const { query, tip } of uniqueQueries.slice(0, 3)) {
          if (!mounted) break;
          try {
            const results = await searchProductsUnified(query, { pageSize: 3, countryCode: p?.countryCode });
            const best = results.find((r) => r.code && !seen.has(r.code) && r.product_name);
            if (best?.code) {
              seen.add(best.code);
              const analysis = analyzeProduct(p, best);
              recs.push({ product: best, score: analysis.overallScore, label: analysis.overallLabel, tipSuggestion: tip.suggestion });
            }
          } catch { /* skip this search */ }
        }

        if (mounted) {
          setRecommended(recs.sort((a, b) => b.score - a.score));
          setLoadingRecs(false);
          clearTimeout(timeout);
        }
      } catch {
        if (mounted) setLoadingRecs(false);
        clearTimeout(timeout);
      }
    })();

    return () => { mounted = false; clearTimeout(timeout); };
  }, [localTips]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }
  if (!result) {
    return (
      <View className="flex-1 items-center justify-center p-4" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
        <Text className="text-muted-foreground">Result not found.</Text>
        <Button className="mt-4" onPress={() => router.back()}><Text>Back</Text></Button>
      </View>
    );
  }

  if (!isPro) {
    return (
      <ProFeaturePaywall
        title="Smarter swaps"
        subtitle="Healthier alternatives and swap tips for this product"
        featureName="Smarter swaps"
        description="Upgrade to FoodScan Pro for healthier alternatives, swap recommendations, and more."
        onClose={() => router.back()}
        onUnlock={async () => {
          const purchased = await showPaywall();
          if (purchased) refreshSubscription();
        }}
      />
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Smarter swaps" onChatOpen={() => setChatOpen(true)} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: 8, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Healthier alternatives — tappable product cards from swap tip searches */}
        <View
          style={{
            borderRadius: 20,
            padding: 20,
            backgroundColor: isDark ? "#0a0a0a" : "#fff",
            borderWidth: 1,
            borderColor: isDark ? "#262626" : "#e5e7eb",
            ...THEME.shadowCard,
          }}
        >
          <Text className="text-base font-semibold" style={textWhite}>Healthier alternatives</Text>
          <Text className="mt-0.5 text-sm text-muted-foreground" style={textMuted}>Tap to view product details</Text>
          <View className="gap-3 mt-4">
            {loadingRecs && (
              <View className="items-center py-8 gap-3">
                <ActivityIndicator size="small" color={THEME.primary} />
                <Text className="text-sm text-muted-foreground" style={textMuted}>Finding products…</Text>
              </View>
            )}
            {!loadingRecs && recommended.length === 0 && (
              <Text className="py-4 text-sm text-muted-foreground text-center" style={textMuted}>No matching products found in the database.</Text>
            )}
            {recommended.map((rec) => (
              <Pressable
                key={rec.product.code}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#333" : "#e2e8f0",
                  backgroundColor: isDark ? "#18181b" : "#f8fafc",
                }}
                onPress={async () => {
                  const p = await getHealthProfile();
                  const scan = makeSwapScanResult(rec.product, p);
                  await addToScanHistory(scan);
                  router.push(`/results/${scan.id}`);
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-semibold text-sm" numberOfLines={2} ellipsizeMode="tail" style={textWhite}>
                      {getDisplayProductName(rec.product)}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1} style={textMuted}>
                      {getDisplayBrand(rec.product) ?? ""}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 10,
                        backgroundColor: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.12)",
                      }}
                    >
                      <Text className="text-xs font-bold" style={{ color: THEME.primary }}>{rec.score}</Text>
                    </View>
                    <ArrowRight size={14} color={isDark ? "#a1a1aa" : "#6b7280"} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Swap tips — reasoning & suggestions */}
        {localTips.length > 0 && (
          <View
            style={{
              borderRadius: 20,
              padding: 20,
              backgroundColor: isDark ? "#0a0a0a" : "#fff",
              borderWidth: 1,
              borderColor: isDark ? "#262626" : "#e5e7eb",
              ...THEME.shadowCard,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Lightbulb size={18} color="#eab308" />
              <Text className="text-base font-semibold" style={textWhite}>Swap tips</Text>
            </View>
            <Text className="mt-0.5 text-sm text-muted-foreground" style={textMuted}>Why these are better choices</Text>
            <View className="gap-3 mt-4">
              {localTips.map((tip, i) => (
                <View
                  key={`${tip.suggestion}-${i}`}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isDark ? "#262626" : "#e5e7eb",
                    backgroundColor: isDark ? "#18181b" : "#f8fafc",
                  }}
                >
                  <Text className="text-xs font-semibold" style={{ color: "#eab308", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {tip.original}
                  </Text>
                  <Text className="text-sm font-medium mt-1" style={textWhite}>
                    → {tip.suggestion}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-1" style={textMuted}>
                    {tip.reason}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={result.product} analysis={result.analysis ?? undefined} profile={profile} />
    </View>
  );
}
