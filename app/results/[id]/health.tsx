import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { ProFeaturePaywall } from "@/components/pro-feature-paywall";
import { ResultHeader } from "@/components/result-header";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { useSubscription } from "@/lib/revenuecat";
import { getHealthProfile } from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { useScanResult } from "@/lib/use-scan-result";

const severityConfig: Record<
  string,
  { border: string; bg: string; icon: typeof ShieldAlert }
> = {
  critical: { border: "#dc2626", bg: "rgba(220,38,38,0.1)", icon: ShieldAlert },
  warning: {
    border: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    icon: AlertTriangle,
  },
  info: { border: "#64748b", bg: "rgba(100,116,139,0.1)", icon: Info },
  good: { border: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: Info },
};

export default function HealthScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const {
    isPro,
    showPaywall,
    refresh: refreshSubscription,
  } = useSubscription();
  const { result, loading } = useScanResult(id);

  useFocusEffect(
    React.useCallback(() => {
      refreshSubscription();
    }, [refreshSubscription]),
  );
  const [profile, setProfile] = React.useState<Awaited<
    ReturnType<typeof getHealthProfile>
  > | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }
  if (!result) {
    return (
      <View
        className="flex-1 items-center justify-center p-4"
        style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}
      >
        <Text className="text-muted-foreground">Result not found.</Text>
        <Button className="mt-4" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  if (!isPro) {
    return (
      <ProFeaturePaywall
        title="Health insights"
        subtitle="Personalized feedback based on your allergies, conditions, and goals"
        featureName="Health insights"
        description="Upgrade to FoodScan Pro for personalized health insights, allergy alerts, and more."
        onClose={() => router.back()}
        onUnlock={async () => {
          const purchased = await showPaywall();
          if (purchased) refreshSubscription();
        }}
      />
    );
  }

  const healthRisks = result.healthRisks ?? result.analysis?.healthRisks ?? [];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}
    >
      <ResultHeader
        display={result}
        title="Health insights"
        onChatOpen={() => setChatOpen(true)}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/settings")}
          style={({ pressed }) => ({
            marginBottom: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? "#404040" : "#e4e4e7",
            backgroundColor: isDark ? "#18181b" : "#fafafa",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text className="text-sm leading-5" style={textMuted}>
            Citations and official sources are in{" "}
            <Text style={{ color: THEME.primary, fontWeight: "600" }}>
              Settings → Health information sources
            </Text>
            .
          </Text>
        </Pressable>
        {healthRisks.length > 0 ? (
          <View
            style={{
              borderRadius: 20,
              padding: 20,
              backgroundColor: isDark ? "#0a0a0a" : "#fff",
              borderWidth: 1,
              borderColor: isDark ? "#262626" : "#e5e7eb",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="font-semibold text-base" style={textWhite}>
              Personalized health insights
            </Text>
            <Text
              className="mt-0.5 text-muted-foreground text-sm"
              style={textMuted}
            >
              Based on your profile (allergies, conditions, goals)
            </Text>
            <View className="mt-4 gap-3">
              {healthRisks.map((r, i) => {
                const cfg = severityConfig[r.severity] ?? severityConfig.info;
                const Icon = cfg.icon;
                return (
                  <View
                    key={`${r.category}-${i}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 16,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: cfg.border,
                      backgroundColor: isDark
                        ? cfg.bg.replace("0.1", "0.12")
                        : cfg.bg,
                    }}
                  >
                    <Icon size={22} color={cfg.border} strokeWidth={2} />
                    <View className="flex-1">
                      <Text className="font-semibold" style={textWhite}>
                        {r.category}
                      </Text>
                      <Text
                        className="mt-1 text-sm leading-5"
                        style={textWhite}
                      >
                        {r.message}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View
            style={{
              padding: 28,
              borderRadius: 20,
              backgroundColor: isDark
                ? "rgba(34,197,94,0.08)"
                : "rgba(34,197,94,0.06)",
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(34,197,94,0.25)"
                : "rgba(34,197,94,0.2)",
              gap: 12,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Info size={24} color={THEME.primary} strokeWidth={2} />
              <Text
                className="font-semibold text-base"
                style={{ color: isDark ? "#86efac" : THEME.primary }}
              >
                No concerns from your profile
              </Text>
            </View>
            <Text className="text-sm leading-5" style={textMuted}>
              This product has no known allergens, conditions, or diet conflicts
              based on your Health Profile. Add allergies, conditions, or goals
              in Profile to get personalized insights.
            </Text>
          </View>
        )}
      </ScrollView>
      <FoodAssistantChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        product={result.product}
        analysis={result.analysis ?? undefined}
        profile={profile}
      />
    </View>
  );
}
