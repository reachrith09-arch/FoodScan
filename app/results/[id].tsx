import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Share,
  useColorScheme,
  View,
} from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, HeartPulse, MessageCircle, Share2, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ScoreGauge } from "@/components/graphics/score-gauge";
import { SubscoreBars } from "@/components/graphics/subscore-bars";
import { ExpandableSection } from "@/components/expandable-section";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import {
  addFavorite,
  addToScanHistory,
  getFavorites,
  getFavoriteNote,
  getHealthProfile,
  getScanHistory,
  isFavorite,
  removeFavorite,
  setFavoriteNote,
  updateScanResult,
} from "@/lib/storage";
import { useUnits } from "@/lib/use-settings";
import type { MealType } from "@/types/food";
import { getDisplayIngredientsFromProduct, getIngredientDetail } from "@/lib/ingredients";
import { getSwapRecommendations, makeSwapScanResult, type SwapRecommendation } from "@/lib/swaps";
import { analyzeProduct } from "@/lib/scoring";
import { getDisplayBrand, getDisplayProductName } from "@/lib/product-display";
import type { HealthProfile, ScanResult } from "@/types/food";

function dietLabelDisplay(diet: string): string {
  return diet
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-");
}

function useScanResult(id: string | undefined): { result: ScanResult | null; loading: boolean } {
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

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
  const iconColor = isDark ? "#ffffff" : "#111827";
  const insets = useSafeAreaInsets();
  // Compact “nav bar” spacing (still notch-safe).
  const headerTopPad = React.useMemo(() => Math.max(0, insets.top - 34), [insets.top]);
  const headerRowHeight = 44;
  const headerHeight = React.useMemo(() => headerTopPad + headerRowHeight, [headerTopPad]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);
  const { result, loading } = useScanResult(id);
  const [display, setDisplay] = React.useState<ScanResult | null>(null);
  const [fav, setFav] = React.useState(false);
  const [favoriteNote, setFavoriteNoteState] = React.useState("");
  const [expandedIngredient, setExpandedIngredient] = React.useState<string | null>(null);
  const [swaps, setSwaps] = React.useState<SwapRecommendation[]>([]);
  const [loadingSwaps, setLoadingSwaps] = React.useState(false);
  const [profileExists, setProfileExists] = React.useState<boolean | null>(null);
  const [profile, setProfile] = React.useState<HealthProfile | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const { units } = useUnits();
  const displayRef = React.useRef<ScanResult | null>(null);

  React.useEffect(() => {
    setDisplay(result);
  }, [result]);

  React.useEffect(() => {
    displayRef.current = display;
  }, [display]);

  // Never auto-open chat; also ensure it closes when navigating to a new result.
  React.useEffect(() => {
    setChatOpen(false);
  }, [id]);

  // Chat is user-invoked (Ask button). We intentionally do not auto-open.

  // Always recompute analysis when result loads so health scores use the current formula (nutrition high=good, allergens low=good, processing low=good, diet fit high=good). With profile we personalize; without profile we still get full subscores.
  React.useEffect(() => {
    if (!result) return;
    let mounted = true;
    (async () => {
      const profile = await getHealthProfile();
      if (!mounted) return;
      setProfile(profile);
      setProfileExists(!!profile);
      const nextAnalysis = analyzeProduct(profile, result.product);
      const same = JSON.stringify(result.analysis ?? null) === JSON.stringify(nextAnalysis);
      if (same) return;
      const next: ScanResult = {
        ...result,
        analysis: nextAnalysis,
        healthRisks: nextAnalysis.healthRisks,
      };
      setDisplay(next);
      updateScanResult(next).catch(() => {});
    })();
    return () => {
      mounted = false;
    };
  }, [result]);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        const current = displayRef.current;
        if (!current) return;
        const profile = await getHealthProfile();
        if (!mounted) return;
        setProfile(profile);
        setProfileExists(!!profile);
        const nextAnalysis = analyzeProduct(profile, current.product);
        const same = JSON.stringify(current.analysis ?? null) === JSON.stringify(nextAnalysis);
        if (same) return;
        const next: ScanResult = {
          ...current,
          analysis: nextAnalysis,
          healthRisks: nextAnalysis.healthRisks,
        };
        setDisplay(next);
        updateScanResult(next).catch(() => {});
      })();
      return () => {
        mounted = false;
      };
    }, [id]),
  );

  React.useEffect(() => {
    if (!id) return;
    isFavorite(id).then(setFav);
  }, [id]);

  React.useEffect(() => {
    if (!display?.id || !fav) {
      setFavoriteNoteState("");
      return;
    }
    getFavoriteNote(display.id).then(setFavoriteNoteState);
  }, [display?.id, fav]);

  React.useEffect(() => {
    if (!display) return;
    let mounted = true;
    (async () => {
      setLoadingSwaps(true);
      const profile = await getHealthProfile();
      const recs = await getSwapRecommendations(display.product, profile, 3);
      if (mounted) setSwaps(recs);
      if (mounted) setLoadingSwaps(false);
    })().catch(() => {
      if (mounted) setLoadingSwaps(false);
    });
    return () => {
      mounted = false;
    };
  }, [display]);

  const toggleFavorite = async () => {
    if (!display) return;
    if (fav) {
      await removeFavorite(display.id);
      setFav(false);
    } else {
      await addFavorite(display);
      setFav(true);
    }
  };

  const setBarVisible = React.useCallback(
    (visible: boolean) => {
      if (visible === headerVisible.current) return;
      headerVisible.current = visible;
      Animated.timing(headerY, {
        toValue: visible ? 0 : -headerHeight,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [headerHeight, headerY],
  );

  const onScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;

      // Near top → keep visible.
      if (y < 10) {
        setBarVisible(true);
        return;
      }

      // Scroll down → hide; scroll up → show.
      if (dy > 12) setBarVisible(false);
      if (dy < -12) setBarVisible(true);
    },
    [setBarVisible],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={isDark ? { backgroundColor: "#000000" } : undefined}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!display) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4" style={isDark ? { backgroundColor: "#000000" } : undefined}>
        <Text className="text-center text-muted-foreground" style={textMuted}>Result not found.</Text>
        <Button className="mt-4" onPress={() => router.back()} style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}>
          <Text className="text-primary-foreground">Back</Text>
        </Button>
      </View>
    );
  }

  const { product, healthRisks } = display;
  const analysis = display.analysis;
  const { raw: ingredientsRaw, display: ingredients } = getDisplayIngredientsFromProduct(product);
  const severityColors = {
    critical: "border-error bg-error/10",
    warning: "border-warning bg-warning/10",
    info: "border-muted bg-muted/50",
    good: "border-success bg-success/10",
  };

  return (
    <View
      className="flex-1 bg-[#F3FBF7] dark:bg-background"
      style={isDark ? { backgroundColor: "#000000" } : undefined}
    >
      <Animated.View
        className="bg-card px-4"
        style={{
          height: headerHeight,
          paddingTop: headerTopPad,
          transform: [{ translateY: headerY }],
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ height: headerRowHeight }}>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={iconColor} />
          </Button>

          <View className="flex-row items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onPress={() => setChatOpen(true)}
              accessibilityLabel="Ask about this food"
            >
              <MessageCircle size={20} color={iconColor} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => router.push({ pathname: "/reaction", params: { scanId: display.id } })}
              accessibilityLabel="Log a body reaction"
            >
              <HeartPulse size={20} color={iconColor} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                const name = getDisplayProductName(product);
                const score = analysis?.overallScore ?? 0;
                Share.share({
                  message: `${name} — Health score: ${score}/100. Analyzed with FoodScan.`,
                  title: "FoodScan result",
                });
              }}
              accessibilityLabel="Share result"
            >
              <Share2 size={20} color={iconColor} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onPress={toggleFavorite}
              accessibilityLabel={fav ? "Remove from favorites" : "Save to favorites"}
            >
              <Star
                size={20}
                color={fav ? "#16a34a" : iconColor}
                fill={fav ? "#16a34a" : "transparent"}
              />
            </Button>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1 bg-[#F3FBF7] dark:bg-background"
        style={isDark ? { backgroundColor: "#000000" } : undefined}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, paddingTop: headerHeight + 4 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
      {(product.image_small_url || product.image_url) && (
        <View className="mb-3 overflow-hidden rounded-2xl bg-muted" style={{ height: 160 }}>
          <Image
            source={{ uri: product.image_small_url ?? product.image_url ?? undefined }}
            className="h-full w-full"
            contentFit="cover"
          />
        </View>
      )}
      <Text className="text-2xl font-semibold text-foreground" style={textWhite}>
        {getDisplayProductName(product)}
      </Text>
      <Text className="mt-1 text-muted-foreground" style={textMuted}>
        {getDisplayBrand(product) ?? "Unknown"}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        <Text className="text-xs text-muted-foreground self-center" style={textMuted}>Log as: </Text>
        {(["breakfast", "lunch", "dinner", "snack", "other"] as MealType[]).map((meal) => (
          <Pressable
            key={meal}
            onPress={async () => {
              const next = { ...display, mealType: meal };
              setDisplay(next);
              await updateScanResult(next);
            }}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor: display.mealType === meal ? "#16a34a" : isDark ? "#333" : "#e5e7eb",
              backgroundColor: display.mealType === meal ? "rgba(34,197,94,0.15)" : isDark ? "#1a1a1a" : "transparent",
            }}
          >
            <Text className="text-xs capitalize" style={{ color: display.mealType === meal ? "#16a34a" : isDark ? "#a1a1aa" : "#64748b" }}>{meal}</Text>
          </Pressable>
        ))}
      </View>

      {fav && display && (
        <View className="mt-3">
          <Text className="mb-1 text-xs text-muted-foreground" style={textMuted}>Note for this favorite</Text>
          <Input
            className="min-h-0 border-border bg-muted/30"
            value={favoriteNote}
            onChangeText={setFavoriteNoteState}
            onBlur={() => display.id && setFavoriteNote(display.id, favoriteNote)}
            placeholder="e.g. good for road trips"
            style={isDark ? { borderColor: "#525252", color: "#f4f4f5" } : undefined}
          />
        </View>
      )}

      {profileExists === false && (
        <Card className="mt-4 border-warning bg-warning/10">
          <CardHeader>
            <CardTitle style={textWhite}>Generic analysis</CardTitle>
            <Text className="text-sm text-muted-foreground" style={textMuted}>
              Create a Health Profile to unlock personalized allergy, condition, and goal-based feedback.
            </Text>
          </CardHeader>
          <CardContent className="gap-2">
            <Button onPress={() => router.push("/(tabs)/profile")} style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}>
              <Text className="text-primary-foreground">Create Health Profile</Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Health score</CardTitle>
            <Text className="text-sm text-muted-foreground" style={textMuted}>
              Overall and detailed scoring based on nutrition, additives, processing, diet fit, and your profile.
            </Text>
          </CardHeader>
          <CardContent className="gap-4">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 130 }}>
                <ScoreGauge
                  score={analysis.overallScore}
                  label={analysis.overallLabel.toUpperCase()}
                  size={130}
                  isDark={isDark}
                />
              </View>
              <View style={{ flex: 1, minWidth: 140, paddingLeft: 16 }}>
                <SubscoreBars subscores={analysis.subscores} isDark={isDark} />
              </View>
            </View>
            <ExpandableSection title="Why this score?" defaultOpen={false} isDark={isDark}>
              <Text className="text-sm text-muted-foreground" style={textMuted}>
                The score combines allergens, nutrition, additives, processing, and how well it fits your diet and profile.
                {analysis.drivers.length > 0 && (
                  <>
                    {" "}
                    Top factors: {analysis.drivers.slice(0, 3).map((d) => d.label).join(", ")}.
                  </>
                )}
              </Text>
            </ExpandableSection>
            {analysis.drivers.length > 0 && (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground" style={textWhite}>Top drivers</Text>
                {analysis.drivers.map((d, i) => (
                  <View key={`${d.label}-${i}`} className="rounded-lg border border-border bg-muted/30 p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-medium text-foreground" style={textWhite}>{d.label}</Text>
                      <Text className="text-xs text-muted-foreground" style={textMuted}>
                        {d.impact > 0 ? `+${d.impact}` : d.impact}
                      </Text>
                    </View>
                    <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>{d.detail}</Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Ultra-processed intensity</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            <Text className="text-foreground" style={textWhite}>
              Level: <Text className="font-semibold text-foreground" style={textWhite}>{analysis.ultraProcessed.label.toUpperCase()}</Text> (score {analysis.ultraProcessed.score})
            </Text>
            <Text className="text-sm text-muted-foreground" style={textMuted}>{analysis.ultraProcessed.rationale}</Text>
          </CardContent>
        </Card>
      )}

      {analysis && analysis.synergyWarnings.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Potential additive combinations</CardTitle>
            <Text className="text-sm text-muted-foreground">
              Rules-based “synergy” detection. Not medical advice.
            </Text>
          </CardHeader>
          <CardContent className="gap-2">
            {analysis.synergyWarnings.map((w, i) => (
              <View key={`${w.title}-${i}`} className="rounded-lg border border-warning bg-warning/10 p-3">
                <Text className="font-medium text-foreground" style={textWhite}>{w.title}</Text>
                <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>{w.details}</Text>
                <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>Confidence: {w.confidence}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {analysis && analysis.regulationComparisons.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Regulation comparison (seed data)</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {analysis.regulationComparisons.map((r, i) => (
              <View key={`${r.ingredientKey}-${i}`} className="rounded-lg border border-border bg-muted/30 p-3">
                <Text className="font-medium text-foreground" style={textWhite}>{r.displayName}</Text>
                <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>
                  US: {r.statusByRegion.US} · EU: {r.statusByRegion.EU} · UK: {r.statusByRegion.UK} · CA: {r.statusByRegion.CA}
                </Text>
                {r.note && <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>{r.note}</Text>}
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Diet compatibility</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {analysis.dietCompatibility.map((d) => (
              <View key={d.diet} className="flex-row items-start justify-between rounded-lg border border-border bg-muted/30 p-3">
                <View className="flex-1 pr-3">
                  <Text className="font-medium text-foreground" style={textWhite}>{dietLabelDisplay(d.diet)}</Text>
                  {d.reason && <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>{d.reason}</Text>}
                </View>
                <Text className={d.compatible ? "text-success-foreground" : "text-error-foreground"} style={textWhite}>
                  {d.compatible ? "OK" : "NO"}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle style={textWhite}>Smarter swaps</CardTitle>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Healthier alternative recommendations (heuristic ranking).
          </Text>
        </CardHeader>
        <CardContent className="gap-2">
          {loadingSwaps && (
            <Text className="text-sm text-muted-foreground" style={textMuted}>Searching alternatives…</Text>
          )}
          {!loadingSwaps && swaps.length === 0 && (
            <Text className="text-sm text-muted-foreground" style={textMuted}>No alternatives found yet.</Text>
          )}
          {swaps.map((s) => (
            <Pressable
              key={s.product.code}
              className="rounded-lg border border-border bg-muted/30 p-3"
              style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}
              onPress={async () => {
                const profile = await getHealthProfile();
                const scan = makeSwapScanResult(s.product, profile);
                await addToScanHistory(scan);
                router.push(`/results/${scan.id}`);
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text
                    className="font-medium text-foreground"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={textWhite}
                  >
                    {getDisplayProductName(s.product)}
                  </Text>
                </View>
                <Text className="shrink-0 text-xs text-muted-foreground" style={textMuted}>Score {s.score}</Text>
              </View>
              <Text className="text-xs text-muted-foreground" style={textMuted}>
                {getDisplayBrand(s.product) ?? "Unknown"}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground" style={textMuted}>
                Label: {s.label}
              </Text>
            </Pressable>
          ))}
        </CardContent>
      </Card>

      {product.nutriments && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>
              Nutrition ({units === "imperial" ? "per 3.5 oz" : "per 100g"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="flex-row flex-wrap gap-4">
              {product.nutriments["energy-kcal_100g"] != null && (
                <Text className="text-foreground" style={textWhite}>
                  Calories: {Math.round(product.nutriments["energy-kcal_100g"])}{" "}
                  {units === "imperial" ? "Cal" : "kcal"}
                </Text>
              )}
              {product.nutriments.proteins != null && (
                <Text className="text-foreground" style={textWhite}>Protein: {product.nutriments.proteins}g</Text>
              )}
              {product.nutriments.carbohydrates != null && (
                <Text className="text-foreground" style={textWhite}>Carbs: {product.nutriments.carbohydrates}g</Text>
              )}
              {product.nutriments.fat != null && (
                <Text className="text-foreground" style={textWhite}>Fat: {product.nutriments.fat}g</Text>
              )}
              {product.nutriments.sodium_100g != null && (
                <Text className="text-foreground" style={textWhite}>
                  Sodium: {Math.round(product.nutriments.sodium_100g)} mg
                </Text>
              )}
              {product.nutriments.sugars_100g != null && (
                <Text className="text-foreground" style={textWhite}>Sugar: {product.nutriments.sugars_100g}g</Text>
              )}
            </View>
            {product.serving_size && (
              <Text className="mt-2 text-sm text-muted-foreground" style={textMuted}>
                Serving size: {product.serving_size}
              </Text>
            )}
          </CardContent>
        </Card>
      )}

      {healthRisks.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Health insights</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {healthRisks.map((r, i) => (
              <View
                key={`${r.category}-${i}`}
                className={`rounded-lg border p-3 ${severityColors[r.severity]}`}
              >
                <Text className="font-medium text-foreground" style={textWhite}>{r.category}</Text>
                <Text className="text-sm text-foreground" style={textWhite}>{r.message}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {ingredients.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle style={textWhite}>Ingredients</CardTitle>
            <Text className="text-xs text-muted-foreground mt-1" style={textMuted}>
              From product data; check the package for the official list.
            </Text>
          </CardHeader>
          <CardContent className="gap-2">
            {ingredients.map((ing, i) => {
              const raw = ingredientsRaw[i] ?? ing;
              const detail = getIngredientDetail(raw) ?? getIngredientDetail(ing);
              const isExpanded = expandedIngredient === raw;
              return (
                <View
                  key={`${raw}-${i}`}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isDark ? "#404040" : "#d4d4d8",
                    backgroundColor: isDark ? "#18181b" : "#f4f4f5",
                    padding: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setExpandedIngredient(isExpanded ? null : raw)
                    }
                  >
                    <Text className="font-medium text-foreground" style={textWhite}>{ing}</Text>
                    {detail && (
                      <Text className="text-xs text-muted-foreground mt-0.5" style={textMuted}>
                        {isExpanded ? "Tap to collapse" : "Tap for details"}
                      </Text>
                    )}
                  </Pressable>
                  {detail && isExpanded && (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: isDark ? "#404040" : "#e4e4e7", paddingTop: 10 }}>
                      <Text className="text-sm text-foreground" style={textWhite}>
                        {detail.plainDescription}
                      </Text>
                      <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>
                        Typical use: {detail.typicalUse}
                      </Text>
                      <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>
                        {detail.healthConsideration}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </CardContent>
        </Card>
      )}

      <FoodAssistantChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        product={product}
        analysis={analysis ?? undefined}
        profile={profile}
      />
      </Animated.ScrollView>
    </View>
  );
}
