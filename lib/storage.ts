import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { HealthProfile, ScanResult } from "@/types/food";
import { updateDailySummaryFromScan } from "@/lib/analytics";

const KEYS = {
  HEALTH_PROFILE: "HEALTH_PROFILE",
  SCAN_HISTORY: "SCAN_HISTORY",
  FAVORITES: "FAVORITES",
  FAVORITE_NOTES: "FAVORITE_NOTES",
  SETTINGS: "SETTINGS",
  RECENT_SEARCHES: "RECENT_SEARCHES",
} as const;

const MAX_RECENT_SEARCHES = 5;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECENT_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    return list.slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<void> {
  const trimmed = String(query).trim();
  if (!trimmed) return;
  const list = await getRecentSearches();
  const next = [trimmed, ...list.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
  await AsyncStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(next));
}

const MAX_HISTORY = 100;

export interface AppSettings {
  units: "metric" | "imperial";
  colorScheme: "light" | "dark" | "system";
  /** "small" | "medium" | "large" for accessibility */
  fontSize?: "small" | "medium" | "large";
  /** True after user dismisses onboarding checklist */
  onboardingDone?: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  units: "metric",
  colorScheme: "system",
  fontSize: "medium",
  onboardingDone: false,
};

type SecureStoreModule = typeof import("expo-secure-store");
let secureStoreModule: SecureStoreModule | null | undefined;
function getSecureStore(): SecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // Avoid importing expo-secure-store if native module missing (it throws on import).
    const native = requireOptionalNativeModule("ExpoSecureStore");
    if (!native) {
      secureStoreModule = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    secureStoreModule = require("expo-secure-store") as SecureStoreModule;
    return secureStoreModule;
  } catch {
    secureStoreModule = null;
    return null;
  }
}

export async function getHealthProfile(): Promise<HealthProfile | null> {
  // Prefer SecureStore on native platforms (privacy-first). Fallback to AsyncStorage on web.
  const SecureStore = Platform.OS === "web" ? null : getSecureStore();
  const secureRaw = SecureStore
    ? await (async () => {
        try {
          return await SecureStore.getItemAsync(KEYS.HEALTH_PROFILE);
        } catch {
          return null;
        }
      })()
    : null;
  if (secureRaw != null) {
    try {
      return JSON.parse(secureRaw) as HealthProfile;
    } catch {
      // fall through to legacy read
    }
  }

  // Legacy fallback: AsyncStorage
  const raw = await AsyncStorage.getItem(KEYS.HEALTH_PROFILE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HealthProfile;
    // Migrate to SecureStore when possible
    if (SecureStore) {
      SecureStore.setItemAsync(KEYS.HEALTH_PROFILE, JSON.stringify(parsed)).catch(() => {});
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setHealthProfile(profile: HealthProfile): Promise<void> {
  const payload = JSON.stringify(profile);
  const SecureStore = Platform.OS === "web" ? null : getSecureStore();
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(KEYS.HEALTH_PROFILE, payload);
      return;
    } catch {
      // fall back
    }
  } else {
    await AsyncStorage.setItem(KEYS.HEALTH_PROFILE, payload);
    return;
  }
  await AsyncStorage.setItem(KEYS.HEALTH_PROFILE, payload);
}

export function hasMinimumProfile(profile: HealthProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.allergies.length > 0 ||
    profile.conditions.length > 0 ||
    profile.goals.length > 0 ||
    profile.dietaryPreferences.length > 0
  );
}

export async function getScanHistory(): Promise<ScanResult[]> {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_HISTORY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ScanResult[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addToScanHistory(result: ScanResult): Promise<void> {
  const list = await getScanHistory();
  const next = [result, ...list].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(next));
  // Fire-and-forget: keep UI fast, but still update tracking.
  updateDailySummaryFromScan(result).catch(() => {});
}

export async function updateScanResult(result: ScanResult): Promise<void> {
  // Keep stored results in sync when we re-analyze after profile updates.
  const [history, favorites] = await Promise.all([getScanHistory(), getFavorites()]);
  const nextHistory = history.map((r) => (r.id === result.id ? result : r));
  const nextFavorites = favorites.map((r) => (r.id === result.id ? result : r));
  await Promise.all([
    AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(nextHistory.slice(0, MAX_HISTORY))),
    AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(nextFavorites)),
  ]);
}

export async function getFavorites(): Promise<ScanResult[]> {
  const raw = await AsyncStorage.getItem(KEYS.FAVORITES);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ScanResult[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addFavorite(result: ScanResult): Promise<void> {
  const list = await getFavorites();
  if (list.some((f) => f.id === result.id)) return;
  await AsyncStorage.setItem(
    KEYS.FAVORITES,
    JSON.stringify([result, ...list])
  );
}

export async function removeFavorite(id: string): Promise<void> {
  const list = await getFavorites();
  await AsyncStorage.setItem(
    KEYS.FAVORITES,
    JSON.stringify(list.filter((f) => f.id !== id))
  );
}

export async function isFavorite(id: string): Promise<boolean> {
  const list = await getFavorites();
  return list.some((f) => f.id === id);
}

export async function getFavoriteNote(scanId: string): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.FAVORITE_NOTES);
  if (!raw) return "";
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return (map && map[scanId]) ?? "";
  } catch {
    return "";
  }
}

export async function setFavoriteNote(scanId: string, note: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.FAVORITE_NOTES);
  const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  if (note.trim()) map[scanId] = note.trim();
  else delete map[scanId];
  await AsyncStorage.setItem(KEYS.FAVORITE_NOTES, JSON.stringify(map));
}

export async function exportUserData(): Promise<string> {
  const [profile, history, favorites, settings, reactions] = await Promise.all([
    getHealthProfile(),
    getScanHistory(),
    getFavorites(),
    getSettings(),
    import("@/lib/reactions").then((m) => m.getReactions()),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile,
      scanHistoryCount: history.length,
      favoritesCount: favorites.length,
      reactionsCount: reactions.length,
      reactions: reactions.slice(0, 100),
      settings: { units: settings.units, colorScheme: settings.colorScheme },
    },
    null,
    2,
  );
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const s = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...s };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(
    KEYS.SETTINGS,
    JSON.stringify({ ...current, ...settings })
  );
}
