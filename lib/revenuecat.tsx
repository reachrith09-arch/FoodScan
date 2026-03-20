import * as React from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  NativeModules,
  Platform,
  TurboModuleRegistry,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import Constants from "expo-constants";
import { env } from "@/env";

/** Diagnostic probe only; do not gate init on this (New Architecture may not populate it). */
function probeRevenueCatNativeModule(): boolean {
  return (
    NativeModules.RNPurchases != null ||
    TurboModuleRegistry.get("RNPurchases" as any) != null
  );
}

const ENTITLEMENT_ID = "pro";
const FREE_DAILY_SCANS = 5;
const SCAN_COUNT_KEY = "DAILY_SCAN_COUNT";
const SCAN_DATE_KEY = "DAILY_SCAN_DATE";

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SubscriptionContextValue {
  isPro: boolean;
  loading: boolean;
  /** Number of scans used today (free tier only) */
  scansUsedToday: number;
  /** How many free scans remain today */
  freeScansRemaining: number;
  /** Record a scan. Returns true if allowed, false if paywall should show. */
  recordScan: () => Promise<boolean>;
  /** Check if the user can scan (pro or has free scans left) */
  canScan: boolean;
  /** Check if the user can use the AI assistant (pro only) */
  canUseAssistant: boolean;
  /** Present the native RevenueCat paywall. Returns true if a purchase was made. Set forceShow to always display (for testing). */
  showPaywall: (options?: { forceShow?: boolean }) => Promise<boolean>;
  /** Restore purchases */
  restorePurchases: () => Promise<void>;
  /** Available packages for purchase */
  packages: PurchasesPackage[];
  /** Purchase a specific package */
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Refresh subscription state */
  refresh: () => Promise<void>;
  /** True when RevenueCat native module is available (dev/production build). False in Expo Go. */
  purchasesAvailable: boolean;
  /** Why the paywall may be unavailable (API key, native init). For settings / paywall-test UX. */
  revenueCatDiagnostic: {
    apiKeyConfigured: boolean;
    nativeModuleDetected: boolean;
    lastInitError: string | null;
  };
}

const SubscriptionContext = React.createContext<SubscriptionContextValue | null>(
  null,
);

async function getDailyScanCount(): Promise<{
  count: number;
  date: string;
}> {
  try {
    const [countRaw, dateRaw] = await Promise.all([
      AsyncStorage.getItem(SCAN_COUNT_KEY),
      AsyncStorage.getItem(SCAN_DATE_KEY),
    ]);
    const today = getTodayDateString();
    if (dateRaw !== today) {
      return { count: 0, date: today };
    }
    return { count: Number.parseInt(countRaw ?? "0", 10), date: today };
  } catch {
    return { count: 0, date: getTodayDateString() };
  }
}

