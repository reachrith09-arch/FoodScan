import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  BarChart3,
  Crown,
  Flame,
  HeartPulse,
  List,
  MessageCircle,
  RefreshCw,
  Share2,
  Star,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpandableSection } from "@/components/expandable-section";
import { FoodAssistantChat } from "@/components/food-assistant-chat";
import { ScoreGauge } from "@/components/graphics/score-gauge";
import { SubscoreBars } from "@/components/graphics/subscore-bars";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getContextNote, getScanContext } from "@/lib/context-aware";
import { getDisplayProductName } from "@/lib/product-display";
import { useSubscription } from "@/lib/revenuecat";
import {
  getScanResultSubtitle,
  getScanResultTitle,
  isScannedMeal,
} from "@/lib/scan-display";
import { analyzeProduct } from "@/lib/scoring";
import {
  addFavorite,
  getFavoriteNote,
  getHealthProfile,
  isFavorite,
  removeFavorite,
  setFavoriteNote,
  updateScanResult,
} from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { useScanResult } from "@/lib/use-scan-result";
import type { HealthProfile, MealType, ScanResult } from "@/types/food";

const PRO_SECTIONS = new Set(["swaps", "health"]);

const SECTION_BUTTONS = [
  { key: "drivers", label: "Top drivers", route: "drivers", Icon: TrendingUp },
  { key: "diet", label: "Diet", route: "diet", Icon: UtensilsCrossed },
  { key: "swaps", label: "Swaps", route: "swaps", Icon: RefreshCw },
  { key: "nutrition", label: "Nutrition", route: "nutrition", Icon: Flame },
  { key: "health", label: "Health", route: "health", Icon: HeartPulse },
  {
    key: "ingredients",
    label: "Ingredients",
    route: "ingredients",
    Icon: List,
  },
  { key: "exposure", label: "Exposure", route: "exposure", Icon: BarChart3 },
] as const;

