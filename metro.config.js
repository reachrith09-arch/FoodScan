const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// `pnpm start` uses `doppler run`, which often leaves EXPO_PUBLIC_* empty or unset. Merge `.env`
// for keys that are missing or blank so EXPO_PUBLIC_OPENAI_API_KEY from .env still reaches Metro.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      const cur = process.env[key];
      if (cur === undefined || String(cur).trim() === "") {
        process.env[key] = value;
      }
    }
  } catch {
    /* ignore bad .env */
  }
}

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.ts",
  inlineRem: 16,
});
