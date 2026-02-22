import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, useColorScheme, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getDisplayBrand, getDisplayProductName } from "@/lib/product-display";
import { getSwapRecommendations, makeSwapScanResult } from "@/lib/swaps";
import { getHealthProfile } from "@/lib/storage";
import { addToScanHistory } from "@/lib/storage";
import { useScanResult } from "@/lib/use-scan-result";
import { THEME } from "@/lib/theme";

export default function SwapsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const { result, loading } = useScanResult(id);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>> | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [swaps, setSwaps] = React.useState<Awaited<ReturnType<typeof getSwapRecommendations>>>([]);
  const [loadingSwaps, setLoadingSwaps] = React.useState(true);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);
  React.useEffect(() => {
    if (!result) return;
    let mounted = true;
    (async () => {
      const profile = await getHealthProfile();
      const recs = await getSwapRecommendations(result.product, profile, 3);
      if (mounted) {
        setSwaps(recs);
        setLoadingSwaps(false);
      }
    })();
    return () => { mounted = false; };
  }, [result]);

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

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Smarter swaps" onChatOpen={() => setChatOpen(true)} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
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
          <Text className="mt-0.5 text-sm text-muted-foreground" style={textMuted}>Recommendations ranked by score</Text>
          <View className="gap-3 mt-4">
            {loadingSwaps && (
              <View className="flex-row items-center gap-2 py-6">
                <RefreshCw size={20} color={THEME.primary} strokeWidth={2} />
                <Text className="text-sm text-muted-foreground" style={textMuted}>Searching alternatives…</Text>
              </View>
            )}
            {!loadingSwaps && swaps.length === 0 && (
              <Text className="py-6 text-sm text-muted-foreground text-center" style={textMuted}>No alternatives found yet.</Text>
            )}
            {swaps.map((s) => (
              <Pressable
                key={s.product.code}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#333" : "#e2e8f0",
                  backgroundColor: isDark ? "#18181b" : "#f8fafc",
                }}
                onPress={async () => {
                  const profile = await getHealthProfile();
                  const scan = makeSwapScanResult(s.product, profile);
                  await addToScanHistory(scan);
                  router.replace(`/results/${scan.id}`);
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-semibold text-base" numberOfLines={2} ellipsizeMode="tail" style={textWhite}>
                      {getDisplayProductName(s.product)}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      backgroundColor: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.12)",
                    }}
                  >
                    <Text className="text-sm font-bold" style={{ color: THEME.primary }}>Score {s.score}</Text>
                  </View>
                </View>
                <Text className="mt-1.5 text-sm text-muted-foreground" style={textMuted}>{getDisplayBrand(s.product) ?? "Unknown"}</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground" style={textMuted}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={result.product} analysis={result.analysis ?? undefined} profile={profile} />
    </View>
  );
}
