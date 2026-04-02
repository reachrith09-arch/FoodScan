import { requireOptionalNativeModule } from "expo-modules-core";
import { useRouter } from "expo-router";
import {
  Camera,
  ImageIcon,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  computeMealScore,
  defaultPortionForFood,
  getMergedMealProduct,
  type MealItem,
  parsePortionToGrams,
} from "@/lib/meal-score";
import {
  confidenceColor,
  confidenceLabel,
  isFoodRecognitionAvailable,
  ratioToPortionString,
  recognizeMealFromImage,
} from "@/lib/recognize-food";
import { productFromRecognizedIngredient } from "@/lib/recognized-ingredient-product";
import { addToScanHistory, getHealthProfile } from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { resolveBase64ForVision } from "@/lib/vision-image";
import type { ScanResult } from "@/types/food";

const PORTION_PLACEHOLDER = "e.g. 100g, 1 cup, 1 serving";

const ANALYZING_HINTS = [
  "Reading your photo…",
  "Finding foods in the picture…",
  "Naming the meal and ingredients…",
  "Estimating portions…",
] as const;

type ImagePickerModule = typeof import("expo-image-picker");
let imagePickerModule: ImagePickerModule | null | undefined;
async function getImagePicker(): Promise<ImagePickerModule | null> {
  if (imagePickerModule !== undefined) return imagePickerModule;
  try {
    const native = requireOptionalNativeModule("ExponentImagePicker");
    if (!native) {
      imagePickerModule = null;
      return null;
    }
    imagePickerModule = (await import(
      "expo-image-picker"
    )) as ImagePickerModule;
    return imagePickerModule;
  } catch {
    imagePickerModule = null;
    return null;
  }
}

interface FoodEntry {
  id: string;
  name: string;
  portion: string;
  /** AI similarity confidence 0–100 */
  confidence?: number;
  /** Whether this item is primarily a liquid drink */
  isDrink?: boolean;
  /** Whether this food is blended/mixed with others */
  isBlended?: boolean;
  /** AI-estimated portion ratio 0–1 */
  portionRatio?: number;
}

type Step = "capture" | "preview" | "analyzing" | "review" | "calculating";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidenceColor(confidence);
  const label = confidenceLabel(confidence);
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + "22", borderColor: color + "55" },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>
        {confidence}% · {label}
      </Text>
    </View>
  );
}

