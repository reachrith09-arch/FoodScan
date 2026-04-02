# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

### Prerequisites

- **Node**: use the version in [`.nvmrc`](.nvmrc) (recommended: Node 22 LTS).
  - Newer Node versions (for example Node 25) can cause Expo dev-server crashes (WebSocket server errors).
- **Package manager**: this repo uses **pnpm** (see `packageManager` in `package.json`).

### Install dependencies

```bash
pnpm install --no-frozen-lockfile
```

### Start the app

This template uses `doppler` for secrets/env in scripts.

```bash
pnpm run start
```

Then in another terminal:

```bash
pnpm run ios
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Notes

- **Barcode scanning** works best on a **physical device**. Simulators can be limited.
- **Online product lookup**: When a product isn't in Open Food Facts, the backend automatically searches the web for product info. Requires Supabase plus `SERPER_API_KEY` in Supabase secrets. Deploy the `lookup-product-online` Edge Function to enable.
- **Food label scanning (OCR)** is implemented as “photo + manual confirm” (no API key required). You can plug in a real OCR provider later.

### Meal photo AI via Supabase (recommended — keys stay off the device)

The `recognize-food` Edge Function runs vision **on the server**. The app calls Supabase only.

**Self-hosted (no cloud LLM bill):** set **`SELF_HOSTED_MEAL_VISION_URL`** to an HTTPS endpoint you control. The function **POST**s JSON `{ "imageBase64": "<raw or data URL>" }` and expects JSON with **`dishSummary`** (string) and **`items`** (array of `{ name, isDrink, confidence, portionRatio, isBlended }`). Optional: **`SELF_HOSTED_MEAL_VISION_TOKEN`** (`Authorization: Bearer …`). If self-hosted fails, enable fallbacks: **`SELF_HOSTED_FALLBACK_OPENROUTER=1`** + **`OPENROUTER_API_KEY`**, and/or **`SELF_HOSTED_FALLBACK_GEMINI=1`** + **`GEMINI_API_KEY`**, and/or **`SELF_HOSTED_FALLBACK_OPENAI=1`** + **`OPENAI_API_KEY`**.

**OpenRouter (if Google AI Studio / Gemini API is blocked):** set **`OPENROUTER_API_KEY`** from [openrouter.ai/keys](https://openrouter.ai/keys). With **no** self-hosted URL, **OpenRouter runs before native Gemini** (so you can use only OpenRouter). Default model **`OPENROUTER_MEAL_VISION_MODEL`** = `openai/gpt-4o-mini` (vision-capable). Optional **`OPENROUTER_HTTP_REFERER`** and **`OPENROUTER_APP_TITLE`** (OpenRouter headers).

**Gemini (Google AI Studio):** set **`GEMINI_API_KEY`** from [Google AI Studio](https://aistudio.google.com/apikey). Used when OpenRouter is unset, or after OpenRouter fails. Optional **`GEMINI_MODEL`** (default `gemini-1.5-flash`).

**OpenAI:** set **`OPENAI_API_KEY`** — fallback after OpenRouter/Gemini when those keys exist, or primary if it is the only cloud key. Optional secret **`OPENAI_MODEL`** (default **`gpt-4o-mini`**).

**OpenAI-only setup:** Unset other meal-vision secrets if you only use OpenAI. In Supabase: `npx supabase secrets set OPENAI_API_KEY=sk-...` → `pnpm run deploy:recognize-food`. In the app: **`EXPO_PUBLIC_SUPABASE_URL`** + **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** only (see [`.env.example`](./.env.example)). Do **not** put `OPENAI_API_KEY` in `.env` — it must stay on the server.

1. **Create / restore** a Supabase project ([dashboard](https://supabase.com/dashboard)) — paused projects cannot run Edge Functions.
2. **API keys** (Project **Settings → API**): set **Project URL** and the **anon public** key as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. If you use **Doppler** with `pnpm start`, add them there (same names); a local `.env` is only needed for `pnpm run start:local` without Doppler (see [`.env.example`](./.env.example)).
3. **Install the Supabase CLI** ([install guide](https://supabase.com/docs/guides/cli/getting-started)).
4. **Log in**: `npx supabase login`
5. **Link this repo to the project** (reference id is in **Settings → General → Reference ID**):

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

6. **Set Edge secrets** (at least one provider — not committed to git):

   ```bash
   # OpenRouter — use when you cannot access Google Gemini API directly (single key, many models)
   npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
   # Optional (default openai/gpt-4o-mini):
   # npx supabase secrets set OPENROUTER_MEAL_VISION_MODEL=openai/gpt-4o-mini

   # Gemini (optional if OpenRouter covers you)
   npx supabase secrets set GEMINI_API_KEY=your-google-ai-studio-key
   # npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash

   # Self-hosted (optional; tried first when URL is set)
   npx supabase secrets set SELF_HOSTED_MEAL_VISION_URL=https://your-server.example.com/v1/meal-vision
   npx supabase secrets set SELF_HOSTED_MEAL_VISION_TOKEN=your-bearer-token
   npx supabase secrets set SELF_HOSTED_FALLBACK_OPENROUTER=1
   npx supabase secrets set SELF_HOSTED_FALLBACK_GEMINI=1
   npx supabase secrets set SELF_HOSTED_FALLBACK_OPENAI=1

   # OpenAI (optional)
   npx supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here
   ```

7. **Deploy** the function from the project root:

   ```bash
   pnpm run deploy:recognize-food
   ```

8. **Client**: Prefer **no** `EXPO_PUBLIC_OPENAI_API_KEY` in production (vision stays on Supabase). If you do set a client key for dev, **`EXPO_PUBLIC_OPENAI_VISION_FALLBACK` defaults off** so a failed Edge call (e.g. OpenAI quota on the server) does not immediately retry the same key in the app. Set `EXPO_PUBLIC_OPENAI_VISION_FALLBACK=1` only if you intentionally want that retry. Optional **`EXPO_PUBLIC_OPENAI_VISION_MODEL`** (default **`gpt-4o-mini`**) must match a **vision** model id from OpenAI.
9. Restart Metro (`pnpm run start:local:clear` or your Doppler workflow) and rebuild the dev client if needed.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
