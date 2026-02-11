import { useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { ArrowLeft, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { addToScanHistory, getHealthProfile } from "@/lib/storage";
import { analyzeProduct } from "@/lib/scoring";
import {
  getAverageNutrimentsForQuery,
  searchProducts,
  LABEL_SEARCH_TIMEOUT_MS,
} from "@/lib/open-food-facts";
import {
  clearSelectedProductForLabel,
  getSelectedProductForLabel,
  setLabelLookupResults,
} from "@/lib/label-pick-store";
import type { ProductResult, ScanResult } from "@/types/food";

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

export default function LabelScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const backIconColor = isDark ? "#ffffff" : "#111827";
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [productName, setProductName] = React.useState("");
  const [brands, setBrands] = React.useState("");
  const [ingredientsText, setIngredientsText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [sodiumMg, setSodiumMg] = React.useState("");
  const [sugarG, setSugarG] = React.useState("");

  const [lookupSearching, setLookupSearching] = React.useState(false);

  const fillFromProduct = React.useCallback((p: ProductResult) => {
    setProductName(p.product_name ?? "");
    setBrands(p.brands ?? "");
    setIngredientsText(p.ingredients_text_en ?? p.ingredients_text ?? "");
    const n = p.nutriments;
    if (n) {
      if (n["energy-kcal_100g"] != null) setKcal(String(Math.round(n["energy-kcal_100g"])));
      if (n.sodium_100g != null) setSodiumMg(String(Math.round(n.sodium_100g)));
      if (n.sugars_100g != null) setSugarG(String(Math.round(n.sugars_100g * 10) / 10));
      if (n.carbohydrates_100g != null) setCarbs(String(n.carbohydrates_100g));
      if (n.proteins_100g != null) setProtein(String(n.proteins_100g));
      if (n.fat_100g != null) setFat(String(n.fat_100g));
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const selected = getSelectedProductForLabel();
      if (selected) {
        fillFromProduct(selected);
        clearSelectedProductForLabel();
      }
    }, [fillFromProduct])
  );

  const pickOrTake = async (mode: "camera" | "library") => {
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Image picker is not available in this build. Rebuild the app (expo run:ios) after installing native modules.");
      return;
    }
    const perm =
      mode === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(mode === "camera" ? "Camera permission is required." : "Photo library permission is required.");
      return;
    }
    const result =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const toNumber = (s: string): number | undefined => {
    const v = Number(String(s).trim());
    return Number.isFinite(v) ? v : undefined;
  };

  const runLookup = async () => {
    const q = [productName.trim(), brands.trim()].filter(Boolean).join(" ");
    if (!q) {
      setError("Enter a product name or brand to look up.");
      return;
    }
    setLookupSearching(true);
    setError(null);
    try {
      const profile = await getHealthProfile();
      const results = await searchProducts(q, 20, LABEL_SEARCH_TIMEOUT_MS, profile?.countryCode);
      setLabelLookupResults(results);
      router.push(`/label-pick?q=${encodeURIComponent(q)}`);
    } catch {
      setError("Lookup failed. Check your connection and try again.");
    } finally {
      setLookupSearching(false);
    }
  };

  const analyze = async () => {
    if (!productName.trim() && !ingredientsText.trim()) {
      setError("Add at least a product name or ingredients text.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasNutrients =
        [kcal, protein, carbs, fat, sodiumMg, sugarG].some((s) =>
          String(s).trim()
        ) || ingredientsText.trim().length > 0;

      let product: ProductResult;

      if (!hasNutrients) {
        const query = [productName.trim(), brands.trim()].filter(Boolean).join(" ");
        const found = query ? await searchProducts(query, 5) : [];
        if (found.length > 0) {
          product = { ...found[0], code: `manual-${Date.now()}` };
        } else {
          const avgNut = query
            ? await getAverageNutrimentsForQuery(query)
            : undefined;
          product = {
            code: `manual-${Date.now()}`,
            product_name: productName.trim() || "Custom label item",
            brands: brands.trim() || undefined,
            ingredients_text: ingredientsText.trim() || undefined,
            nutriments: avgNut,
          };
        }
      } else {
        product = {
          code: `manual-${Date.now()}`,
          product_name: productName.trim() || "Custom label item",
          brands: brands.trim() || undefined,
          ingredients_text: ingredientsText.trim() || undefined,
          nutriments: {
            "energy-kcal_100g": toNumber(kcal),
            proteins_100g: toNumber(protein),
            carbohydrates_100g: toNumber(carbs),
            fat_100g: toNumber(fat),
            sodium_100g: toNumber(sodiumMg),
            sugars_100g: toNumber(sugarG),
          },
        };
      }

      const profile = await getHealthProfile();
      const analysis = analyzeProduct(profile, product);
      const scan: ScanResult = {
        id: `${Date.now()}-${product.code}`,
        timestamp: Date.now(),
        source: "label",
        barcode: product.code,
        product,
        healthRisks: analysis.healthRisks,
        analysis,
      };
      await addToScanHistory(scan);
      router.replace(`/results/${scan.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const headerTopPad = React.useMemo(() => Math.max(0, insets.top - 34), [insets.top]);
  const headerRowHeight = 44;
  const headerHeight = React.useMemo(() => headerTopPad + headerRowHeight, [headerTopPad]);

  return (
    <View className="flex-1 bg-background" style={isDark ? { backgroundColor: "#000000" } : undefined}>
      <View
        className="bg-card px-4"
        style={{
          height: headerHeight,
          paddingTop: headerTopPad,
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
          ...(isDark ? { backgroundColor: "#000000", borderBottomWidth: 1, borderBottomColor: "#525252" } : {}),
        }}
      >
        <View className="flex-row items-center justify-between" style={{ height: headerRowHeight }}>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            style={isDark ? { borderWidth: 1, borderColor: "#525252", borderRadius: 10 } : undefined}
          >
            <ArrowLeft size={20} color={backIconColor} />
          </Button>
        </View>
      </View>
      <ScrollView
        className="flex-1 bg-background"
        style={isDark ? { backgroundColor: "#000000" } : undefined}
        contentContainerStyle={{ padding: 16, paddingTop: headerHeight + 16, paddingBottom: 32 }}
      >
      <View className="mb-4">
        <Text className="text-2xl font-semibold text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>Food label scan</Text>
        <Text className="mt-1 text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
          Take a photo of the label, then paste/confirm ingredients and nutrition facts. OCR can be plugged in later.
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
          Don&apos;t have the label? Enter product name and brand, then tap &quot;Look up product&quot; to find it in our database—or check the brand&apos;s website for ingredients and nutrition.
        </Text>
      </View>

      <View className="mb-4 flex-row gap-2">
        <Button variant="secondary" onPress={() => pickOrTake("camera")} className="flex-1">
          <Text className="text-secondary-foreground">Take label photo</Text>
        </Button>
        <Button variant="secondary" onPress={() => pickOrTake("library")} className="flex-1">
          <Text className="text-secondary-foreground">Choose photo</Text>
        </Button>
      </View>

      {imageUri && (
        <View className="mb-4 h-44 w-full overflow-hidden rounded-xl bg-muted">
          <Image source={{ uri: imageUri }} className="h-full w-full" resizeMode="cover" />
        </View>
      )}

      {error && <Text className="mb-3 text-sm text-error">{error}</Text>}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle style={isDark ? { color: "#ffffff" } : undefined}>Product details</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <LabeledInput label="Product name" value={productName} onChange={setProductName} placeholder="e.g. Granola bar" />
          <LabeledInput label="Brand (optional)" value={brands} onChange={setBrands} placeholder="e.g. Dunkin" />
          <Button
            variant="outline"
            size="sm"
            onPress={runLookup}
            disabled={lookupSearching || (!productName.trim() && !brands.trim())}
            className="flex-row items-center gap-2 self-start"
          >
            <Search size={16} color={isDark ? "#ffffff" : "#111827"} />
            <Text style={isDark ? { color: "#ffffff" } : undefined}>
              {lookupSearching ? "Searching…" : "Look up product"}
            </Text>
          </Button>
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">Ingredients (paste from label)</Text>
            <TextInput
              value={ingredientsText}
              onChangeText={setIngredientsText}
              placeholder="Ingredients list..."
              multiline
              textAlignVertical="top"
              className="rounded-xl border border-border bg-input-background px-3 py-3 text-foreground"
              style={{ minHeight: 110 }}
            />
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={isDark ? { color: "#ffffff" } : undefined}>Nutrition facts (per 100g)</CardTitle>
          <Text className="text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>Optional but improves scoring accuracy.</Text>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="flex-row gap-2">
            <LabeledInput label="Calories (kcal)" value={kcal} onChange={setKcal} placeholder="e.g. 250" flex />
            <LabeledInput label="Sodium (mg)" value={sodiumMg} onChange={setSodiumMg} placeholder="e.g. 400" flex />
          </View>
          <View className="flex-row gap-2">
            <LabeledInput label="Sugar (g)" value={sugarG} onChange={setSugarG} placeholder="e.g. 12" flex />
            <LabeledInput label="Carbs (g)" value={carbs} onChange={setCarbs} placeholder="e.g. 35" flex />
          </View>
          <View className="flex-row gap-2">
            <LabeledInput label="Protein (g)" value={protein} onChange={setProtein} placeholder="e.g. 8" flex />
            <LabeledInput label="Fat (g)" value={fat} onChange={setFat} placeholder="e.g. 10" flex />
          </View>
          <Button onPress={analyze} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-primary-foreground">Analyze label</Text>}
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            <Text className="text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>Cancel</Text>
          </Button>
        </CardContent>
      </Card>
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  flex?: boolean;
}) {
  return (
    <View className={flex ? "flex-1 gap-1" : "gap-1"}>
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="default"
        className="rounded-xl border border-border bg-input-background px-3 py-3 text-foreground"
      />
    </View>
  );
}

