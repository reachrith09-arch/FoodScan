import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addToScanHistory, getHealthProfile } from "@/lib/storage";
import { analyzeProduct } from "@/lib/scoring";
import { searchProducts } from "@/lib/open-food-facts";
import type { ScanResult } from "@/types/food";

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

export default function PhotoScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pickImage = async () => {
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Image picker is not available in this build. Rebuild the app (expo run:ios) after installing native modules.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const takePhoto = async () => {
    const ImagePicker = await getImagePicker();
    if (!ImagePicker) {
      setError("Camera picker is not available in this build. Rebuild the app (expo run:ios) after installing native modules.");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const searchAndAnalyze = async () => {
    const q = query.trim();
    if (!q) {
      setError("Enter a product name to search.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const products = await searchProducts(q, 1);
      const product = products[0];
      if (!product) {
        setError("No product found. Try a different search.");
        setLoading(false);
        return;
      }
      const profile = await getHealthProfile();
      const analysis = analyzeProduct(profile, product);
      const scanResult: ScanResult = {
        id: `${Date.now()}-${product.code}`,
        timestamp: Date.now(),
        source: "photo",
        barcode: product.code,
        product,
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

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="mb-2 text-lg font-semibold text-foreground">
        Take or select a photo, then enter the product name to look it up.
      </Text>
      <View className="mb-4 flex-row gap-2">
        <Button variant="secondary" onPress={takePhoto} className="flex-1">
          <Text className="text-secondary-foreground">Take photo</Text>
        </Button>
        <Button variant="secondary" onPress={pickImage} className="flex-1">
          <Text className="text-secondary-foreground">Choose from library</Text>
        </Button>
      </View>
      {imageUri && (
        <View className="mb-4 h-40 w-full overflow-hidden rounded-lg bg-muted">
          <Image source={{ uri: imageUri }} className="h-full w-full" resizeMode="cover" />
        </View>
      )}
      <Text className="mb-1 text-sm text-muted-foreground">Product name (to search)</Text>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Nutella, Coca Cola"
        editable={!loading}
      />
      {error && (
        <Text className="mt-2 text-sm text-error">{error}</Text>
      )}
      <Button
        className="mt-4"
        onPress={searchAndAnalyze}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-primary-foreground">Search and analyze</Text>
        )}
      </Button>
      <Button variant="ghost" className="mt-2" onPress={() => router.back()}>
        <Text className="text-foreground">Cancel</Text>
      </Button>
    </View>
  );
}
