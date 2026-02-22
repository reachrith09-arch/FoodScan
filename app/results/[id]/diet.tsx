import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, useColorScheme, View } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getHealthProfile } from "@/lib/storage";
import { useScanResult } from "@/lib/use-scan-result";
import { THEME } from "@/lib/theme";

function dietLabelDisplay(diet: string): string {
  return diet.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("-");
}

export default function DietScreen() {
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
        <Button className="mt-4" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  const analysis = result.analysis;

  const cardStyle = {
    borderRadius: 16,
    padding: 18,
    backgroundColor: isDark ? "#0a0a0a" : "#fff",
    borderWidth: 1,
    borderColor: isDark ? "#262626" : "#e5e7eb",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Diet & processing" onChatOpen={() => setChatOpen(true)} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        {analysis && (
          <>
            <View style={cardStyle}>
              <Text className="text-base font-semibold" style={textWhite}>Ultra-processed intensity</Text>
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDark ? "#18181b" : "#f8fafc",
                  borderWidth: 1,
                  borderColor: isDark ? "#333" : "#e2e8f0",
                }}
              >
                <Text className="text-lg font-bold" style={{ color: isDark ? "#f4f4f5" : THEME.primary }}>
                  {analysis.ultraProcessed.label.toUpperCase()}
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>
                  Score {analysis.ultraProcessed.score} · {analysis.ultraProcessed.rationale}
                </Text>
              </View>
            </View>

            {analysis.synergyWarnings.length > 0 && (
              <View style={cardStyle}>
                <Text className="text-base font-semibold" style={textWhite}>Potential additive combinations</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground" style={textMuted}>Rules-based synergy detection. Not medical advice.</Text>
                <View className="gap-2 mt-3">
                  {analysis.synergyWarnings.map((w, i) => (
                    <View
                      key={i}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isDark ? "#854d0e" : "#f59e0b",
                        backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.08)",
                      }}
                    >
                      <Text className="font-semibold" style={textWhite}>{w.title}</Text>
                      <Text className="mt-1.5 text-sm text-muted-foreground leading-5" style={textMuted}>{w.details}</Text>
                      <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>Confidence: {w.confidence}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {analysis.regulationComparisons.length > 0 && (
              <View style={cardStyle}>
                <Text className="text-base font-semibold" style={textWhite}>Regulation comparison</Text>
                <View className="gap-2 mt-3">
                  {analysis.regulationComparisons.map((r, i) => (
                    <View
                      key={i}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isDark ? "#18181b" : "#f8fafc",
                        borderWidth: 1,
                        borderColor: isDark ? "#333" : "#e2e8f0",
                      }}
                    >
                      <Text className="font-medium" style={textWhite}>{r.displayName}</Text>
                      <Text className="mt-1.5 text-sm text-muted-foreground" style={textMuted}>
                        US: {r.statusByRegion.US} · EU: {r.statusByRegion.EU} · UK: {r.statusByRegion.UK} · CA: {r.statusByRegion.CA}
                      </Text>
                      {r.note && <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>{r.note}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={cardStyle}>
              <Text className="text-base font-semibold" style={textWhite}>Diet compatibility</Text>
              <View className="gap-2 mt-3">
                {analysis.dietCompatibility.map((d) => (
                  <View
                    key={d.diet}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: d.compatible ? (isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)") : (isDark ? "rgba(220,38,38,0.08)" : "rgba(220,38,38,0.06)"),
                      borderWidth: 1,
                      borderColor: d.compatible ? (isDark ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.2)") : (isDark ? "rgba(220,38,38,0.25)" : "rgba(220,38,38,0.2)"),
                    }}
                  >
                    <View className="flex-1 pr-3">
                      <Text className="font-medium" style={textWhite}>{dietLabelDisplay(d.diet)}</Text>
                      {d.reason && <Text className="mt-0.5 text-xs text-muted-foreground" style={textMuted}>{d.reason}</Text>}
                    </View>
                    {d.compatible ? (
                      <CheckCircle2 size={24} color={THEME.primary} strokeWidth={2} />
                    ) : (
                      <XCircle size={24} color="#dc2626" strokeWidth={2} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={result.product} analysis={analysis ?? undefined} profile={profile} />
    </View>
  );
}
