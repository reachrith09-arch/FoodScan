import * as React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text as RNText,
  useColorScheme,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { CustomerInfo } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import {
  entitlementUnlocked,
  syncCustomerInfoUntilEntitlementActive,
  useSubscription,
} from "@/lib/revenuecat";
import { THEME } from "@/lib/theme";

const RN_PURCHASES_MISSING =
  /RNPurchases|Native module \(RNPurchases\)|not properly linked/i;

/**
 * Full-screen paywall for testing. Uses the embedded Paywall component when
 * RevenueCat initialized successfully. Otherwise shows actionable setup hints.
 */
export default function PaywallTestScreen() {
  const router = useRouter();
  const {
    refresh,
    applyCustomerInfo,
    purchasesAvailable,
    loading,
    revenueCatDiagnostic,
    paywallOffering,
    entitlementId,
  } = useSubscription();
  const { lastOfferingsError } = revenueCatDiagnostic;
  const isDark = useColorScheme() === "dark";
  const bg = isDark ? "#000000" : "#f9fafb";
  const textColor = isDark ? "#ffffff" : "#111827";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

  const handleDismiss = React.useCallback(() => {
    void refresh().then(() => router.back());
  }, [router, refresh]);

  const handleRestoreCompleted = React.useCallback(
    async ({ customerInfo }: { customerInfo: CustomerInfo }) => {
      applyCustomerInfo(customerInfo);
      let info = customerInfo;
      if (!entitlementUnlocked(info, entitlementId)) {
        info = await syncCustomerInfoUntilEntitlementActive(entitlementId, applyCustomerInfo);
      }
      if (entitlementUnlocked(info, entitlementId)) {
        await refresh();
        router.back();
      }
    },
    [router, refresh, entitlementId, applyCustomerInfo],
  );

  const handlePurchaseCompleted = React.useCallback(
    async ({ customerInfo }: { customerInfo: CustomerInfo }) => {
      applyCustomerInfo(customerInfo);
      let info = customerInfo;
      if (!entitlementUnlocked(info, entitlementId)) {
        info = await syncCustomerInfoUntilEntitlementActive(entitlementId, applyCustomerInfo);
      }
      await refresh();
      router.back();
    },
    [router, refresh, applyCustomerInfo, entitlementId],
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          padding: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
        <RNText style={{ marginTop: 16, fontSize: 15, color: mutedColor }}>
          Initializing purchases…
        </RNText>
      </View>
    );
  }

  if (!purchasesAvailable) {
    const { apiKeyConfigured, nativeModuleDetected, lastInitError } = revenueCatDiagnostic;
    const isMobileNative = Platform.OS === "ios" || Platform.OS === "android";
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const nativePurchasesMissingError = Boolean(
      lastInitError && RN_PURCHASES_MISSING.test(lastInitError),
    );

    return (
      <View style={{ flex: 1, backgroundColor: bg, padding: 24, justifyContent: "center" }}>
        <RNText style={{ fontSize: 18, fontWeight: "700", color: textColor, marginBottom: 12 }}>
          Paywall not available
        </RNText>
        <RNText style={{ fontSize: 14, color: mutedColor, lineHeight: 22, marginBottom: 20 }}>
          RevenueCat did not finish initializing. Your API key is reaching the app; the error below
          means the native Purchases module is missing from the binary you are running—not a wrong
          dashboard key.
        </RNText>
        {isExpoGo ? (
          <View
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? "#374151" : "#e5e7eb",
              backgroundColor: isDark ? "#111827" : "#fffbeb",
            }}
          >
            <RNText style={{ fontSize: 14, fontWeight: "700", color: textColor, marginBottom: 8 }}>
              You are in Expo Go
            </RNText>
            <RNText style={{ fontSize: 14, color: mutedColor, lineHeight: 22 }}>
              Expo Go does not include RevenueCat. Install a development build from this project: run{" "}
              <RNText style={{ fontWeight: "600", color: textColor }}>pnpm run ios</RNText> (or{" "}
              <RNText style={{ fontWeight: "600", color: textColor }}>pnpm prebuild</RNText> then{" "}
              <RNText style={{ fontWeight: "600", color: textColor }}>pnpm run ios</RNText>) and open
              that app—not the purple Expo Go client.
            </RNText>
          </View>
        ) : nativePurchasesMissingError && apiKeyConfigured && isMobileNative ? (
          <View
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? "#374151" : "#e5e7eb",
              backgroundColor: isDark ? "#111827" : "#eff6ff",
            }}
          >
            <RNText style={{ fontSize: 14, fontWeight: "700", color: textColor, marginBottom: 8 }}>
              Rebuild the dev client with native modules
            </RNText>
            <RNText style={{ fontSize: 14, color: mutedColor, lineHeight: 22 }}>
              This repo gitignores <RNText style={{ fontFamily: "Menlo" }}>ios/</RNText>. The simulator
              must run an app built from your machine after pods include RevenueCat. From the project
              root: delete the app from the simulator, then run{" "}
              <RNText style={{ fontWeight: "600", color: textColor }}>pnpm prebuild</RNText> and{" "}
              <RNText style={{ fontWeight: "600", color: textColor }}>pnpm run ios</RNText>. If you
              already had a dev client, it may have been built before{" "}
              <RNText style={{ fontFamily: "Menlo" }}>react-native-purchases</RNText> was added—a full
              native rebuild is required.
            </RNText>
          </View>
        ) : null}
        <View style={{ marginBottom: 16 }}>
          <RNText style={{ fontSize: 14, color: textColor, marginBottom: 6, fontWeight: "600" }}>
            Checklist
          </RNText>
          <RNText style={{ fontSize: 14, color: mutedColor, lineHeight: 22 }}>
            • API key in bundle: {apiKeyConfigured ? "yes" : "no"}
            {"\n"}• Expo Go (Store client): {isExpoGo ? "yes" : "no"}
            {"\n"}• iOS/Android app: {isMobileNative ? "yes" : "no (web builds cannot use IAP)"}
            {"\n"}• RNPurchases native probe: {nativeModuleDetected ? "detected" : "not detected"}
          </RNText>
        </View>
        {lastInitError ? (
          <View
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 10,
              backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
            }}
          >
            <RNText style={{ fontSize: 12, fontWeight: "600", color: textColor, marginBottom: 6 }}>
              Last error
            </RNText>
            <RNText style={{ fontSize: 12, color: mutedColor, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
              {lastInitError}
            </RNText>
          </View>
        ) : null}
        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: THEME.primary,
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignSelf: "flex-start",
          }}
        >
          <RNText style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Go back</RNText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {__DEV__ && lastOfferingsError ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: isDark ? "#1c1917" : "#fff7ed",
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "#44403c" : "#fed7aa",
          }}
        >
          <RNText style={{ fontSize: 12, color: mutedColor, lineHeight: 18 }}>
            Offerings failed to load (often HTTP 404): use the{" "}
            <RNText style={{ fontWeight: "700", color: textColor }}>iOS public SDK key</RNText> from
            RevenueCat for this app, create an offering with packages, and match bundle ID.{"\n"}
            <RNText style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11 }}>
              {lastOfferingsError}
            </RNText>
          </RNText>
        </View>
      ) : null}
      <RevenueCatUI.Paywall
        options={{
          displayCloseButton: true,
          ...(paywallOffering ? { offering: paywallOffering } : {}),
        }}
        onDismiss={handleDismiss}
        onRestoreCompleted={handleRestoreCompleted}
        onPurchaseCompleted={handlePurchaseCompleted}
      />
    </View>
  );
}
