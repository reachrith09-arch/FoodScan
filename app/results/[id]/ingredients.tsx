import { useLocalSearchParams, useRouter } from "expo-router";
import { List } from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { IngredientsDropdown } from "@/components/ingredients-dropdown";
import { ResultHeader } from "@/components/result-header";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import {
  getDisplayIngredientsFromProduct,
  getIngredientDetail,
} from "@/lib/ingredients";
import { lookupProductOnline } from "@/lib/lookup-product-online";
import { confidenceLabel } from "@/lib/recognize-food";
import { isScannedMeal } from "@/lib/scan-display";
import { getHealthProfile } from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { useScanResult } from "@/lib/use-scan-result";
import type { ProductResult } from "@/types/food";

export default function IngredientsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const textWhite = isDark ? { color: "#ffffff" } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" } : undefined;
  const { result, loading } = useScanResult(id);
  const [profile, setProfile] =
    React.useState<Awaited<ReturnType<typeof getHealthProfile>>>(null);

  const [chatOpen, setChatOpen] = React.useState(false);
  const [enrichedProduct, setEnrichedProduct] =
    React.useState<ProductResult | null>(null);
  const [fetchingEnriched, setFetchingEnriched] = React.useState(false);

  React.useEffect(() => {
    getHealthProfile().then(setProfile);
  }, []);

  React.useEffect(() => {
    if (!result || !result.product) return;
    const { raw } = getDisplayIngredientsFromProduct(result.product);
    if (raw.length > 0) return;
    const q = [result.product.product_name, result.product.brands]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!q) return;
    setFetchingEnriched(true);
    lookupProductOnline(q)
      .then((p) => p && setEnrichedProduct(p))
      .finally(() => setFetchingEnriched(false));
  }, [result]);

  const productToUse = React.useMemo(() => {
    if (enrichedProduct) {
      const { raw } = getDisplayIngredientsFromProduct(enrichedProduct);
      if (raw.length > 0) return enrichedProduct;
    }
    return result?.product ?? null;
  }, [result?.product, enrichedProduct]);

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

  const { raw: ingredientsRaw, display: ingredients } =
    getDisplayIngredientsFromProduct(productToUse ?? result.product);
  const mealScan = isScannedMeal(result);
  const mealLines = result.mealIngredients ?? [];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? "#000" : THEME.bgLight }}
    >
      <ResultHeader
        display={result}
        title="Ingredients"
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
        {mealScan && mealLines.length > 0 ? (
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
            <View className="mb-1 flex-row items-center gap-2">
              <List size={20} color={THEME.primary} strokeWidth={2} />
              <Text className="font-semibold text-base" style={textWhite}>
                Your ingredients
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm" style={textMuted}>
              Lines from your AI scan and confirm step — not a packaged product
              ingredient list.
            </Text>
            <View style={{ marginTop: 16 }}>
              {mealLines.map((line, idx) => (
                <View
                  key={`${line.name}-${idx}`}
                  style={{
                    paddingVertical: 14,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: isDark ? "#262626" : "#f4f4f5",
                  }}
                >
                  <Text className="font-medium text-base" style={textWhite}>
                    {line.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 6,
                    }}
                  >
                    {line.portion ? (
                      <Text
                        className="text-muted-foreground text-sm"
                        style={textMuted}
                      >
                        {line.portion}
                      </Text>
                    ) : null}
                    {line.confidence != null ? (
                      <Text
                        className="text-muted-foreground text-sm"
                        style={textMuted}
                      >
                        {line.confidence}% · {confidenceLabel(line.confidence)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : ingredients.length > 0 ? (
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
            <View className="mb-1 flex-row items-center gap-2">
              <List size={20} color={THEME.primary} strokeWidth={2} />
              <Text className="font-semibold text-base" style={textWhite}>
                Ingredients
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm" style={textMuted}>
              From product data; check the package for the official list.
            </Text>
            <View style={{ marginTop: 16 }}>
              <IngredientsDropdown
                ingredients={ingredients}
                ingredientsRaw={ingredientsRaw}
                getDetail={getIngredientDetail}
                isDark={isDark}
                profile={profile}
              />
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
            <List
              size={48}
              color={isDark ? "#525252" : "#94a3b8"}
              strokeWidth={1.5}
            />
            {fetchingEnriched ? (
              <Text
                className="mt-4 text-center text-muted-foreground"
                style={textMuted}
              >
                Looking up ingredients…
              </Text>
            ) : (
              <Text
                className="mt-4 text-center text-muted-foreground"
                style={textMuted}
              >
                No ingredients data available. Scan the barcode or add them on
                the label screen for full details.
              </Text>
            )}
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
