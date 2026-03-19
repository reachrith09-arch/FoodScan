import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  // RevenueCat: EXPO_PUBLIC_* is inlined at Metro bundle time (see env.ts). This `extra` copy is
  // read at runtime via expo-constants—ensure Metro is started with the same secrets as native
  // builds (this project uses `doppler run -- expo start --dev-client` in package.json).
  const rcKey =
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
    process.env.XPO_PUBLIC_REVENUECAT_API_KEY_;

  return {
    ...appJson.expo,
    ...config,
    extra: {
      ...((config as any).extra ?? {}),
      revenueCatApiKey: rcKey ?? "",
    },
  };
};
