import { useRouter } from "expo-router";
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
import {
  Camera,
  Check,
  ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addToScanHistory, getHealthProfile } from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { searchProducts } from "@/lib/open-food-facts";
import { lookupProductOnline } from "@/lib/lookup-product-online";
import {
  computeMealScore,
  getMergedMealProduct,
  parsePortionToGrams,
  type MealItem,
} from "@/lib/meal-score";
import {
  recognizeFoodsInImage,
  confidenceLabel,
  confidenceColor,
  ratioToPortionString,
  type RecognizedFood,
} from "@/lib/recognize-food";
import { defaultPortionForFood } from "@/lib/meal-score";
import type { ScanResult } from "@/types/food";
import { env } from "@/env";

const PORTION_PLACEHOLDER = "e.g. 100g, 1 cup, 1 serving";

type ImagePickerModule = typeof import("expo-image-picker");
let imagePickerModule: ImagePickerModule | null | undefined;
async function getImagePicker(): Promise<ImagePickerModule | null> {
  if (imagePickerModule !== undefined) return imagePickerModule;
  try {
    const native = requireOptionalNativeModule("ExponentImagePicker");
    if (!native) { imagePickerModule = null; return null; }
    imagePickerModule = (await import("expo-image-picker")) as ImagePickerModule;
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

type Step = "capture" | "recognizing" | "confirm" | "portion" | "calculating";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidenceColor(confidence);
  const label = confidenceLabel(confidence);
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{confidence}% · {label}</Text>
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
  const [isBlendedMeal, setIsBlendedMeal] = React.useState(false);
  const hasSupabase = !!(env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const bgColor = isDark ? THEME.darkBg : THEME.bgLightTop;
  const cardBg = isDark ? THEME.darkCard : THEME.white;
  const borderColor = isDark ? THEME.borderDark : THEME.borderLight;
  const textColor = isDark ? "#f4f4f5" : THEME.darkGrey;

  // ── AI recognition (must be before processImage) ─────────────────────────────

  const runRecognition = React.useCallback(async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const recognized: RecognizedFood[] = await recognizeFoodsInImage(base64);
      if (!mountedRef.current) return;
      if (recognized.length > 0) {
        const blended = recognized.some((f) => f.isBlended);
        const allDrinks = recognized.every((f) => f.isDrink);
        const totalAmount = allDrinks ? 400 : 400;
        setIsBlendedMeal(blended);
        setFoods(
          recognized.map((f, i) => ({
            id: `food-${Date.now()}-${i}`,
            name: f.name,
            portion: ratioToPortionString(f.portionRatio, f.isDrink, totalAmount),
            confidence: f.confidence,
            isDrink: f.isDrink,
            isBlended: f.isBlended,
            portionRatio: f.portionRatio,
          })),
        );
        setStep("confirm");
      } else {
        setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
        setStep("portion");
      }
    } catch {
      if (mountedRef.current) {
        setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
        setStep("portion");
        setError("AI recognition failed. Please enter the food manually.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // ── Image capture ───────────────────────────────────────────────────────────

  const processImage = React.useCallback(
    async (uri: string, base64: string | null) => {
      setImageUri(uri);
      setImageBase64(base64 ?? null);
      setFoods([]);
      setIsBlendedMeal(false);
      if (hasSupabase && base64) {
        setStep("recognizing");
        runRecognition(base64);
      } else {
        setStep("portion");
        setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
      }
    },
    [hasSupabase, runRecognition],
  );

  const takePhoto = React.useCallback(async () => {
    if (capturing || loading) return;
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Camera is not available. Rebuild the app with expo run:ios after installing native modules.");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission is required. Enable it in Settings to take photos.");
      return;
    }
    setError(null);
    setCapturing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });
      if (!mountedRef.current) return;
      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, result.assets[0].base64 ?? null);
      }
    } catch {
      if (mountedRef.current) {
        setError("Could not take picture. Please try again.");
      }
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }, [capturing, loading, processImage]);

  const pickImage = React.useCallback(async () => {
    if (loading) return;
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Photo library is not available. Rebuild the app with expo run:ios.");
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
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });
      if (!mountedRef.current) return;
      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, result.assets[0].base64 ?? null);
      }
    } catch {
      if (mountedRef.current) {
        setError("Could not select image. Please try again.");
      }
    }
  }, [loading, processImage]);

  const reAnalyze = () => {
    if (imageBase64) {
      setStep("recognizing");
      runRecognition(imageBase64);
    }
  };

  // ── Food entry editing ──────────────────────────────────────────────────────

  const confirmGuess = (confirmed: boolean) => {
    setStep("portion");
    if (!confirmed && foods.length === 0) {
      setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
    }
  };

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
        const products = await searchProducts(f.name.trim(), 3);
        const product =
          products[0] ?? (await lookupProductOnline(f.name.trim()));
        if (!product) {
          setError(`Could not find "${f.name}" in the database. Try a different name or remove it.`);
          setLoading(false);
          setStep("portion");
          return;
        }
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
      };
      await addToScanHistory(scanResult);
      router.replace(`/results/${scanResult.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      setStep("portion");
    }
  };

  const canCalculate = foods.some((f) => f.name.trim()) && !loading;

  // ── Render steps ────────────────────────────────────────────────────────────

  const renderCaptureStep = () => (
    <>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "rgba(22,128,61,0.15)" },
        ]}
      >
        <UtensilsCrossed size={36} color={THEME.primary} strokeWidth={2} />
      </View>
      <Text style={[styles.heading, { color: textColor }]}>
        Scan your food
      </Text>
      <Text style={[styles.subheading, { color: THEME.mutedGrey }]}>
        AI identifies each ingredient, estimates portions, and computes a composite health score for the whole meal.
      </Text>

      {/* Primary: Take Photo */}
      <Button
        onPress={takePhoto}
        disabled={capturing || loading}
        style={[styles.takePhotoButton, THEME.shadowButton, (capturing || loading) && { opacity: 0.7 }]}
      >
        {capturing ? (
          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
        ) : (
          <Camera size={22} color="#fff" style={{ marginRight: 10 }} />
        )}
        <Text style={styles.takePhotoLabel}>
          {capturing ? "Opening camera…" : "Take a picture"}
        </Text>
      </Button>

      {/* Secondary: Choose from Library */}
      <Pressable
        onPress={pickImage}
        disabled={capturing || loading}
        style={({ pressed }) => [
          styles.secondaryBtn,
          { borderColor, opacity: capturing || loading ? 0.6 : pressed ? 0.8 : 1 },
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
          setFoods([{ id: `food-${Date.now()}`, name: "", portion: "" }]);
          setStep("portion");
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

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </>
  );

  const renderRecognizingStep = () => (
    <View style={styles.centred}>
      {imageUri && (
        <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
          <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
        </View>
      )}
      <ActivityIndicator color={THEME.primary} size="large" style={{ marginTop: 24 }} />
      <Text style={[styles.recognizingLabel, { color: textColor }]}>
        AI is identifying your food…
      </Text>
      <Text style={{ color: THEME.mutedGrey, fontSize: 13, textAlign: "center" }}>
        Detecting items · estimating portions · checking blend
      </Text>
    </View>
  );

  const renderConfirmStep = () => {
    const hasBlend = foods.some((f) => f.isBlended);
    const isMultiItem = foods.length > 1;
    return (
      <>
        {imageUri && (
          <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
            <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
          </View>
        )}

        {(hasBlend || isMultiItem) && (
          <View style={[styles.blendBanner, { backgroundColor: isDark ? "#1a2e1a" : "#f0fdf4", borderColor: "#16a34a44" }]}>
            <Zap size={15} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={{ color: "#16a34a", fontSize: 13, flex: 1 }}>
              {hasBlend
                ? "Blended meal detected — score will be a weighted combination of all components."
                : "Composite meal — the health score combines all items by portion size."}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Detected foods
        </Text>
        <Text style={{ color: THEME.mutedGrey, fontSize: 13, marginBottom: 12 }}>
          Review each item. Did we miss anything? You can add it on the next screen — the composite score includes every item.
        </Text>

        {foods.map((f) => (
          <View
            key={f.id}
            style={[
              styles.detectedCard,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <View style={styles.detectedRow}>
              <Text style={[styles.detectedName, { color: textColor }]}>{f.name}</Text>
              {f.isDrink && (
                <View style={[styles.drinkTag, { backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" }]}>
                  <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "600" }}>DRINK</Text>
                </View>
              )}
              {f.isBlended && (
                <View style={[styles.blendTag, { backgroundColor: isDark ? "#1a2e1a" : "#dcfce7" }]}>
                  <Text style={{ color: "#16a34a", fontSize: 11, fontWeight: "600" }}>BLEND</Text>
                </View>
              )}
            </View>
            <View style={styles.detectedMeta}>
              {f.confidence !== undefined && (
                <ConfidenceBadge confidence={f.confidence} />
              )}
              <Text style={{ color: THEME.mutedGrey, fontSize: 12 }}>
                ~{f.portion}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.confirmButtons}>
          <Button onPress={() => confirmGuess(true)} style={[styles.confirmBtn, THEME.shadowButton]}>
            <Check size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={{ color: "#fff", fontWeight: "600" }}>Yes, looks right</Text>
          </Button>
          <Pressable
            onPress={() => {
              confirmGuess(false);
              addFood();
            }}
            style={({ pressed }) => [
              styles.addMissedBtn,
              { borderColor, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Plus size={18} color={THEME.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: THEME.primary, fontWeight: "600" }}>
              Add something we missed
            </Text>
          </Pressable>
          <Button
            variant="outline"
            onPress={() => confirmGuess(false)}
            style={[styles.editBtn, { borderColor }]}
          >
            <Pencil size={18} color={THEME.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: THEME.primary, fontWeight: "600" }}>Edit items</Text>
          </Button>
          {hasSupabase && imageBase64 && (
            <Pressable
              onPress={reAnalyze}
              style={({ pressed }) => [styles.reAnalyzeBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: THEME.mutedGrey, fontSize: 13 }}>Re-scan image</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  };

  const renderPortionStep = () => {
    const hasBlend = isBlendedMeal || foods.some((f) => f.isBlended);
    return (
      <>
        {imageUri && (
          <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
            <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
          </View>
        )}

        {hasBlend && (
          <View style={[styles.blendBanner, { backgroundColor: isDark ? "#1a2e1a" : "#f0fdf4", borderColor: "#16a34a44" }]}>
            <Zap size={15} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={{ color: "#16a34a", fontSize: 13, flex: 1 }}>
              Blended meal — health score is a weighted combination of all components.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Confirm foods &amp; drinks
        </Text>
        <Text style={{ color: THEME.mutedGrey, fontSize: 13, marginBottom: 12 }}>
          Edit names or amounts. Add anything the scan missed — the composite score includes every item.
        </Text>

        {foods.map((f) => (
          <View
            key={f.id}
            style={[styles.foodRow, { backgroundColor: cardBg, borderColor }]}
          >
            <View style={styles.foodInputs}>
              <View style={styles.nameRow}>
                <Input
                  value={f.name}
                  onChangeText={(text) => {
                    const isDrinkGuess = defaultPortionForFood(text) === "250ml";
                    // Auto-set portion default when name is typed and portion is empty
                    const newPortion =
                      f.portion === "" ? defaultPortionForFood(text) : f.portion;
                    updateFood(f.id, {
                      name: text,
                      isDrink: isDrinkGuess,
                      portion: newPortion,
                    });
                  }}
                  placeholder="Food or drink name"
                  editable={!loading}
                  style={[
                    styles.input,
                    styles.foodName,
                    isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" },
                  ]}
                />
                <View style={styles.badgeRow}>
                  {f.isDrink && (
                    <View style={[styles.drinkTag, { backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" }]}>
                      <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "600" }}>DRINK</Text>
                    </View>
                  )}
                  {f.confidence !== undefined && (
                    <ConfidenceBadge confidence={f.confidence} />
                  )}
                </View>
              </View>
              <Input
                value={f.portion}
                onChangeText={(text) => updateFood(f.id, { portion: text })}
                placeholder={f.isDrink ? "e.g. 250ml, 1 can, 1 glass" : PORTION_PLACEHOLDER}
                editable={!loading}
                style={[
                  styles.input,
                  styles.portionInput,
                  isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" },
                ]}
              />
            </View>
            <Pressable
              onPress={() => removeFood(f.id)}
              style={styles.removeBtn}
              hitSlop={8}
            >
              <Trash2 size={18} color={THEME.mutedGrey} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={addFood}
          style={({ pressed }) => [
            styles.addBtn,
            { borderColor, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Plus size={16} color={THEME.primary} />
          <Text style={{ color: THEME.primary, fontSize: 14, fontWeight: "500" }}>
            Add something we missed
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* THE SEARCH / SUBMIT BUTTON */}
        <Button
          style={[styles.searchScoreBtn, THEME.shadowButton, !canCalculate && { opacity: 0.5 }]}
          onPress={calculateMealScore}
          disabled={!canCalculate}
        >
          <Search size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Search &amp; get health score
          </Text>
        </Button>
        <Text style={{ color: THEME.mutedGrey, fontSize: 12, textAlign: "center", marginTop: 6 }}>
          Looks up each item and computes a composite score weighted by portion
        </Text>
      </>
    );
  };

  const renderCalculatingStep = () => (
    <View style={styles.centred}>
      {imageUri && (
        <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
          <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
        </View>
      )}
      <ActivityIndicator color={THEME.primary} size="large" style={{ marginTop: 24 }} />
      <Text style={[styles.recognizingLabel, { color: textColor }]}>
        Computing health score…
      </Text>
      <Text style={{ color: THEME.mutedGrey, fontSize: 13, textAlign: "center" }}>
        Searching database · blending components · analysing nutrition
      </Text>
    </View>
  );

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
        {step === "recognizing" && renderRecognizingStep()}
        {step === "confirm" && renderConfirmStep()}
        {step === "portion" && renderPortionStep()}
        {step === "calculating" && renderCalculatingStep()}

        <Button
          variant="ghost"
          style={styles.cancelBtn}
          onPress={() => router.back()}
        >
          <Text style={{ color: THEME.mutedGrey }}>Cancel</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  centred: { alignItems: "center", paddingVertical: 32 },

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

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  detectedCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6,
  },
  detectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  detectedName: { fontSize: 15, fontWeight: "600", flex: 1 },
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
  detectedMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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

  confirmButtons: { gap: 10, marginTop: 16 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addMissedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  reAnalyzeBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },

  foodRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  foodInputs: { flex: 1, gap: 8 },
  nameRow: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 10 },
  foodName: { minHeight: 40 },
  portionInput: { minHeight: 40 },
  removeBtn: { padding: 8, marginTop: 6 },

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
