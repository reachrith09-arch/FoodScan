import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, useColorScheme, View } from "react-native";
import { Beef, Candy, Droplets, Flame, FlaskConical, Scale, Wheat } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { ResultHeader } from "@/components/result-header";
import { Text } from "@/components/ui/text";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { getHealthProfile } from "@/lib/storage";
import { useUnits } from "@/lib/use-settings";
import { useScanResult } from "@/lib/use-scan-result";
import { THEME } from "@/lib/theme";

function NutrientRow({
  label,
  value,
  unit,
  isDark,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  isDark: boolean;
  icon?: React.ElementType;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: isDark ? "#18181b" : "#f8fafc",
        marginBottom: 8,
        borderWidth: 1,
        borderColor: isDark ? "#262626" : "#e2e8f0",
      }}
    >
      <View className="flex-row items-center gap-3">
        {Icon && <Icon size={22} color={isDark ? "#a1a1aa" : THEME.mutedGrey} strokeWidth={2} />}
        <Text className="text-base font-medium" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>{label}</Text>
      </View>
      <Text className="text-base font-semibold" style={{ color: isDark ? "#f4f4f5" : THEME.primary }}>
        {value} {unit}
      </Text>
    </View>
  );
}

export default function NutritionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const { result, loading } = useScanResult(id);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>> | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);
  const { units } = useUnits();

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

  const nut = result.product.nutriments;
  const hasNutriments = nut && (nut["energy-kcal_100g"] != null || nut.proteins != null || nut.carbohydrates != null || nut.fat != null);
  const calUnit = units === "imperial" ? "Cal" : "kcal";

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}>
      <ResultHeader display={result} title="Nutrition" onChatOpen={() => setChatOpen(true)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {hasNutriments ? (
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
            <Text className="text-lg font-semibold" style={textWhite}>
              Nutrition ({units === "imperial" ? "per 3.5 oz" : "per 100g"})
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>
              Macronutrients and key values from product data
            </Text>
            <View style={{ marginTop: 16 }}>
              <View className="gap-1">
                {nut!["energy-kcal_100g"] != null && (
                  <NutrientRow
                    label="Calories"
                    value={Math.round(nut["energy-kcal_100g"]!)}
                    unit={calUnit}
                    isDark={isDark}
                    icon={Flame}
                  />
                )}
                {nut!.proteins != null && (
                  <NutrientRow label="Protein" value={nut.proteins} unit="g" isDark={isDark} icon={Beef} />
                )}
                {nut!.carbohydrates != null && (
                  <NutrientRow label="Carbs" value={nut.carbohydrates} unit="g" isDark={isDark} icon={Wheat} />
                )}
                {nut!.fat != null && (
                  <NutrientRow label="Fat" value={nut.fat} unit="g" isDark={isDark} icon={Droplets} />
                )}
                {nut!.sodium_100g != null && (
                  <NutrientRow label="Sodium" value={Math.round(nut.sodium_100g)} unit="mg" isDark={isDark} icon={FlaskConical} />
                )}
                {nut!.sugars_100g != null && (
                  <NutrientRow label="Sugar" value={nut.sugars_100g} unit="g" isDark={isDark} icon={Candy} />
                )}
              </View>
              {result.product.serving_size && (
                <View
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.15)",
                  }}
                >
                  <Text className="text-sm font-medium" style={{ color: isDark ? "#86efac" : THEME.primary }}>
                    Serving size
                  </Text>
                  <Text className="mt-0.5 text-base" style={textWhite}>
                    {result.product.serving_size}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View
            style={{
              padding: 32,
              borderRadius: 20,
              backgroundColor: isDark ? "#18181b" : "#fff",
              borderWidth: 1,
              borderColor: isDark ? "#262626" : "#e5e7eb",
              alignItems: "center",
            }}
          >
            <Scale size={48} color={isDark ? "#525252" : "#94a3b8"} strokeWidth={1.5} />
            <Text className="mt-4 text-center text-muted-foreground" style={textMuted}>
              No nutrition data available for this product.
            </Text>
          </View>
        )}
      </ScrollView>
      <FoodAssistantChat visible={chatOpen} onClose={() => setChatOpen(false)} product={result.product} analysis={result.analysis ?? undefined} profile={profile} />
    </View>
  );
}
