import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

// Load root `.env` into `process.env` whenever Expo evaluates config (pairs with `env.ts` + Metro).
loadEnv({ path: path.resolve(__dirname, ".env") });

export default ({ config }: ConfigContext): ExpoConfig => {
  // RevenueCat: EXPO_PUBLIC_* is inlined at Metro bundle time (see env.ts). This `extra` copy is
  // read at runtime via expo-constants—ensure Metro is started with the same secrets as native
  // builds (this project uses `doppler run -- expo start --dev-client` in package.json).
  const rcKey =
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
    process.env.XPO_PUBLIC_REVENUECAT_API_KEY_;
  const rcOfferingId = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() ?? "";
  const rcEntitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ?? "";
  const openAiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() ?? "";
  const openAiVisionModel = process.env.EXPO_PUBLIC_OPENAI_VISION_MODEL?.trim() ?? "";
  const openAiVisionFallback = process.env.EXPO_PUBLIC_OPENAI_VISION_FALLBACK?.trim() ?? "";
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    ...appJson.expo,
    ...config,
    extra: {
      ...((config as any).extra ?? {}),
      revenueCatApiKey: rcKey ?? "",
      expoPublicOpenAiApiKey: openAiKey,
      expoPublicOpenAiVisionModel: openAiVisionModel,
      expoPublicOpenAiVisionFallback: openAiVisionFallback,
      expoPublicSupabaseUrl: supabaseUrl,
      expoPublicSupabaseAnonKey: supabaseAnon,
      ...(rcOfferingId ? { revenueCatOfferingId: rcOfferingId } : {}),
      ...(rcEntitlementId ? { revenueCatEntitlementId: rcEntitlementId } : {}),
    },
  };
};
