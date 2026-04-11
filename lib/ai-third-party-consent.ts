import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@/env";

const STORAGE_KEY = "ai_third_party_sharing_consent_v1";

/** Sprout uses Supabase `food-assistant`, which calls an AI model (e.g. OpenAI). */
export function isCloudFoodAssistantAvailable(): boolean {
  return !!(
    env.EXPO_PUBLIC_SUPABASE_URL?.trim() &&
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export async function getAiThirdPartySharingConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setAiThirdPartySharingConsent(
  agreed: boolean,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, agreed ? "1" : "0");
}

export async function clearAiThirdPartySharingConsent(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
