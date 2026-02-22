import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, useColorScheme, View } from "react-native";
import { AlertTriangle, BarChart3 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getHealthProfile } from "@/lib/storage";
import { getLongTermExposureSummary } from "@/lib/long-term-exposure";
import { useScanResult } from "@/lib/use-scan-result";
import { THEME } from "@/lib/theme";

export default function ExposureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const { result, loading } = useScanResult(id);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>> | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [longTerm, setLongTerm] = React.useState<Awaited<ReturnType<typeof getLongTermExposureSummary>> | null>(null);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);
  React.useEffect(() => {
    if (!result) return;
    getLongTermExposureSummary(result.product).then(setLongTerm);
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

  const product = result.product;

  const cardStyle = {
    borderRadius: 16,
    padding: 18,
    backgroundColor: isDark ? "#18181b" : "#f8fafc",
    borderWidth: 1,
    borderColor: isDark ? "#262626" : "#e2e8f0",
    marginBottom: 12,
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Long-term exposure" onChatOpen={() => setChatOpen(true)} />
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
          <View className="flex-row items-center gap-2 mb-1">
            <BarChart3 size={20} color={THEME.primary} strokeWidth={2} />
            <Text className="text-base font-semibold" style={textWhite}>Additives & trends</Text>
          </View>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Additives and trends from your recent scans
          </Text>
          <View className="mt-4 gap-3">
            {longTerm && (
              <>
                {longTerm.topAdditivesThisWeek.length > 0 && (
                  <View style={cardStyle}>
                    <Text className="text-sm font-semibold" style={textWhite}>Top additives this week</Text>
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {longTerm.topAdditivesThisWeek.map((a) => (
                        <View
                          key={a.key}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 10,
                            backgroundColor: isDark ? "#0a0a0a" : "#f8fafc",
                            borderWidth: 1,
                            borderColor: isDark ? "#262626" : "#e2e8f0",
                          }}
                        >
                          <Text className="text-sm font-medium" style={textWhite}>{a.key}</Text>
                          <Text className="text-sm font-semibold" style={{ color: THEME.primary }}>{a.count}×</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {longTerm.flaggedAdditives.length > 0 && (
                  <View
                    style={{
                      ...cardStyle,
                      borderColor: "#f59e0b",
                      backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)",
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      <AlertTriangle size={18} color="#f59e0b" strokeWidth={2} />
                      <Text className="text-sm font-semibold" style={textWhite}>Watch — linked to your reaction logs</Text>
                    </View>
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {longTerm.flaggedAdditives.map((key) => (
                        <Text key={key} className="text-sm" style={textWhite}>
                          • {key}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.primary }} />
                  <Text className="text-xs text-muted-foreground" style={textMuted}>
                    {longTerm.daysWithScans} days with scans in the last 7 days
                  </Text>
                </View>
              </>
            )}
            {!longTerm && product.additives_tags && product.additives_tags.length > 0 && (
              <Text className="text-sm text-muted-foreground" style={textMuted}>
                This product contains: {product.additives_tags.map((a) => a.replace(/^en:/, "")).join(", ")}.
              </Text>
            )}
            {!longTerm && (!product.additives_tags || product.additives_tags.length === 0) && (
              <View style={{ padding: 24, alignItems: "center" }}>
                <BarChart3 size={40} color={isDark ? "#525252" : "#94a3b8"} strokeWidth={1.5} />
                <Text className="mt-3 text-center text-sm text-muted-foreground" style={textMuted}>
                  No additive data for this product. Scan more products to see exposure trends.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={product} analysis={result.analysis ?? undefined} profile={profile} />
    </View>
  );
}
