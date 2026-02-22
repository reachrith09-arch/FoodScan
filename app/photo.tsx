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
import { Camera, Check, ImageIcon, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react-native";
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
import { recognizeFoodsInImage } from "@/lib/recognize-food";
import type { ScanResult } from "@/types/food";
import { env } from "@/env";

const PORTION_PLACEHOLDER = "e.g. 100g, 1 cup, 1 serving";

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
}

type Step = "capture" | "recognizing" | "confirm" | "portion" | "calculating";

export default function PhotoScreen() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("capture");
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [foods, setFoods] = React.useState<FoodEntry[]>([]);
  const [guessConfirmed, setGuessConfirmed] = React.useState<boolean | null>(null);
  const hasSupabase = !!(env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  const takePhoto = async () => {
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Camera is not available. Rebuild the app (expo run:ios) after installing native modules.");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission is required to take a picture.");
      return;
    }
    setError(null);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const base64 = result.assets[0].base64;
        setImageUri(result.assets[0].uri);
        setImageBase64(base64 ?? null);
        setFoods([]);
        setGuessConfirmed(null);
        if (hasSupabase && base64) {
          setStep("recognizing");
          runRecognition(base64);
        } else {
          setStep("portion");
          setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
        }
      }
    } catch (e) {
      setError("Could not take picture. Please try again.");
    }
  };

  const pickImage = async () => {
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Photo library is not available. Rebuild the app (expo run:ios) after installing native modules.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const base64 = result.assets[0].base64;
        setImageUri(result.assets[0].uri);
        setImageBase64(base64 ?? null);
        setFoods([]);
        setGuessConfirmed(null);
        if (hasSupabase && base64) {
          setStep("recognizing");
          runRecognition(base64);
        } else {
          setStep("portion");
          setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
        }
      }
    } catch (e) {
      setError("Could not select image. Please try again.");
    }
  };

  const runRecognition = async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const recognized = await recognizeFoodsInImage(base64);
      if (recognized.length > 0) {
        setFoods(
          recognized.map((name, i) => ({
            id: `food-${Date.now()}-${i}`,
            name: name.trim(),
            portion: "1 serving",
          }))
        );
        setStep("confirm");
      } else {
        setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
        setStep("portion");
      }
    } catch {
      setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
      setStep("portion");
      setError("AI recognition failed. Please enter the food manually.");
    } finally {
      setLoading(false);
    }
  };

  const confirmGuess = (confirmed: boolean) => {
    setGuessConfirmed(confirmed);
    setStep("portion");
    if (confirmed && foods.length === 0) {
      setFoods([{ id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
    }
  };

  const addFood = () => {
    setFoods((prev) => [...prev, { id: `food-${Date.now()}`, name: "", portion: "1 serving" }]);
  };

  const removeFood = (id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFood = (id: string, patch: Partial<FoodEntry>) => {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const calculateMealScore = async () => {
    const valid = foods.filter((f) => f.name.trim());
    if (valid.length === 0) {
      setError("Add at least one food with a name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mealItems: MealItem[] = [];
      for (const f of valid) {
        let products = await searchProducts(f.name.trim(), 1);
        let product = products[0];
        if (!product) {
          product = await lookupProductOnline(f.name.trim());
        }
        if (!product) {
          setError(`No product found for "${f.name}". Try a different name.`);
          setLoading(false);
          return;
        }
        const grams = parsePortionToGrams(f.portion) ?? 100;
        mealItems.push({ product, portionGrams: grams });
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
    }
  };

  const hasFoods = foods.length > 0;
  const canCalculate = foods.some((f) => f.name.trim()) && !loading;

  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const bgColor = isDark ? THEME.darkBg : THEME.bgLightTop;
  const cardBg = isDark ? THEME.darkCard : THEME.white;
  const borderColor = isDark ? THEME.borderDark : THEME.borderLight;

  const renderCaptureStep = () => (
    <>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "rgba(22,128,61,0.15)" }]}>
        <UtensilsCrossed size={36} color={THEME.primary} strokeWidth={2} />
      </View>
      <Text className="text-xl font-bold text-foreground" style={isDark ? { color: "#fff" } : { color: THEME.darkGrey }}>
        Take a picture of your food
      </Text>
      <Text className="mb-6 text-sm text-muted-foreground" style={{ color: THEME.mutedGrey }}>
        AI will recognize what it is. Then confirm the guess and add portion size.
      </Text>
      <Button
        onPress={takePhoto}
        style={[styles.takePhotoButton, THEME.shadowButton]}
      >
        <Camera size={24} color="#fff" style={{ marginRight: 10 }} />
        <Text className="text-lg font-semibold text-white">Take a picture</Text>
      </Button>
      <Pressable
        onPress={pickImage}
        style={({ pressed }) => [
          styles.chooseButton,
          { borderColor, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <ImageIcon size={20} color={THEME.primary} style={{ marginRight: 8 }} />
        <Text className="text-base font-medium" style={{ color: THEME.primary }}>
          Choose from library
        </Text>
      </Pressable>
    </>
  );

  const renderRecognizingStep = () => (
    <View style={styles.recognizing}>
      <ActivityIndicator color={THEME.primary} size="large" />
      <Text className="mt-4 text-base font-medium" style={{ color: isDark ? "#fff" : THEME.darkGrey }}>
        AI is recognizing your food…
      </Text>
    </View>
  );

  const renderConfirmStep = () => (
    <>
      <Text className="text-lg font-semibold text-foreground mb-2" style={isDark ? { color: "#fff" } : { color: THEME.darkGrey }}>
        Is this correct?
      </Text>
      <Text className="mb-4 text-sm text-muted-foreground" style={{ color: THEME.mutedGrey }}>
        We think this is: {foods.map((f) => f.name || "?").join(", ")}
      </Text>
      <View style={styles.confirmRow}>
        <Button onPress={() => confirmGuess(true)} style={THEME.shadowButton}>
          <Check size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text className="font-semibold text-white">Yes, correct</Text>
        </Button>
        <Button
          variant="outline"
          onPress={() => confirmGuess(false)}
          style={[styles.editButton, { borderColor }]}
        >
          <Pencil size={18} color={THEME.primary} style={{ marginRight: 6 }} />
          <Text className="font-semibold" style={{ color: THEME.primary }}>No, let me edit</Text>
        </Button>
      </View>
    </>
  );

  const renderPortionStep = () => (
    <>
      <Text className="text-lg font-semibold text-foreground mb-1" style={isDark ? { color: "#fff" } : { color: THEME.darkGrey }}>
        Add portion size
      </Text>
      <Text className="mb-4 text-sm text-muted-foreground" style={{ color: THEME.mutedGrey }}>
        How much did you have? (e.g. 100g, 1 cup, 1 serving)
      </Text>
      {foods.map((f) => (
        <View key={f.id} style={[styles.foodRow, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.foodInputs}>
            <Input
              value={f.name}
              onChangeText={(text) => updateFood(f.id, { name: text })}
              placeholder="Food name"
              editable={!loading}
              style={[styles.input, styles.foodName, isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" }]}
            />
            <Input
              value={f.portion}
              onChangeText={(text) => updateFood(f.id, { portion: text })}
              placeholder={PORTION_PLACEHOLDER}
              editable={!loading}
              style={[styles.input, styles.portionInput, isDark && { borderColor: THEME.borderDark, color: "#f4f4f5" }]}
            />
          </View>
          <Pressable onPress={() => removeFood(f.id)} style={styles.removeBtn} hitSlop={8}>
            <Trash2 size={18} color={THEME.mutedGrey} />
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={addFood}
        style={({ pressed }) => [styles.addBtn, { borderColor, opacity: pressed ? 0.8 : 1 }]}
      >
        <Plus size={16} color={THEME.primary} />
        <Text className="text-sm font-medium" style={{ color: THEME.primary }}>Add food</Text>
      </Pressable>
      {error && <Text className="mt-2 text-sm text-error">{error}</Text>}
      <Button
        className="mt-4"
        onPress={calculateMealScore}
        disabled={!canCalculate}
        style={THEME.shadowButton}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-semibold text-primary-foreground">Get health score</Text>
        )}
      </Button>
    </>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {step === "capture" && renderCaptureStep()}
        {step === "recognizing" && renderRecognizingStep()}
        {step === "confirm" && imageUri && (
          <>
            <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
              <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
            </View>
            <View style={[styles.divider, { backgroundColor: THEME.primary, opacity: 0.3 }]} />
            {renderConfirmStep()}
          </>
        )}
        {step === "portion" && imageUri && (
          <>
            <View style={[styles.photoPreview, { backgroundColor: cardBg, borderColor }]}>
              <Image source={{ uri: imageUri }} style={styles.photoImage} resizeMode="cover" />
            </View>
            <View style={[styles.divider, { backgroundColor: THEME.primary, opacity: 0.3 }]} />
            {renderPortionStep()}
          </>
        )}
        {step === "capture" && error && <Text className="mt-4 text-sm text-error">{error}</Text>}
        <Button variant="ghost" className="mt-6" onPress={() => router.back()}>
          <Text className="text-foreground">Cancel</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
  chooseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "solid",
  },
  recognizing: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  photoPreview: {
    height: 180,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
  },
  photoImage: { width: "100%", height: "100%" },
  divider: { height: 3, borderRadius: 2, marginVertical: 20 },
  confirmRow: { gap: 12 },
  editButton: { marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10 },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  foodInputs: { flex: 1, gap: 8 },
  foodName: { minHeight: 40 },
  portionInput: { minHeight: 40 },
  removeBtn: { padding: 8 },
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
  },
});