export default function ResultIndexScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
  const iconColor = isDark ? "#ffffff" : "#111827";
  const insets = useSafeAreaInsets();
  const headerRowHeight = 44;
  const headerHeight = headerRowHeight;

  const { result, loading } = useScanResult(id);
  const { isPro, refresh: refreshSubscription } = useSubscription();

  useFocusEffect(
    React.useCallback(() => {
      refreshSubscription();
    }, [refreshSubscription]),
  );
  const [display, setDisplay] = React.useState<ScanResult | null>(null);
  const [fav, setFav] = React.useState(false);
  const [favoriteNote, setFavoriteNoteState] = React.useState("");
  const [profileExists, setProfileExists] = React.useState<boolean | null>(
    null,
  );
  const [profile, setProfile] = React.useState<HealthProfile | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [contextNote, setContextNote] = React.useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = React.useState(false);

  React.useEffect(() => {
    setDisplay(result);
  }, [result]);

  React.useEffect(() => {
    setChatOpen(false);
  }, [id]);

  React.useEffect(() => {
    if (!result) return;
    let mounted = true;
    (async () => {
      const p = await getHealthProfile();
      if (!mounted) return;
      setProfile(p);
      setProfileExists(!!p);
      const nextAnalysis = analyzeProduct(p, result.product);
      const same =
        JSON.stringify(result.analysis ?? null) ===
        JSON.stringify(nextAnalysis);
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
      const [ctx, p] = await Promise.all([
        getScanContext(display.mealType, display.timestamp),
        getHealthProfile(),
      ]);
      if (!mounted) return;
      setContextNote(getContextNote(ctx, p));
    })();
    return () => {
      mounted = false;
    };
  }, [display?.id, display?.mealType]);

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

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={isDark ? { backgroundColor: "#000000" } : undefined}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!display) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background p-4"
        style={isDark ? { backgroundColor: "#000000" } : undefined}
      >
        <Text className="text-center text-muted-foreground" style={textMuted}>
          Result not found.
        </Text>
        <Button
          className="mt-4"
          onPress={() => router.back()}
          style={
            isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined
          }
        >
          <Text className="text-primary-foreground">Back</Text>
        </Button>
      </View>
    );
  }

  const { product } = display;
  const analysis = display.analysis;
  const scannedMeal = isScannedMeal(display);
  const heroTitle = getScanResultTitle(display);
  const heroSubtitle = getScanResultSubtitle(display);
  const expandImageUri = scannedMeal
    ? (display.mealPhotoUri ??
      product.image_url ??
      product.image_small_url ??
      undefined)
    : (product.image_url ?? product.image_small_url ?? undefined);

  const shareMessage = () => {
    const score = analysis?.overallScore ?? 0;
    if (scannedMeal && display.mealIngredients?.length) {
      const lines = display.mealIngredients
        .map((i) => `• ${i.name}${i.portion ? ` (${i.portion})` : ""}`)
        .join("\n");
      return `${heroTitle}\nHealth score: ${score}/100\n\n${lines}\n\nAnalyzed with FoodScan.`;
    }
    return `${getDisplayProductName(product)} — Health score: ${score}/100. Analyzed with FoodScan.`;
  };

  return (
    <View
      className="flex-1 bg-[#F3FBF7] dark:bg-background"
      style={isDark ? { backgroundColor: "#000000" } : undefined}
    >
      <View
        className="bg-card px-4"
        style={{
          height: headerHeight,
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
          justifyContent: "center",
        }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{ height: headerRowHeight }}
        >
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
              onPress={() =>
                router.push({
                  pathname: "/reaction",
                  params: { scanId: display.id },
                })
              }
              accessibilityLabel="Log a body reaction"
            >
              <HeartPulse size={20} color={iconColor} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                Share.share({
                  message: shareMessage(),
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
              accessibilityLabel={
                fav ? "Remove from favorites" : "Save to favorites"
              }
            >
              <Star
                size={20}
                color={fav ? "#16a34a" : iconColor}
                fill={fav ? "#16a34a" : "transparent"}
              />
            </Button>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          paddingTop: headerHeight + 4,
        }}
      >
        {/* Hero: scanned meal (photo or icon) vs packaged product thumbnail */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {scannedMeal ? (
            display.mealPhotoUri ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => expandImageUri && setImageExpanded(true)}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: "#e5e7eb",
                  flexShrink: 0,
                }}
              >
                <Image
                  source={{ uri: display.mealPhotoUri }}
                  style={{ width: 64, height: 64 }}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  flexShrink: 0,
                  backgroundColor: isDark
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(22,128,61,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed
                  size={30}
                  color={THEME.primary}
                  strokeWidth={2}
                />
              </View>
            )
          ) : product.image_small_url || product.image_url ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setImageExpanded(true)}
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#e5e7eb",
                flexShrink: 0,
              }}
            >
              <Image
                source={{
                  uri:
                    product.image_small_url ?? product.image_url ?? undefined,
                }}
                style={{ width: 64, height: 64 }}
                contentFit="cover"
              />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              className="font-bold text-foreground"
              style={[textWhite, { fontSize: 26, lineHeight: 32 }]}
            >
              {heroTitle}
            </Text>
            <Text
              className="text-muted-foreground"
              style={[textMuted, { fontSize: 16, marginTop: 2 }]}
            >
              {heroSubtitle}
            </Text>
          </View>
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Text
            className="self-center text-muted-foreground text-xs"
            style={textMuted}
          >
            Log as:{" "}
          </Text>
          {(
            ["breakfast", "lunch", "dinner", "snack", "other"] as MealType[]
          ).map((meal) => (
            <Pressable
              key={meal}
              onPress={async () => {
                const next = { ...display, mealType: meal };
                setDisplay(next);
                await updateScanResult(next);
              }}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor:
                  display.mealType === meal
                    ? "#16a34a"
                    : isDark
                      ? "#333"
                      : "#e5e7eb",
                backgroundColor:
                  display.mealType === meal
                    ? "rgba(34,197,94,0.15)"
                    : isDark
                      ? "#1a1a1a"
                      : "transparent",
              }}
            >
              <Text
                className="text-xs capitalize"
                style={{
                  color:
                    display.mealType === meal
                      ? "#16a34a"
                      : isDark
                        ? "#a1a1aa"
                        : "#64748b",
                }}
              >
                {meal}
              </Text>
            </Pressable>
          ))}
        </View>

        {fav && display && (
          <View className="mt-3">
            <Text
              className="mb-1 text-muted-foreground text-xs"
              style={textMuted}
            >
              Note for this favorite
            </Text>
            <Input
              className="min-h-0 border-border bg-muted/30"
              value={favoriteNote}
              onChangeText={setFavoriteNoteState}
              onBlur={() =>
                display.id && setFavoriteNote(display.id, favoriteNote)
              }
              placeholder="e.g. good for road trips"
              style={
                isDark
                  ? { borderColor: "#525252", color: "#f4f4f5" }
                  : undefined
              }
            />
          </View>
        )}

        {profileExists === false && (
          <Card className="mt-4 border-warning bg-warning/10">
            <CardHeader>
              <CardTitle style={textWhite}>Generic analysis</CardTitle>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Create a Health Profile to unlock personalized allergy,
                condition, and goal-based feedback.
              </Text>
            </CardHeader>
            <CardContent className="gap-2">
              <Button
                onPress={() => router.push("/(tabs)/profile")}
                style={
                  isDark
                    ? { borderWidth: 1, borderColor: "#525252" }
                    : undefined
                }
              >
                <Text className="text-primary-foreground">
                  Create Health Profile
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <Card
            className="mt-4"
            style={{
              backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
              overflow: "hidden",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle style={[textWhite, { fontSize: 18 }]}>
                Health score
              </CardTitle>
              {contextNote && (
                <Text
                  className="mt-1 text-muted-foreground text-xs"
                  style={textMuted}
                >
                  {contextNote}
                </Text>
              )}
              <Text
                className="mt-1.5 text-muted-foreground text-sm leading-5"
                style={textMuted}
              >
                {scannedMeal
                  ? "Estimated from your ingredient list and portions (not a single packaged product label), plus additives, processing, diet fit, and your profile."
                  : "Overall and detailed scoring based on nutrition, additives, processing, diet fit, and your profile."}
              </Text>
            </CardHeader>
            <CardContent className="gap-6 pb-6">
              <View
                style={{
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor:
                    analysis.overallScore >= 75
                      ? isDark
                        ? "rgba(34,197,94,0.06)"
                        : "rgba(22,128,61,0.05)"
                      : "transparent",
                }}
              >
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <ScoreGauge
                    score={analysis.overallScore}
                    label={analysis.overallLabel.toUpperCase()}
                    size={140}
                    isDark={isDark}
                  />
                </View>
                <View style={{ width: "100%", paddingHorizontal: 4 }}>
                  <SubscoreBars
                    subscores={analysis.subscores}
                    isDark={isDark}
                  />
                </View>
              </View>
              <ExpandableSection
                title="Why this score?"
                defaultOpen={false}
                isDark={isDark}
              >
                <Text
                  className="text-muted-foreground text-sm"
                  style={textMuted}
                >
                  {scannedMeal
                    ? "Each ingredient is modeled with typical nutrition for its category, then blended by portion. Additives and processing reflect that combined estimate."
                    : "The score combines allergens, nutrition, additives, processing, and how well it fits your diet and profile."}
                </Text>
              </ExpandableSection>
              <View className="mt-2">
                <Text
                  className="mb-3 font-medium text-foreground text-sm"
                  style={textWhite}
                >
                  View details
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {SECTION_BUTTONS.map(({ key, label, route, Icon }) => {
                    const isLocked = PRO_SECTIONS.has(route) && !isPro;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => router.push(`/results/${id}/${route}`)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginRight: 10,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isDark ? "#404040" : "#d4d4d8",
                          backgroundColor: isDark ? "#18181b" : "#f4f4f5",
                        }}
                      >
                        {isLocked ? (
                          <Crown
                            size={18}
                            color={THEME.primary}
                            strokeWidth={2}
                          />
                        ) : (
                          <Icon
                            size={18}
                            color={isDark ? "#a1a1aa" : "#15803d"}
                            strokeWidth={2}
                          />
                        )}
                        <Text
                          className="font-medium text-sm"
                          style={{ color: isDark ? "#f4f4f5" : "#18181b" }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </CardContent>
          </Card>
        )}
      </ScrollView>

      <FoodAssistantChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        product={product}
        analysis={analysis ?? undefined}
        profile={profile}
      />

      {/* Full-screen image modal */}
      <Modal
        visible={imageExpanded && !!expandImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageExpanded(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {expandImageUri ? (
            <Image
              source={{ uri: expandImageUri }}
              style={{ width: "90%", height: "70%", borderRadius: 16 }}
              contentFit="contain"
            />
          ) : null}
          <TouchableOpacity
            onPress={() => setImageExpanded(false)}
            style={{
              position: "absolute",
              top: insets.top + 12,
              right: 20,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: 18,
                fontWeight: "600",
                lineHeight: 20,
              }}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
