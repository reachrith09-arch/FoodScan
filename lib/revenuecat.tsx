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
  type PurchasesOffering,
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

const DEFAULT_ENTITLEMENT_ID = "pro";
const FREE_DAILY_SCANS = 5;

function resolveEntitlementId(): string {
  return (
    env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ||
    (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatEntitlementId?.trim() ||
    DEFAULT_ENTITLEMENT_ID
  );
}

function pickPaywallOffering(
  offerings: Awaited<ReturnType<typeof Purchases.getOfferings>>,
  preferredId: string | undefined,
): PurchasesOffering | null {
  const id = preferredId?.trim();
  if (id && offerings.all[id]) {
    return offerings.all[id];
  }
  return offerings.current ?? null;
}

/**
 * True if the user should get Pro access for this app build.
 * - Matches configured entitlement id (exact + case-insensitive) on `entitlements.active`
 * - Falls back to `entitlements.all` when an entitlement is active but omitted from `active` (verification edge cases)
 * - If exactly one entitlement is active and the id still does not match, unlock anyway (typical single-SKU apps
 *   where EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID does not match the RevenueCat dashboard identifier)
 */
export function entitlementUnlocked(
  info: CustomerInfo,
  entitlementId: string,
): boolean {
  const active = info.entitlements.active;
  const all = info.entitlements.all;

  const matchesConfigured = (map: typeof active): boolean => {
    if (map[entitlementId]?.isActive) return true;
    const want = entitlementId.toLowerCase();
    for (const key of Object.keys(map)) {
      if (key.toLowerCase() === want && map[key]?.isActive) return true;
    }
    return false;
  };

  if (matchesConfigured(active)) return true;
  if (matchesConfigured(all)) return true;

  const activeKeys = Object.keys(active);
  if (activeKeys.length === 1 && active[activeKeys[0]]?.isActive) {
    if (
      __DEV__ &&
      activeKeys[0] !== entitlementId &&
      activeKeys[0].toLowerCase() !== entitlementId.toLowerCase()
    ) {
      console.warn(
        "[RevenueCat] Pro unlocked via your only active entitlement",
        `"${activeKeys[0]}".`,
        `Set EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID="${activeKeys[0]}" to match the dashboard.`,
      );
    }
    return true;
  }

  return false;
}

const POST_PURCHASE_SYNC_ATTEMPTS = 8;
const POST_PURCHASE_SYNC_DELAY_MS = 350;

/**
 * StoreKit / Test Store can lag behind PAYWALL_RESULT; poll until CustomerInfo shows the entitlement.
 */
export async function syncCustomerInfoUntilEntitlementActive(
  entitlementId: string,
  applyInfo: (info: CustomerInfo) => void,
): Promise<CustomerInfo> {
  if (Purchases == null) {
    throw new Error("Purchases not configured");
  }
  const pull = async (): Promise<CustomerInfo> => {
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch {
      /* ignore */
    }
    const next = await Purchases.getCustomerInfo();
    applyInfo(next);
    return next;
  };

  let info = await pull();
  if (entitlementUnlocked(info, entitlementId)) return info;

  try {
    const { customerInfo } = await Purchases.syncPurchasesForResult();
    applyInfo(customerInfo);
    info = customerInfo;
    if (entitlementUnlocked(info, entitlementId)) return info;
  } catch {
    /* ignore */
  }

  for (let i = 0; i < POST_PURCHASE_SYNC_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POST_PURCHASE_SYNC_DELAY_MS));
    info = await pull();
    if (entitlementUnlocked(info, entitlementId)) return info;
  }

  return info;
}
const SCAN_COUNT_KEY = "DAILY_SCAN_COUNT";
const SCAN_DATE_KEY = "DAILY_SCAN_DATE";
/** Last known Pro state; used for optimistic UI before RC finishes on cold start (overwritten by CustomerInfo). */
const PRO_UNLOCKED_CACHE_KEY = "REVENUECAT_PRO_UNLOCKED";

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
    /** e.g. wrong iOS/Android key, no offerings in dashboard — paywall may still load without packages */
    lastOfferingsError: string | null;
  };
  /**
   * Offering used for RevenueCat Paywalls (dashboard template). Null until offerings load.
   * Set EXPO_PUBLIC_REVENUECAT_OFFERING_ID to target a non-current offering.
   */
  paywallOffering: PurchasesOffering | null;
  /** Entitlement identifier used for Pro gating (must match RevenueCat dashboard). */
  entitlementId: string;
  /**
   * Apply CustomerInfo from Paywall / purchase callbacks immediately so `isPro` updates
   * before the next `getCustomerInfo` round-trip (avoids racing `router.back()`).
   */
  applyCustomerInfo: (info: CustomerInfo) => void;
  /**
   * __DEV__ only: `Purchases.logOut()` (new anonymous RevenueCat user) + clear local Pro cache.
   * Does not cancel an Apple subscription; use Sandbox Settings → Subscriptions if StoreKit says “already subscribed”.
   */
  resetPurchasesForTesting: () => Promise<void>;
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
  /** Kept in sync inside `checkEntitlement` so async callers (e.g. after `showPaywall`) see Pro immediately without waiting for a re-render. */
  const isProRef = React.useRef(false);
  const revenueCatConfiguredRef = React.useRef(false);
  /** Avoid repeated Purchases.setAttributes calls for the same Pro state. */
  const lastRegisteredProRef = React.useRef<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [scansUsedToday, setScansUsedToday] = React.useState(0);
  const [packages, setPackages] = React.useState<PurchasesPackage[]>([]);
  const [paywallOffering, setPaywallOffering] = React.useState<PurchasesOffering | null>(null);
  const [nativeAvailable, setNativeAvailable] = React.useState(false);
  const [revenueCatDiagnostic, setRevenueCatDiagnostic] = React.useState({
    apiKeyConfigured: false,
    nativeModuleDetected: false,
    lastInitError: null as string | null,
    lastOfferingsError: null as string | null,
  });

  const entitlementId = React.useMemo(() => resolveEntitlementId(), []);

  const checkEntitlement = React.useCallback(
    (info: CustomerInfo) => {
      const unlocked = entitlementUnlocked(info, entitlementId);
      if (__DEV__ && !unlocked && Object.keys(info.entitlements.active).length > 0) {
        console.warn(
          "[RevenueCat] No Pro unlock for entitlement",
          `"${entitlementId}".`,
          "Active keys:",
          Object.keys(info.entitlements.active),
          "— set EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID to match Product catalog → Entitlements in RevenueCat.",
        );
      }
      isProRef.current = unlocked;
      setIsPro(unlocked);
      void AsyncStorage.setItem(PRO_UNLOCKED_CACHE_KEY, unlocked ? "1" : "0").catch(() => {});
      if (Purchases != null && lastRegisteredProRef.current !== unlocked) {
        lastRegisteredProRef.current = unlocked;
        void Purchases.setAttributes({
          pro_subscriber: unlocked ? "true" : "false",
        }).catch(() => {});
      }
      return unlocked;
    },
    [entitlementId],
  );

  const applyCustomerInfo = React.useCallback(
    (info: CustomerInfo) => {
      checkEntitlement(info);
    },
    [checkEntitlement],
  );

  React.useEffect(() => {
    void AsyncStorage.getItem(PRO_UNLOCKED_CACHE_KEY).then((v) => {
      if (v !== "1" || revenueCatConfiguredRef.current) return;
      isProRef.current = true;
      setIsPro(true);
    });
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
      lastOfferingsError: null,
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
      revenueCatConfiguredRef.current = true;
      void AsyncStorage.removeItem(PRO_UNLOCKED_CACHE_KEY).catch(() => {});
      isProRef.current = false;
      setIsPro(false);
      setLoading(false);
      return;
    }
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      revenueCatConfiguredRef.current = true;
      setLoading(false);
      return;
    }
    const RC = Purchases;
    if (RC == null) {
      revenueCatConfiguredRef.current = true;
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
      // DEBUG spams LogBox on offerings 404 (wrong platform key / empty project).
      RC.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
      RC.configure({ apiKey });
      const info = await RC.getCustomerInfo();
      revenueCatConfiguredRef.current = true;
      checkEntitlement(info);
      setNativeAvailable(true);
      try {
        const offerings = await RC.getOfferings();
        const offering = pickPaywallOffering(
          offerings,
          env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ||
            (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatOfferingId,
        );
        setPaywallOffering(offering);
        setRevenueCatDiagnostic((d) => ({ ...d, lastOfferingsError: null }));
        if (offering?.availablePackages?.length) {
          setPackages(offering.availablePackages);
        } else if (offerings.current?.availablePackages) {
          setPackages(offerings.current.availablePackages);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRevenueCatDiagnostic((d) => ({ ...d, lastOfferingsError: msg }));
      }
    } catch (e) {
      revenueCatConfiguredRef.current = true;
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

  const reloadOfferingsOnly = React.useCallback(async () => {
    if (!nativeAvailable || Purchases == null) return;
    try {
      const offerings = await Purchases.getOfferings();
      const offering = pickPaywallOffering(
        offerings,
        env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ||
          (Constants.expoConfig?.extra as Record<string, string> | undefined)?.revenueCatOfferingId,
      );
      setPaywallOffering(offering);
      setRevenueCatDiagnostic((d) => ({ ...d, lastOfferingsError: null }));
      if (offering?.availablePackages?.length) {
        setPackages(offering.availablePackages);
      } else if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRevenueCatDiagnostic((d) => ({ ...d, lastOfferingsError: msg }));
    }
  }, [nativeAvailable]);

  const refresh = React.useCallback(async () => {
    if (!nativeAvailable || Purchases == null) return;
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch {
      // ignore
    }
    try {
      const info = await Purchases.getCustomerInfo();
      checkEntitlement(info);
    } catch {
      // ignore
    }
    await reloadOfferingsOnly();
    const { count } = await getDailyScanCount();
    setScansUsedToday(count);
  }, [checkEntitlement, nativeAvailable, reloadOfferingsOnly]);

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
    if (isProRef.current) return true;
    const { count } = await getDailyScanCount();
    if (count >= FREE_DAILY_SCANS) {
      setScansUsedToday(count);
      return false;
    }
    const newCount = await incrementDailyScanCount();
    setScansUsedToday(newCount);
    return true;
  }, []);

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
        const paywallParams = paywallOffering ? { offering: paywallOffering } : {};
        const result = options?.forceShow
          ? await RevenueCatUI.presentPaywall({
              ...paywallParams,
              displayCloseButton: true,
            })
          : await RevenueCatUI.presentPaywallIfNeeded({
              requiredEntitlementIdentifier: entitlementId,
              ...paywallParams,
              displayCloseButton: true,
            });
        const mayHaveNewPurchase =
          result === PAYWALL_RESULT.PURCHASED ||
          result === PAYWALL_RESULT.RESTORED ||
          result === PAYWALL_RESULT.NOT_PRESENTED;

        let info: CustomerInfo;
        if (mayHaveNewPurchase) {
          info = await syncCustomerInfoUntilEntitlementActive(entitlementId, checkEntitlement);
        } else {
          try {
            await Purchases.invalidateCustomerInfoCache();
          } catch {
            /* ignore */
          }
          info = await Purchases.getCustomerInfo();
          checkEntitlement(info);
        }

        // Unlock only when CustomerInfo confirms the entitlement (PURCHASED can fire before RC updates).
        const unlocked = entitlementUnlocked(info, entitlementId);
        if (unlocked) {
          await refresh();
        }
        return unlocked;
      } catch {
        return false;
      }
    },
    [nativeAvailable, checkEntitlement, paywallOffering, entitlementId, refresh],
  );

  const restorePurchases = React.useCallback(async () => {
    if (!nativeAvailable || Purchases == null) return;
    try {
      let info = await Purchases.restorePurchases();
      checkEntitlement(info);
      if (!entitlementUnlocked(info, entitlementId)) {
        info = await syncCustomerInfoUntilEntitlementActive(entitlementId, checkEntitlement);
        checkEntitlement(info);
      }
    } catch {
      // ignore
    }
  }, [checkEntitlement, nativeAvailable, entitlementId]);

  const purchasePackage = React.useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      if (!nativeAvailable || Purchases == null) return false;
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        checkEntitlement(customerInfo);
        if (entitlementUnlocked(customerInfo, entitlementId)) return true;
        const synced = await syncCustomerInfoUntilEntitlementActive(entitlementId, checkEntitlement);
        return entitlementUnlocked(synced, entitlementId);
      } catch {
        return false;
      }
    },
    [checkEntitlement, nativeAvailable, entitlementId],
  );

  const resetPurchasesForTesting = React.useCallback(async () => {
    if (!__DEV__) return;
    if (!nativeAvailable || Purchases == null) return;
    lastRegisteredProRef.current = null;
    try {
      await AsyncStorage.removeItem(PRO_UNLOCKED_CACHE_KEY);
    } catch {
      /* ignore */
    }
    try {
      await Purchases.logOut();
    } catch (e) {
      if (__DEV__) {
        console.warn("[RevenueCat] resetPurchasesForTesting logOut failed:", e);
      }
    }
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch {
      /* ignore */
    }
    // Do not call getCustomerInfo() here: the SDK would sync the device’s sandbox receipt to the
    // new anonymous user and Pro would immediately return. Next paywall / refresh will re-fetch.
    isProRef.current = false;
    setIsPro(false);
    void Purchases.setAttributes({ pro_subscriber: "false" }).catch(() => {});
    await reloadOfferingsOnly();
    const { count } = await getDailyScanCount();
    setScansUsedToday(count);
  }, [nativeAvailable, reloadOfferingsOnly]);

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
      paywallOffering,
      entitlementId,
      applyCustomerInfo,
      resetPurchasesForTesting,
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
      paywallOffering,
      entitlementId,
      applyCustomerInfo,
      resetPurchasesForTesting,
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
    lastOfferingsError: null,
  },
  paywallOffering: null,
  entitlementId: DEFAULT_ENTITLEMENT_ID,
  applyCustomerInfo: () => {},
  resetPurchasesForTesting: async () => {},
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = React.useContext(SubscriptionContext);
  return ctx ?? DEFAULT_SUBSCRIPTION;
}

export { FREE_DAILY_SCANS };
