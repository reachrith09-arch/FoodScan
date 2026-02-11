import { useFocusEffect, useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as ExpoCamera from "expo-camera";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { addToScanHistory } from "@/lib/storage";
import { getProductByBarcode } from "@/lib/open-food-facts";
import { getHealthProfile } from "@/lib/storage";
import { analyzeProduct } from "@/lib/scoring";
import { getCachedProduct, isOnline } from "@/lib/offline";
import type { ScanResult } from "@/types/food";

type CameraFacing = "back" | "front";

export default function ScannerScreen() {
  const [cameraAvailable, setCameraAvailable] = React.useState<boolean | null>(null);
  const [permission, requestPermission, getPermission] = ExpoCamera.useCameraPermissions({
    get: true,
  });
  const [requestingPermission, setRequestingPermission] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [scanned, setScanned] = React.useState(false);
  const [facing, setFacing] = React.useState<CameraFacing>("back");
  const router = useRouter();
  const CameraView = ExpoCamera.CameraView as React.ComponentType<any>;

  const toggleCameraFacing = React.useCallback(() => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }, []);

  const [notFound, setNotFound] = React.useState(false);
  const [offlineMiss, setOfflineMiss] = React.useState(false);
  const [offlineHit, setOfflineHit] = React.useState(false);

  React.useEffect(() => {
    const native = requireOptionalNativeModule("ExpoCamera");
    setCameraAvailable(!!native);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (permission?.granted) return;
      getPermission();
    }, [getPermission, permission?.granted])
  );

  const handleBarcodeScanned = React.useCallback(
    async ({ data }: { data: string }) => {
      if (scanned || loading) return;
      setScanned(true);
      setLoading(true);
      setNotFound(false);
      setOfflineMiss(false);
      setOfflineHit(false);
      try {
        const online = await isOnline().catch(() => true);
        if (!online) {
          const cached = await getCachedProduct(data);
          if (!cached) {
            setOfflineMiss(true);
            setLoading(false);
            setScanned(false);
            return;
          }
          setOfflineHit(true);
        }
        const product = await getProductByBarcode(data);
        if (!product) {
          setNotFound(true);
          setLoading(false);
          setScanned(false);
          return;
        }
        const profile = await getHealthProfile();
        const analysis = analyzeProduct(profile, product);
        const result: ScanResult = {
          id: `${Date.now()}-${product.code}`,
          timestamp: Date.now(),
          source: "barcode",
          barcode: data,
          product,
          healthRisks: analysis.healthRisks,
          analysis,
        };
        await addToScanHistory(result);
        router.replace(`/results/${result.id}`);
      } catch {
        setLoading(false);
        setScanned(false);
      }
    },
    [scanned, loading, router]
  );

  if (cameraAvailable === false) {
    return (
      <View style={styles.centered}>
        <Text className="mb-3 text-center text-foreground">
          Camera module isn’t available in this build.
        </Text>
        <Text className="mb-6 text-center text-muted-foreground">
          Rebuild the app so native modules are included (run the iOS build again), then reopen the dev client.
        </Text>
        <Button onPress={() => router.back()} variant="secondary">
          <Text className="text-secondary-foreground">Back</Text>
        </Button>
      </View>
    );
  }

  if (cameraAvailable !== true) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    const handleGrantPermission = () => {
      setPermissionError(null);
      setRequestingPermission(true);
      requestPermission()
        .then((p) => {
          if (p && !p.granted && p.canAskAgain === false) {
            Linking.openSettings();
          }
        })
        .catch(() => {
          setPermissionError("Couldn’t request camera access.");
        })
        .finally(() => {
          setRequestingPermission(false);
        });
    };

    const canAskAgain = permission.canAskAgain !== false;
    const isWeb = Platform.OS === "web";

    return (
      <View style={styles.centered}>
        <Text className="mb-4 text-center text-foreground">
          We need camera access to scan barcodes.
        </Text>
        {isWeb && (
          <Text className="mb-3 text-center text-sm text-muted-foreground">
            When you tap the button below, your browser may ask for camera access. Allow it to continue.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.grantPermissionButton, requestingPermission && styles.grantPermissionButtonDisabled]}
          onPress={handleGrantPermission}
          disabled={requestingPermission}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {requestingPermission ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.grantPermissionButtonText}>Grant permission</Text>
          )}
        </TouchableOpacity>
        {(permissionError || !canAskAgain) && (
          <Text className="mt-3 text-center text-sm text-muted-foreground">
            {permissionError ?? "Camera was denied. Open Settings to enable it, then return here."}
          </Text>
        )}
        {(!canAskAgain || permissionError) && (
          <TouchableOpacity
            style={styles.openSettingsButton}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.openSettingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {CameraView ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
      ) : null}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text className="mt-2 text-white">Looking up product...</Text>
        </View>
      )}
      {notFound && (
        <View style={styles.notFound}>
          <Text className="text-center text-white">
            Product not found. Try another barcode.
          </Text>
          <Button
            variant="secondary"
            className="mt-2"
            onPress={() => setNotFound(false)}
            accessibilityLabel="Scan again"
          >
            <Text className="text-secondary-foreground">Scan again</Text>
          </Button>
        </View>
      )}
      {offlineMiss && (
        <View style={styles.notFound}>
          <Text className="text-center text-white">
            Offline and this product isn’t cached yet. Connect to the internet to look it up.
          </Text>
          <Button
            variant="secondary"
            className="mt-2"
            onPress={() => setOfflineMiss(false)}
            accessibilityLabel="Scan again"
          >
            <Text className="text-secondary-foreground">Scan again</Text>
          </Button>
        </View>
      )}
      {offlineHit && (
        <View style={styles.notFound}>
          <Text className="text-center text-white">
            Offline mode: showing cached product data.
          </Text>
          <Button
            variant="secondary"
            className="mt-2"
            onPress={() => setOfflineHit(false)}
            accessibilityLabel="Dismiss offline message"
          >
            <Text className="text-secondary-foreground">OK</Text>
          </Button>
        </View>
      )}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
          <Text style={styles.flipButtonText}>Flip Camera</Text>
        </TouchableOpacity>
        <Button
          variant="secondary"
          onPress={() => router.back()}
          accessibilityLabel="Cancel and go back"
        >
          <Text className="text-secondary-foreground">Cancel</Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  grantPermissionButton: {
    backgroundColor: "#0a0a0a",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  grantPermissionButtonDisabled: {
    opacity: 0.7,
  },
  grantPermissionButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  openSettingsButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  openSettingsButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0a0a0a",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  flipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  flipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  notFound: {
    position: "absolute",
    top: 80,
    left: 24,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
});