export default function PhotoScreen() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("capture");
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);
  const [foods, setFoods] = React.useState<FoodEntry[]>([]);
  /** Overarching meal label (e.g. "Pasta with tomato sauce") — editable on confirm step */
  const [dishSummary, setDishSummary] = React.useState("");
  const [isBlendedMeal, setIsBlendedMeal] = React.useState(false);
  /** Cycles on the full-screen analyzing step so the wait feels intentional. */
  const [analyzingHintIndex, setAnalyzingHintIndex] = React.useState(0);
  /** From image picker; used when reading the file URI fails (common after crop). */
  const [pendingPickerBase64, setPendingPickerBase64] = React.useState<
    string | null
  >(null);
  const visionEnabled = isFoodRecognitionAvailable();
  const recognitionGen = React.useRef(0);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (step !== "analyzing") return;
    setAnalyzingHintIndex(0);
    const t = setInterval(() => {
      setAnalyzingHintIndex((i) => (i + 1) % ANALYZING_HINTS.length);
    }, 2400);
    return () => clearInterval(t);
  }, [step]);

  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const bgColor = isDark ? THEME.darkBg : THEME.bgLightTop;
  const cardBg = isDark ? THEME.darkCard : THEME.white;
  const borderColor = isDark ? THEME.borderDark : THEME.borderLight;
  const textColor = isDark ? "#f4f4f5" : THEME.darkGrey;

  // ── AI recognition ───────────────────────────────────────────────────────────

  const runRecognition = React.useCallback(async (base64: string) => {
    const gen = ++recognitionGen.current;
    setLoading(true);
    setError(null);
    try {
      const {
        dishSummary: summary,
        foods: recognized,
        visionError,
      } = await recognizeMealFromImage(base64);
      if (!mountedRef.current || gen !== recognitionGen.current) return;
      const summaryText = summary?.trim() ?? "";
      setDishSummary(summaryText);
      if (recognized.length > 0) {
        if (visionError && __DEV__) {
          console.warn("[photo] vision:", visionError);
        }
        const blended = recognized.some((f) => f.isBlended);
        const allDrinks = recognized.every((f) => f.isDrink);
        const totalAmount = allDrinks ? 400 : 400;
        setIsBlendedMeal(blended);
        setFoods(
          recognized.map((f, i) => ({
            id: `food-${Date.now()}-${i}`,
            name: f.name,
            portion: ratioToPortionString(
              f.portionRatio,
              f.isDrink,
              totalAmount,
            ),
            confidence: f.confidence,
            isDrink: f.isDrink,
            isBlended: f.isBlended,
            portionRatio: f.portionRatio,
          })),
        );
        setStep("review");
      } else {
        setIsBlendedMeal(false);
        setFoods([
          { id: `food-${Date.now()}`, name: "", portion: "1 serving" },
        ]);
        setStep("review");
        const baseMsg = summaryText
          ? "Meal name only — add ingredients below or Re-analyze."
          : "No ingredients detected. Add below or Re-analyze.";
        setError(visionError ? `${baseMsg} ${visionError}` : baseMsg);
      }
    } catch {
      if (mountedRef.current && gen === recognitionGen.current) {
        setDishSummary("");
        setFoods([
          { id: `food-${Date.now()}`, name: "", portion: "1 serving" },
        ]);
        setStep("review");
        setError("Scan failed. Add foods manually or try Re-analyze.");
      }
    } finally {
      if (mountedRef.current && gen === recognitionGen.current)
        setLoading(false);
    }
  }, []);

  const startAiAnalysis = React.useCallback(async () => {
    if (!imageUri) return;
    setStep("analyzing");
    setError(null);
    const resolved = await resolveBase64ForVision(
      imageUri,
      pendingPickerBase64,
    );
    if (!mountedRef.current) return;
    const b64 = resolved.ok ? resolved.base64 : null;
    setImageBase64(b64);
    setFoods([]);
    setDishSummary("");
    setIsBlendedMeal(false);
    if (!b64) {
      setStep("preview");
      setError(
        resolved.reason === "heic"
          ? "This photo is HEIC, which the AI cannot read. On iPhone: Settings → Camera → Formats → Most Compatible."
          : "Could not read this image for analysis. Try Retake or another photo.",
      );
      return;
    }
    runRecognition(b64);
  }, [imageUri, pendingPickerBase64, runRecognition]);

  // ── Image capture → preview (vision) or review (manual) ─────────────────────

  const handlePickedAsset = React.useCallback(
    (uri: string, pickerBase64: string | null) => {
      setImageUri(uri);
      setError(null);
      setFoods([]);
      setDishSummary("");
      setIsBlendedMeal(false);
      if (visionEnabled) {
        setPendingPickerBase64(pickerBase64?.trim() || null);
        setImageBase64(null);
        setStep("preview");
        return;
      }
      setPendingPickerBase64(null);
      setImageBase64(null);
      setStep("review");
      setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
    },
    [visionEnabled],
  );

  const retakeFromPreview = React.useCallback(() => {
    setImageUri(null);
    setPendingPickerBase64(null);
    setImageBase64(null);
    setStep("capture");
    setError(null);
  }, []);

  const takePhoto = React.useCallback(async () => {
    if (capturing || loading) return;
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError(
        "Camera is not available. Rebuild the app with expo run:ios after installing native modules.",
      );
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(
        "Camera permission is required. Enable it in Settings to take photos.",
      );
      return;
    }
    setError(null);
    setCapturing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });
      if (!mountedRef.current) return;
      if (!result.canceled && result.assets[0]) {
        handlePickedAsset(
          result.assets[0].uri,
          result.assets[0].base64 ?? null,
        );
      }
    } catch {
      if (mountedRef.current) {
        setError("Could not take picture. Please try again.");
      }
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }, [capturing, loading, handlePickedAsset]);

  const pickImage = React.useCallback(async () => {
    if (loading) return;
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError(
        "Photo library is not available. Rebuild the app with expo run:ios.",
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required. Enable it in Settings.");
      return;
    }
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });
      if (!mountedRef.current) return;
      if (!result.canceled && result.assets[0]) {
        handlePickedAsset(
          result.assets[0].uri,
          result.assets[0].base64 ?? null,
        );
      }
    } catch {
      if (mountedRef.current) {
        setError("Could not select image. Please try again.");
      }
    }
  }, [loading, handlePickedAsset]);

  const reAnalyze = () => {
    if (imageBase64) {
      setAnalyzingHintIndex(0);
      setStep("analyzing");
      runRecognition(imageBase64);
    }
  };

  const cancelAnalyzing = () => {
    recognitionGen.current += 1;
    setLoading(false);
    setError(null);
    if (imageUri && visionEnabled) {
      setStep("preview");
    } else {
      setStep("capture");
      setImageUri(null);
      setPendingPickerBase64(null);
      setImageBase64(null);
      setFoods([]);
      setDishSummary("");
    }
  };

  // ── Food entry editing ──────────────────────────────────────────────────────

  const addFood = () => {
    setFoods((prev) => [
      ...prev,
      { id: `food-${Date.now()}`, name: "", portion: "1 serving" },
    ]);
  };

  const removeFood = (id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFood = (id: string, patch: Partial<FoodEntry>) => {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  // ── Score calculation ───────────────────────────────────────────────────────

  const calculateMealScore = async () => {
    const valid = foods.filter((f) => f.name.trim());
    if (valid.length === 0) {
      setError("Add at least one food with a name.");
      return;
    }
    setStep("calculating");
    setLoading(true);
    setError(null);
    try {
      const mealItems: MealItem[] = [];
      for (const f of valid) {
        const product = productFromRecognizedIngredient(f.name.trim(), {
          isDrink: f.isDrink,
        });
        const grams = parsePortionToGrams(f.portion) ?? 100;
        mealItems.push({
          product,
          portionGrams: grams,
          confidence: f.confidence,
          isBlended: f.isBlended ?? isBlendedMeal,
        });
      }

      const profile = await getHealthProfile();
      const analysis = computeMealScore(mealItems, profile);
      const merged = getMergedMealProduct(mealItems);

      const scanResult: ScanResult = {
        id: `meal-${Date.now()}`,
        timestamp: Date.now(),
        source: "photo",
        product: merged,
        healthRisks: analysis.healthRisks,
        analysis,
        mealDishSummary: dishSummary.trim() || undefined,
        mealIngredients: valid.map((f) => ({
          name: f.name.trim(),
          portion: f.portion,
          ...(f.confidence != null ? { confidence: f.confidence } : {}),
        })),
        mealPhotoUri: imageUri ?? undefined,
      };
      await addToScanHistory(scanResult);
      router.replace(`/results/${scanResult.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      setStep("review");
    }
  };

  const canCalculate = foods.some((f) => f.name.trim()) && !loading;

  // ── Render steps ────────────────────────────────────────────────────────────

  const renderCaptureStep = () => (
    <>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isDark
              ? "rgba(34,197,94,0.2)"
              : "rgba(22,128,61,0.15)",
          },
        ]}
      >
        <UtensilsCrossed size={36} color={THEME.primary} strokeWidth={2} />
      </View>
      <Text style={[styles.heading, { color: textColor }]}>Scan your food</Text>
      <Text style={[styles.subheading, { color: THEME.mutedGrey }]}>
        Take a picture, submit it for AI analysis, then confirm the meal — add
        or remove ingredients before your score.
      </Text>

      {/* Primary: camera → preview → analyze → confirm */}
      <Button
        onPress={takePhoto}
        disabled={capturing || loading}
        style={[
          styles.takePhotoButton,
          THEME.shadowButton,
          (capturing || loading) && { opacity: 0.7 },
        ]}
      >
        {capturing ? (
          <ActivityIndicator
            color="#fff"
            size="small"
            style={{ marginRight: 10 }}
          />
        ) : (
          <Camera size={22} color="#fff" style={{ marginRight: 10 }} />
        )}
        <Text style={styles.takePhotoLabel}>
          {capturing ? "Opening camera…" : "Scan food"}
        </Text>
      </Button>

      {/* Secondary: Choose from Library */}
      <Pressable
        onPress={pickImage}
        disabled={capturing || loading}
        style={({ pressed }) => [
          styles.secondaryBtn,
          {
            borderColor,
            opacity: capturing || loading ? 0.6 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <ImageIcon size={20} color={THEME.primary} style={{ marginRight: 8 }} />
        <Text style={{ color: THEME.primary, fontSize: 16, fontWeight: "500" }}>
          Choose from library
        </Text>
      </Pressable>

      {/* Tertiary: Search by name (no photo) */}
      <Pressable
        onPress={() => {
          setError(null);
          setImageUri(null);
          setPendingPickerBase64(null);
          setImageBase64(null);
          setDishSummary("");
          setFoods([{ id: `food-${Date.now()}`, name: "", portion: "" }]);
          setStep("review");
        }}
        style={({ pressed }) => [
          styles.searchBtn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Search size={16} color={THEME.mutedGrey} style={{ marginRight: 6 }} />
        <Text style={{ color: THEME.mutedGrey, fontSize: 14 }}>
          Search by food name instead
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );

  /** After pick: user submits when ready; then we decode + call vision. */
  const renderPreviewStep = () => (
    <>
      <Text style={[styles.heading, { color: textColor, marginBottom: 8 }]}>
        Your photo
      </Text>
      <Text
        style={[
          styles.subheading,
          { color: THEME.mutedGrey, marginBottom: 16 },
        ]}
      >
        Submit when you&apos;re happy with the shot. We&apos;ll match it to
        typical meals like this, list ingredients, then you confirm or edit.
      </Text>
      {imageUri ? (
        <View
          style={[
            styles.photoPreview,
            { backgroundColor: cardBg, borderColor, marginBottom: 20 },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        </View>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, { marginBottom: 12 }]}>{error}</Text>
      ) : null}
      <Button
        onPress={() => void startAiAnalysis()}
        style={[styles.takePhotoButton, THEME.shadowButton]}
      >
        <UtensilsCrossed size={22} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.takePhotoLabel}>Analyze meal</Text>
      </Button>
      <Pressable
        onPress={retakeFromPreview}
        style={({ pressed }) => [
          styles.secondaryBtn,
          { borderColor, marginTop: 12, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Camera size={18} color={THEME.primary} style={{ marginRight: 8 }} />
        <Text style={{ color: THEME.primary, fontSize: 16, fontWeight: "500" }}>
          Retake / choose another
        </Text>
      </Pressable>
    </>
  );

  /** Full-screen loading: photo decode + vision API — stays up until results are applied. */
  const renderAnalyzingScreen = () => {
    const hint = ANALYZING_HINTS[analyzingHintIndex % ANALYZING_HINTS.length];
    return (
      <View
        style={[
          styles.analyzingRoot,
          {
            backgroundColor: bgColor,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 28,
          },
        ]}
      >
        <Text style={[styles.analyzingScreenTitle, { color: textColor }]}>
          Analyzing your meal
        </Text>
        <Text
          style={[styles.analyzingScreenKicker, { color: THEME.mutedGrey }]}
        >
          Matching your plate to typical meals and ingredients
        </Text>

        {imageUri ? (
          <View style={[styles.analyzingPhotoCard, { borderColor }]}>
            <Image
              source={{ uri: imageUri }}
              style={styles.analyzingPhotoImage}
              resizeMode="cover"
            />
            <View style={styles.analyzingPhotoOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          </View>
        ) : (
          <View style={[styles.analyzingPhotoPlaceholder, { borderColor }]}>
            <ActivityIndicator color={THEME.primary} size="large" />
          </View>
        )}

        <Text style={[styles.analyzingHintLine, { color: textColor }]}>
          {hint}
        </Text>
        <Text style={[styles.analyzingSubtitle, { color: THEME.mutedGrey }]}>
          Next you&apos;ll confirm it&apos;s correct, remove anything wrong, and
          add what we missed.
        </Text>

        <Button
          variant="ghost"
          style={styles.analyzingCancel}
          onPress={cancelAnalyzing}
        >
          <Text style={{ color: THEME.mutedGrey }}>Cancel</Text>
        </Button>
      </View>
    );
  };

  /** Edit AI-filled meal + ingredients → composite score */
  const renderReviewStep = () => {
    const hasBlend = isBlendedMeal || foods.some((f) => f.isBlended);
    const isMultiItem = foods.length > 1;
    return (
      <>
        {imageUri && (
          <View
            style={[
              styles.photoPreview,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.photoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {!visionEnabled ? (
          <View
            style={[
              styles.visionConfigBanner,
              {
                backgroundColor: isDark ? "#3f2a1a" : "#fff7ed",
                borderColor: isDark ? "#92400e" : "#fdba74",
              },
            ]}
          >
            <Text
              style={{
                color: isDark ? "#fed7aa" : "#9a3412",
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              Photo AI is off: add{" "}
              <Text style={{ fontWeight: "700" }}>
                EXPO_PUBLIC_OPENAI_API_KEY
              </Text>{" "}
              or{" "}
              <Text style={{ fontWeight: "700" }}>
                EXPO_PUBLIC_SUPABASE_URL
              </Text>{" "}
              +{" "}
              <Text style={{ fontWeight: "700" }}>
                EXPO_PUBLIC_SUPABASE_ANON_KEY
              </Text>{" "}
              to <Text style={{ fontWeight: "700" }}>.env</Text> or Doppler,
              then restart Metro with{" "}
              <Text style={{ fontWeight: "700" }}>--clear</Text>. Rebuild the
              dev client after changing{" "}
              <Text style={{ fontWeight: "700" }}>app.config</Text>.
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Confirm your meal
        </Text>
        <Text
          style={{
            color: THEME.mutedGrey,
            fontSize: 13,
            marginBottom: 14,
            lineHeight: 19,
          }}
        >
          Is this right? Remove what you didn&apos;t use, add anything we
          missed, then get your score.
        </Text>

        {(hasBlend || isMultiItem) && (
          <View
            style={[
              styles.blendBanner,
              {
                backgroundColor: isDark ? "#1a2e1a" : "#f0fdf4",
                borderColor: "#16a34a44",
              },
            ]}
          >
            <Zap size={15} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={{ color: "#16a34a", fontSize: 13, flex: 1 }}>
              {hasBlend
                ? "Score blends listed ingredients by portion."
                : "Score weights each row by portion."}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.mealCard,
            { backgroundColor: isDark ? "#27272a" : "#f4f4f5", borderColor },
          ]}
        >
          <Text
            style={{
              color: THEME.mutedGrey,
              fontSize: 12,
              marginBottom: 6,
              fontWeight: "600",
            }}
          >
            Meal
          </Text>
          <Input
            value={dishSummary}
            onChangeText={setDishSummary}
            placeholder="Meal name"
            editable={!loading}
            style={[
              styles.input,
              styles.mealNameInput,
              isDark && {
                borderColor: THEME.borderDark,
                color: "#f4f4f5",
                backgroundColor: "#1a1a1a",
              },
            ]}
            placeholderTextColor={isDark ? "#71717a" : undefined}
          />
        </View>

        {visionEnabled && imageBase64 ? (
          <Pressable
            onPress={reAnalyze}
            style={({ pressed }) => [
              styles.addBtn,
              {
                borderStyle: "solid",
                marginBottom: 8,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <UtensilsCrossed size={16} color={THEME.primary} />
            <Text
              style={{ color: THEME.primary, fontSize: 14, fontWeight: "600" }}
            >
              Re-analyze photo
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.ingredientsSectionTitle, { color: textColor }]}>
          Ingredients
        </Text>
        <Text
          style={{ color: THEME.mutedGrey, fontSize: 12, marginBottom: 10 }}
        >
          Trash a row to remove · edit portions · Add ingredient for anything
          extra.
        </Text>

        {foods.length === 0 ? (
          <Text
            style={{ color: THEME.mutedGrey, fontSize: 13, marginBottom: 12 }}
          >
            No ingredients yet — tap &quot;Add ingredient&quot; below.
          </Text>
        ) : null}

        {foods.map((f) => (
          <View
            key={f.id}
            style={[
              styles.ingredientBlock,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <View style={styles.ingredientNameRow}>
              <Input
                value={f.name}
                onChangeText={(text) => {
                  const isDrinkGuess = defaultPortionForFood(text) === "250ml";
                  const newPortion =
                    f.portion === "" ? defaultPortionForFood(text) : f.portion;
                  updateFood(f.id, {
                    name: text,
                    isDrink: isDrinkGuess,
                    portion: newPortion,
                  });
                }}
                placeholder="Ingredient name"
                editable={!loading}
                style={[
                  styles.input,
                  styles.ingredientNameInput,
                  isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" },
                ]}
              />
              <Pressable
                onPress={() => removeFood(f.id)}
                style={styles.trashBesideName}
                hitSlop={10}
                accessibilityLabel="Remove ingredient"
              >
                <Trash2 size={20} color={THEME.mutedGrey} />
              </Pressable>
            </View>
            <View style={styles.badgeRow}>
              {f.isDrink && (
                <View
                  style={[
                    styles.drinkTag,
                    { backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" },
                  ]}
                >
                  <Text
                    style={{
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    DRINK
                  </Text>
                </View>
              )}
              {f.confidence !== undefined && (
                <ConfidenceBadge confidence={f.confidence} />
              )}
            </View>
            <Input
              value={f.portion}
              onChangeText={(text) => updateFood(f.id, { portion: text })}
              placeholder={
                f.isDrink ? "e.g. 250ml, 1 can, 1 glass" : PORTION_PLACEHOLDER
              }
              editable={!loading}
              style={[
                styles.input,
                styles.portionInput,
                isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" },
              ]}
            />
          </View>
        ))}

        <Pressable
          onPress={addFood}
          style={({ pressed }) => [
            styles.addBtn,
            { borderColor, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Plus size={18} color={THEME.primary} />
          <Text
            style={{ color: THEME.primary, fontSize: 15, fontWeight: "600" }}
          >
            Add ingredient
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          style={[
            styles.searchScoreBtn,
            THEME.shadowButton,
            !canCalculate && { opacity: 0.5 },
          ]}
          onPress={calculateMealScore}
          disabled={!canCalculate}
        >
          <Search size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Get health score
          </Text>
        </Button>
      </>
    );
  };

  const renderCalculatingStep = () => (
    <View style={styles.centred}>
      {imageUri && (
        <View
          style={[
            styles.photoPreview,
            { backgroundColor: cardBg, borderColor },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        </View>
      )}
      <ActivityIndicator
        color={THEME.primary}
        size="large"
        style={{ marginTop: 24 }}
      />
      <Text style={[styles.recognizingLabel, { color: textColor }]}>
        Computing health score…
      </Text>
      <Text
        style={{ color: THEME.mutedGrey, fontSize: 13, textAlign: "center" }}
      >
        Estimating from your ingredients · blending portions · analysing
        nutrition
      </Text>
    </View>
  );

  if (step === "analyzing") {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {renderAnalyzingScreen()}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {step === "capture" && renderCaptureStep()}
        {step === "preview" && renderPreviewStep()}
        {step === "review" && renderReviewStep()}
        {step === "calculating" && renderCalculatingStep()}

        {step !== "calculating" ? (
          <Button
            variant="ghost"
            style={styles.cancelBtn}
            onPress={() => router.back()}
          >
            <Text style={{ color: THEME.mutedGrey }}>Cancel</Text>
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  centred: { alignItems: "center", paddingVertical: 32 },

  analyzingRoot: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  analyzingScreenTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  analyzingScreenKicker: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
    textAlign: "center",
  },
  analyzingPhotoCard: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#000",
  },
  analyzingPhotoImage: {
    width: "100%",
    height: "100%",
  },
  analyzingPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  analyzingPhotoPlaceholder: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 4 / 3,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  analyzingHintLine: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 22,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  analyzingSubtitle: {
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  analyzingCancel: { marginTop: 28 },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },

  takePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginBottom: 12,
  },
  takePhotoLabel: { color: "#fff", fontSize: 17, fontWeight: "600" },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },

  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 4,
  },

  photoPreview: {
    height: 200,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
  },
  photoImage: { width: "100%", height: "100%" },

  blendBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  visionConfigBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  mealCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  mealNameInput: {
    minHeight: 46,
    fontSize: 16,
    fontWeight: "600",
  },
  ingredientsSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 0,
  },
  ingredientBlock: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  ingredientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ingredientNameInput: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
  },
  trashBesideName: {
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  blendTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  drinkTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  input: { borderWidth: 1, borderRadius: 10 },
  portionInput: { minHeight: 40 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: "dashed",
    alignSelf: "flex-start",
    marginBottom: 16,
  },

  searchScoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primary,
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 8,
  },

  recognizingLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 6,
    textAlign: "center",
  },

  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },

  cancelBtn: { marginTop: 24, alignSelf: "center" },
});
