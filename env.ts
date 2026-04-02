import Constants from "expo-constants";
import { z } from "zod";

export const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  /**
   * Optional: enables on-device food vision when Supabase `recognize-food` isn’t used.
   * Prefer Supabase Edge + secrets in production; this key ships in the client bundle.
   */
  EXPO_PUBLIC_OPENAI_API_KEY: z.string().optional(),
  /** OpenAI model for direct-from-app meal vision (Edge uses secret OPENAI_MODEL). Default gpt-4o-mini. */
  EXPO_PUBLIC_OPENAI_VISION_MODEL: z.string().optional(),
  /**
   * When `"1"` or `"true"`, if Supabase `recognize-food` fails for any reason, retry vision with EXPO_PUBLIC_OPENAI_API_KEY.
   * Server OpenAI quota errors retry automatically when a client key is set (different key often has quota).
   */
  EXPO_PUBLIC_OPENAI_VISION_FALLBACK: z.string().optional(),
  EXPO_PUBLIC_REVENUECAT_API_KEY: z.string().optional(),
  /** RevenueCat offering identifier that has your Paywall attached (defaults to Current offering if unset). */
  EXPO_PUBLIC_REVENUECAT_OFFERING_ID: z.string().optional(),
  /**
   * Must match the entitlement identifier in RevenueCat (Product catalog → Entitlements).
   * Defaults to "pro" if unset.
   */
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: z.string().optional(),
});

type Extra = {
  expoPublicOpenAiApiKey?: string;
  expoPublicOpenAiVisionModel?: string;
  expoPublicOpenAiVisionFallback?: string;
  expoPublicSupabaseUrl?: string;
  expoPublicSupabaseAnonKey?: string;
  revenueCatApiKey?: string;
  revenueCatOfferingId?: string;
  revenueCatEntitlementId?: string;
};

function extra(): Extra | undefined {
  return Constants.expoConfig?.extra as Extra | undefined;
}

/** Metro inlines `process.env.EXPO_PUBLIC_*` in dev; `app.config` + `extra` backs up `.env` at runtime. */
function pickPublic(
  processKey: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY" | "EXPO_PUBLIC_OPENAI_API_KEY",
  extraKey: keyof Extra,
): string | undefined {
  const p = process.env[processKey];
  if (typeof p === "string" && p.trim()) return p.trim();
  const e = extra()?.[extraKey];
  if (typeof e === "string" && e.trim()) return e.trim();
  return undefined;
}

// We have to define again because expo will replace the process.env with the expo env and reading from process.env will return undefined.
export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL:
    pickPublic("EXPO_PUBLIC_SUPABASE_URL", "expoPublicSupabaseUrl") ??
    (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined),
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    pickPublic("EXPO_PUBLIC_SUPABASE_ANON_KEY", "expoPublicSupabaseAnonKey") ??
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_?.trim() ||
      undefined),
  EXPO_PUBLIC_OPENAI_API_KEY:
    pickPublic("EXPO_PUBLIC_OPENAI_API_KEY", "expoPublicOpenAiApiKey"),
  EXPO_PUBLIC_OPENAI_VISION_MODEL:
    process.env.EXPO_PUBLIC_OPENAI_VISION_MODEL?.trim() ||
    extra()?.expoPublicOpenAiVisionModel?.trim() ||
    undefined,
  EXPO_PUBLIC_OPENAI_VISION_FALLBACK:
    process.env.EXPO_PUBLIC_OPENAI_VISION_FALLBACK?.trim() ||
    extra()?.expoPublicOpenAiVisionFallback?.trim() ||
    undefined,
  EXPO_PUBLIC_REVENUECAT_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ||
    extra()?.revenueCatApiKey?.trim() ||
    undefined,
  EXPO_PUBLIC_REVENUECAT_OFFERING_ID:
    process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() ||
    extra()?.revenueCatOfferingId?.trim() ||
    undefined,
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID:
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ||
    extra()?.revenueCatEntitlementId?.trim() ||
    undefined,
});
