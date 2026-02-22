import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, useColorScheme, View } from "react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getHealthProfile } from "@/lib/storage";
import { useScanResult } from "@/lib/use-scan-result";
import { THEME } from "@/lib/theme";

export default function DriversScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const { result, loading } = useScanResult(id);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>>>(null);
  const [chatOpen, setChatOpen] = React.useState(false);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);

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

  const drivers = result.analysis?.drivers ?? [];

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Top drivers" onChatOpen={() => setChatOpen(true)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 text-sm text-muted-foreground" style={textMuted}>
          Factors that most influence this product&apos;s health score.
        </Text>
        {drivers.length > 0 ? (
          <View className="gap-3">
            {drivers.map((d, i) => {
              const isPositive = d.impact > 0;
              const impactColor = isPositive ? (isDark ? "#4ade80" : THEME.primary) : (isDark ? "#f87171" : "#dc2626");
              return (
                <View
                  key={`${d.label}-${i}`}
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    backgroundColor: isDark ? "#18181b" : "#fff",
                    borderWidth: 1,
                    borderColor: isDark ? "#262626" : "#e5e7eb",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 pr-3">
                      {isPositive ? (
                        <TrendingUp size={20} color={impactColor} strokeWidth={2.5} />
                      ) : (
                        <TrendingDown size={20} color={impactColor} strokeWidth={2.5} />
                      )}
                      <Text className="font-semibold text-base" style={textWhite}>{d.label}</Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: isPositive
                          ? (isDark ? "rgba(74,222,128,0.15)" : "rgba(34,197,94,0.12)")
                          : (isDark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.1)"),
                      }}
                    >
                      <Text
                        className="text-sm font-bold"
                        style={{ color: impactColor }}
                      >
                        {d.impact > 0 ? `+${d.impact}` : d.impact}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-3 text-sm leading-5" style={textMuted}>{d.detail}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={{
              padding: 24,
              borderRadius: 16,
              backgroundColor: isDark ? "#18181b" : "#fff",
              borderWidth: 1,
              borderColor: isDark ? "#262626" : "#e5e7eb",
            }}
          >
            <Text className="text-center text-muted-foreground" style={textMuted}>
              No driver data available for this product.
            </Text>
          </View>
        )}
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={result.product} analysis={result.analysis ?? undefined} profile={profile} />
    </View>
  );
}