async function incrementDailyScanCount(): Promise<number> {
  const today = getTodayDateString();
  const { count, date } = await getDailyScanCount();
  const newCount = date === today ? count + 1 : 1;
  await Promise.all([
    AsyncStorage.setItem(SCAN_COUNT_KEY, String(newCount)),
    AsyncStorage.setItem(SCAN_DATE_KEY, today),
  ]);
  return newCount;
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPro, setIsPro] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [scansUsedToday, setScansUsedToday] = React.useState(0);
  const [packages, setPackages] = React.useState<PurchasesPackage[]>([]);
  const [nativeAvailable, setNativeAvailable] = React.useState(false);
  const [revenueCatDiagnostic, setRevenueCatDiagnostic] = React.useState({
    apiKeyConfigured: false,
    nativeModuleDetected: false,
    lastInitError: null as string | null,
  });

  const checkEntitlement = React.useCallback((info: CustomerInfo) => {
    const active =
      info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false;
    setIsPro(active);
    return active;
  }, []);

  const initRC = React.useCallback(async () => {
    const apiKey =
      env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
      (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatApiKey ||
      "";
    const extraKeyPresent = Boolean(
      (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatApiKey,
    );
    const nativeProbe = probeRevenueCatNativeModule();
    setRevenueCatDiagnostic({
      apiKeyConfigured: Boolean(apiKey),
      nativeModuleDetected: nativeProbe,
      lastInitError: null,
    });
    if (__DEV__) {
      console.log("[RevenueCat] init diagnostic:", {
        apiKeyConfigured: Boolean(apiKey),
        envKeyPresent: Boolean(env.EXPO_PUBLIC_REVENUECAT_API_KEY),
        extraRevenueCatApiKeyPresent: extraKeyPresent,
        nativeModuleDetected: nativeProbe,
        platform: Platform.OS,
      });
    }
    if (!apiKey) {
      setLoading(false);
      return;
    }
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      setLoading(false);
      return;
    }
    const RC = Purchases;
    if (RC == null) {
      const msg =
        "RevenueCat native module is not loaded (Purchases is null). Rebuild with pnpm ios / pnpm prebuild so react-native-purchases is linked—not Expo Go.";
      setRevenueCatDiagnostic((d) => ({ ...d, lastInitError: msg }));
      if (__DEV__) {
        console.warn("[RevenueCat]", msg);
      }
      setLoading(false);
      return;
    }
    try {
      RC.setLogLevel(LOG_LEVEL.DEBUG);
      RC.configure({ apiKey });
      const info = await RC.getCustomerInfo();
      checkEntitlement(info);
      setNativeAvailable(true);
      try {
        const offerings = await RC.getOfferings();
        if (offerings.current?.availablePackages) {
          setPackages(offerings.current.availablePackages);
        }
      } catch {
        // Offerings may not be configured yet
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRevenueCatDiagnostic((d) => ({ ...d, lastInitError: msg }));
      if (__DEV__) {
        console.error("[RevenueCat] configure / getCustomerInfo failed:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [checkEntitlement]);

  React.useEffect(() => {
    initRC();
  }, [initRC]);

  React.useEffect(() => {
    getDailyScanCount().then(({ count }) => setScansUsedToday(count));
  }, []);

  // Sync subscription when RevenueCat sends customer info updates (purchase elsewhere, renewal, etc.)
  React.useEffect(() => {
    if (!nativeAvailable || Purchases == null) return;
    const listener = (info: CustomerInfo) => {
      checkEntitlement(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [nativeAvailable, checkEntitlement]);

  const refresh = React.useCallback(async () => {
    if (!nativeAvailable || Purchases == null) return;
    try {
      const info = await Purchases.getCustomerInfo();
      checkEntitlement(info);
    } catch {
      // ignore
    }
    const { count } = await getDailyScanCount();
    setScansUsedToday(count);
  }, [checkEntitlement, nativeAvailable]);

  // Sync when app comes to foreground (user may have purchased on web or another device)
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const freeScansRemaining = Math.max(0, FREE_DAILY_SCANS - scansUsedToday);
  const canScan = isPro || freeScansRemaining > 0;
  const canUseAssistant = isPro;

  const recordScan = React.useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    const { count } = await getDailyScanCount();
    if (count >= FREE_DAILY_SCANS) {
      setScansUsedToday(count);
      return false;
    }
    const newCount = await incrementDailyScanCount();
    setScansUsedToday(newCount);
    return true;
  }, [isPro]);

  const showPaywall = React.useCallback(
    async (options?: { forceShow?: boolean }): Promise<boolean> => {
      if (!nativeAvailable || Purchases == null) {
        Alert.alert(
          "Purchases not available",
          "In-app purchases are not available in this build. Make sure you're running a development or production build (not Expo Go) with the RevenueCat API key configured.",
        );
        return false;
      }
      try {
        const result = options?.forceShow
          ? await RevenueCatUI.presentPaywall()
          : await RevenueCatUI.presentPaywallIfNeeded({
              requiredEntitlementIdentifier: ENTITLEMENT_ID,
            });
        // Always sync after paywall closes (user may have purchased elsewhere or restored)
        const info = await Purchases.getCustomerInfo();
        checkEntitlement(info);
        return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
      } catch {
        return false;
      }
    },
    [nativeAvailable, checkEntitlement],
  );

  const restorePurchases = React.useCallback(async () => {
    if (!nativeAvailable || Purchases == null) return;
    try {
      const info = await Purchases.restorePurchases();
      checkEntitlement(info);
    } catch {
      // ignore
    }
  }, [checkEntitlement, nativeAvailable]);

  const purchasePackage = React.useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      if (!nativeAvailable || Purchases == null) return false;
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return checkEntitlement(customerInfo);
      } catch {
        return false;
      }
    },
    [checkEntitlement, nativeAvailable],
  );

  const value = React.useMemo(
    () => ({
      isPro,
      loading,
      scansUsedToday,
      freeScansRemaining,
      recordScan,
      canScan,
      canUseAssistant,
      showPaywall,
      restorePurchases,
      packages,
      purchasePackage,
      refresh,
      purchasesAvailable: nativeAvailable,
      revenueCatDiagnostic,
    }),
    [
      isPro,
      loading,
      scansUsedToday,
      freeScansRemaining,
      recordScan,
      canScan,
      canUseAssistant,
      showPaywall,
      restorePurchases,
      packages,
      purchasePackage,
      refresh,
      nativeAvailable,
      revenueCatDiagnostic,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

const DEFAULT_SUBSCRIPTION: SubscriptionContextValue = {
  isPro: false,
  loading: true,
  scansUsedToday: 0,
  freeScansRemaining: FREE_DAILY_SCANS,
  canScan: true,
  canUseAssistant: false,
  recordScan: async () => true,
  showPaywall: async () => false,
  restorePurchases: async () => {},
  packages: [],
  purchasePackage: async () => false,
  refresh: async () => {},
  purchasesAvailable: false,
  revenueCatDiagnostic: {
    apiKeyConfigured: false,
    nativeModuleDetected: false,
    lastInitError: null,
  },
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = React.useContext(SubscriptionContext);
  return ctx ?? DEFAULT_SUBSCRIPTION;
}

export { FREE_DAILY_SCANS };
