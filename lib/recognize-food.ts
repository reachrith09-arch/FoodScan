/**
 * Food vision: Supabase Edge `recognize-food` first, then optional direct OpenAI
 * when EXPO_PUBLIC_OPENAI_API_KEY is set (starter / dev — prefer Edge in production).
 */

import { env } from "@/env";
import { visionDataUrlForOpenAI } from "@/lib/vision-image";

export interface RecognizedFood {
  name: string;
  isDrink: boolean;
  confidence: number;
  portionRatio: number;
  isBlended: boolean;
}

/** Dish title + decomposed ingredients (visible + typical for that dish type). */
export interface MealRecognitionResult {
  dishSummary: string | null;
  foods: RecognizedFood[];
  /** API or config failure — show when `foods` is empty. */
  visionError?: string;
}

const MAX_COMPONENTS = 22;

const FOOD_VISION_SYSTEM = `You analyze meal photos for a nutrition app. Compare what you see to how this type of dish usually looks in food photos, menus, and social posts (typical plating and components — you are not browsing the web, use general knowledge).

Return ONE JSON object only. No markdown, no code fences, no extra text. Top-level keys MUST be exactly "dishSummary" and "items" (not nested inside another key).

Shape:
{"dishSummary":"string","items":[...]}

dishSummary (required):
- One clear sentence naming the meal, e.g. "Penne pasta with tomato sauce and fresh basil" or "Cheeseburger with fries".

items (required): array of ${6}–${18} objects (use up to ${MAX_COMPONENTS} if needed). Each object has:
- "name": specific ingredient or component (e.g. "penne pasta", "tomato marinara sauce", "grated parmesan", "fresh basil", "olive oil", "garlic" — NEVER a single vague row like "pasta dish" for the whole plate).
- "isDrink": boolean — true for beverages; true for pourable sauces/dressings used as a component.
- "confidence": integer 0–100 — higher when clearly visible; use roughly 45–72 for components inferred only from typical recipes for this dish type.
- "portionRatio": float 0.0–1.0 — estimated share of the meal by volume/weight; all items must sum to 1.0.
- "isBlended": boolean — true only if physically inseparable (smoothie, pureed soup). Pasta + sauce on a plate: false for each component.

CRITICAL — build items from BOTH:
(1) VISIBLE: Everything apparent in the photo (pasta shape, sauce, cheese, herbs, bread, meat, etc.).
(2) TYPICAL INGREDIENTS: From world knowledge of how this dish is usually made, add plausible ingredients often present even if not clearly visible — e.g. tomato-sauce pasta: garlic, olive oil, salt, canned tomatoes or paste; creamy pasta: milk, heavy cream, butter, cheese; burger: bun, beef patty, lettuce, tomato, cheese, condiments. Keep names short and searchable.

Rules:
- Prefer many specific rows over one combined "dish" row.
- Do not repeat the dishSummary as the only item; break it into components.
- If the image is unclear, still propose your best dishSummary and reasonable typical components with moderate confidence.
- portionRatios must sum to 1.0.

Example:
{"dishSummary":"Penne pasta in tomato sauce with herbs","items":[
  {"name":"penne pasta","isDrink":false,"confidence":92,"portionRatio":0.38,"isBlended":false},
  {"name":"tomato marinara sauce","isDrink":true,"confidence":88,"portionRatio":0.28,"isBlended":false},
  {"name":"fresh basil","isDrink":false,"confidence":78,"portionRatio":0.05,"isBlended":false},
  {"name":"grated parmesan cheese","isDrink":false,"confidence":65,"portionRatio":0.08,"isBlended":false},
  {"name":"olive oil","isDrink":true,"confidence":58,"portionRatio":0.06,"isBlended":false},
  {"name":"garlic","isDrink":false,"confidence":52,"portionRatio":0.04,"isBlended":false},
  {"name":"salt","isDrink":false,"confidence":48,"portionRatio":0.03,"isBlended":false},
  {"name":"black pepper","isDrink":false,"confidence":45,"portionRatio":0.02,"isBlended":false},
  {"name":"onion","isDrink":false,"confidence":50,"portionRatio":0.08,"isBlended":false}
]}`;

function extractItemName(f: Record<string, unknown>): string {
  for (const k of [
    "name",
    "ingredient",
    "label",
    "food",
    "item",
    "title",
  ] as const) {
    const v = f[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v).trim();
  }
  return "";
}

function normalizeFoodsList(raw: unknown[]): RecognizedFood[] {
  const foods = raw
    .filter(
      (f): f is Record<string, unknown> => f != null && typeof f === "object",
    )
    .map((f) => {
      const name = extractItemName(f);
      if (!name) return null;
      return {
        name,
        isDrink: Boolean(f.isDrink),
        confidence: Math.min(
          100,
          Math.max(0, Math.round(Number(f.confidence) || 70)),
        ),
        portionRatio: Math.min(1, Math.max(0, Number(f.portionRatio) || 1)),
        isBlended: Boolean(f.isBlended),
      };
    })
    .filter((f): f is RecognizedFood => f != null);

  // Prefer items the model marked confident; if none pass the bar, still return best guesses.
  const confident = foods.filter((f) => f.confidence >= 40);
  let usable =
    confident.length > 0
      ? confident
      : foods
          .slice(0)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 12);

  usable = usable
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_COMPONENTS);

  const total = usable.reduce((s, f) => s + f.portionRatio, 0);
  if (total > 0) {
    for (const f of usable) f.portionRatio = f.portionRatio / total;
  } else if (usable.length > 0) {
    const even = 1 / usable.length;
    for (const f of usable) f.portionRatio = even;
  }
  return usable.sort((a, b) => b.confidence - a.confidence);
}

function dishSummaryFromParsed(o: Record<string, unknown>): string | null {
  const keys = [
    "dishSummary",
    "dish_title",
    "mealName",
    "meal",
    "title",
  ] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return null;
}

function rawItemsFromParsed(o: Record<string, unknown>): unknown[] | null {
  const candidates = [o.items, o.components, o.foods, o.ingredients];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

/** Models sometimes wrap the payload in { result: { ... } } etc. */
function tryUnwrapMealRecord(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null;
  const o = parsed as Record<string, unknown>;
  const looksLikeMeal =
    typeof o.dishSummary === "string" ||
    Array.isArray(o.items) ||
    Array.isArray(o.foods) ||
    Array.isArray(o.ingredients) ||
    Array.isArray(o.components);
  if (looksLikeMeal) return o;
  for (const k of [
    "result",
    "data",
    "meal",
    "analysis",
    "response",
    "output",
    "parsed_meal",
  ]) {
    const inner = o[k];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const io = inner as Record<string, unknown>;
      if (
        typeof io.dishSummary === "string" ||
        Array.isArray(io.items) ||
        Array.isArray(io.foods) ||
        Array.isArray(io.ingredients)
      ) {
        return io;
      }
    }
  }
  return o;
}

export function parseMealRecognitionFromModelContent(
  content: string,
): MealRecognitionResult {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return { dishSummary: null, foods: normalizeFoodsList(parsed) };
    }
    const o = tryUnwrapMealRecord(parsed);
    if (o) {
      const dishSummary = dishSummaryFromParsed(o);
      const rawItems = rawItemsFromParsed(o);
      if (rawItems) {
        return { dishSummary, foods: normalizeFoodsList(rawItems) };
      }
      if (dishSummary) {
        return { dishSummary, foods: [] };
      }
    }
  } catch {
    /* ignore */
  }
  return { dishSummary: null, foods: [] };
}

function clientOpenAiVisionFallbackEnabled(): boolean {
  const v = env.EXPO_PUBLIC_OPENAI_VISION_FALLBACK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** True when Edge returned OpenAI quota/billing — safe to retry with a different EXPO_PUBLIC_OPENAI_API_KEY. */
function edgeResponseIndicatesOpenAIQuota(
  details: string,
  appErrFragment: string,
): boolean {
  const blob = `${details} ${appErrFragment}`;
  if (/insufficient_quota|quota|billing/i.test(blob)) return true;
  try {
    const j = JSON.parse(details.trim().slice(0, 2000)) as {
      error?: { type?: string; message?: string };
    };
    const t = j?.error?.type ?? "";
    const m = j?.error?.message ?? "";
    if (t === "insufficient_quota") return true;
    if (/quota|billing|insufficient/i.test(String(m))) return true;
  } catch {
    /* not JSON */
  }
  return false;
}

async function edgeHttpResponseLooksLikeOpenAIQuota(
  response: Response | undefined,
): Promise<boolean> {
  if (!response) return false;
  try {
    const ct = response.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return false;
    const j = (await response.clone().json()) as Record<string, unknown>;
    const det = typeof j.details === "string" ? j.details : "";
    const errStr =
      typeof j.error === "string"
        ? j.error
        : j.error != null && typeof j.error === "object"
          ? JSON.stringify(j.error).slice(0, 400)
          : "";
    return edgeResponseIndicatesOpenAIQuota(det, errStr);
  } catch {
    return false;
  }
}

/** Parse Edge Function JSON error body (e.g. 502) so we don't fall through to client OpenAI with the same key. */
async function messageFromEdgeInvokeFailure(
  response: Response | undefined,
  invokeError: unknown,
): Promise<string> {
  if (response) {
    try {
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await response.json()) as Record<string, unknown>;
        const errStr = typeof j.error === "string" ? j.error.trim() : "";
        const det = typeof j.details === "string" ? j.details.trim() : "";
        const hint = typeof j.hint === "string" ? j.hint.trim() : "";
        const humanDet = det
          ? humanizeOpenAIErrorBody(response.status || 502, det)
          : "";
        const parts = [errStr, humanDet, hint].filter((s) => s.length > 0);
        if (parts.length) return parts.join(" ");
      }
    } catch {
      /* ignore */
    }
  }
  if (invokeError instanceof Error) return invokeError.message;
  return "Edge Function returned a non-2xx status code.";
}

/** Turn OpenAI JSON error bodies into short UI copy (avoid dumping raw JSON in the app). */
function humanizeOpenAIErrorBody(status: number, bodyText: string): string {
  const raw = bodyText.trim().slice(0, 2000);
  try {
    const j = JSON.parse(raw) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const err = j?.error;
    const msg = typeof err?.message === "string" ? err.message : "";
    const type = typeof err?.type === "string" ? err.type : "";
    if (type === "insufficient_quota" || /quota|billing/i.test(msg)) {
      return "Meal vision hit OpenAI quota on the server. Set OPENROUTER_API_KEY, GEMINI_API_KEY, SELF_HOSTED_MEAL_VISION_URL, or add billing at platform.openai.com — then redeploy recognize-food.";
    }
    if (type === "invalid_request_error" && /api key/i.test(msg)) {
      return "OpenAI: invalid API key. Check EXPO_PUBLIC_OPENAI_API_KEY in .env.";
    }
    if (status === 401) {
      return "OpenAI: unauthorized — check your API key.";
    }
    if (status === 429) {
      return "OpenAI: rate limited. Wait a moment and try again.";
    }
    if (msg) {
      return msg.length > 220 ? `${msg.slice(0, 217)}…` : msg;
    }
  } catch {
    /* not JSON */
  }
  if (raw) {
    return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
  }
  return `OpenAI request failed (HTTP ${status}). Check your key and billing.`;
}

async function recognizeMealOpenAIDirect(
  imageBase64: string,
  apiKey: string,
): Promise<MealRecognitionResult> {
  const model = env.EXPO_PUBLIC_OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const b64 = imageBase64.replace(/\s/g, "");
  const dataUrl = visionDataUrlForOpenAI(b64);
  if (!dataUrl) {
    return {
      dishSummary: null,
      foods: [],
      visionError:
        "Image must be JPEG/PNG/GIF/WebP (not HEIC) and large enough. Try another photo or Camera → Formats → Most Compatible.",
    };
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${FOOD_VISION_SYSTEM}\n\nYou must respond with a single JSON object only (valid JSON). Use keys dishSummary (string) and items (array).`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyze this meal photo. Respond with a single JSON object with keys "dishSummary" (string) and "items" (array) exactly as specified in the system message.',
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    let body = "";
    try {
      body = await resp.text();
    } catch {
      /* ignore */
    }
    return {
      dishSummary: null,
      foods: [],
      visionError: humanizeOpenAIErrorBody(resp.status, body),
    };
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = parseMealRecognitionFromModelContent(content);
  if (parsed.foods.length === 0 && !parsed.dishSummary && content.trim()) {
    return {
      ...parsed,
      visionError: "Could not parse AI response as meal JSON. Try Re-analyze.",
    };
  }
  return parsed;
}

/** True if either Supabase or a client OpenAI key is configured (vision may still fail at runtime). */
export function isFoodRecognitionAvailable(): boolean {
  return !!(
    env.EXPO_PUBLIC_OPENAI_API_KEY ||
    (env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
  );
}

function mealVisionHasContent(r: MealRecognitionResult): boolean {
  return r.foods.length > 0 || !!r.dishSummary?.trim();
}

/**
 * Recognize dish + ingredients.
 * 1) **Direct OpenAI** when `EXPO_PUBLIC_OPENAI_API_KEY` is set (uses your account credits immediately).
 * 2) If that returns empty/error and Supabase is configured, **Edge `recognize-food`** next.
 * 3) If Edge reports quota / `EXPO_PUBLIC_OPENAI_VISION_FALLBACK=1`, retry client OpenAI from Edge handlers.
 * 4) If only Supabase (no client key), Edge runs first as before.
 */
export async function recognizeMealFromImage(
  imageBase64: string,
): Promise<MealRecognitionResult> {
  const b64 = imageBase64.replace(/\s/g, "");
  const openaiKey = env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  const allowClientFallback = clientOpenAiVisionFallbackEnabled();

  const { supabase } = await import("@/lib/supabase");

  /** Populated when we call OpenAI from the app before Edge (so Edge handlers don’t repeat the same call). */
  let fromClientFirst: MealRecognitionResult | null = null;
  let ranOpenAiFromAppFirst = false;
  if (openaiKey) {
    ranOpenAiFromAppFirst = true;
    fromClientFirst = await recognizeMealOpenAIDirect(b64, openaiKey);
    if (mealVisionHasContent(fromClientFirst) && !fromClientFirst.visionError) {
      return fromClientFirst;
    }
    if (mealVisionHasContent(fromClientFirst)) {
      return fromClientFirst;
    }
    if (!supabase) {
      return fromClientFirst;
    }
  }

  if (supabase) {
    try {
      const { data, error, response } = await supabase.functions.invoke(
        "recognize-food",
        {
          body: { imageBase64: b64 },
        },
      );
      if (error) {
        const quotaOrFallback =
          allowClientFallback ||
          (await edgeHttpResponseLooksLikeOpenAIQuota(response));
        if (quotaOrFallback && openaiKey && !ranOpenAiFromAppFirst) {
          try {
            return await recognizeMealOpenAIDirect(b64, openaiKey);
          } catch {
            /* surface Edge error */
          }
        }
        if (fromClientFirst) {
          return fromClientFirst;
        }
        const visionError = await messageFromEdgeInvokeFailure(response, error);
        return {
          dishSummary: null,
          foods: [],
          visionError:
            visionError ||
            "Supabase recognize-food failed. Deploy the function and set OPENROUTER_API_KEY, GEMINI_API_KEY, SELF_HOSTED_MEAL_VISION_URL, and/or OPENAI_API_KEY in secrets (see README).",
        };
      }
      if (data && typeof data === "object") {
        const body = data as Record<string, unknown>;
        const appErr = body.error;
        const hasAppError =
          (typeof appErr === "string" && appErr.length > 0) ||
          (appErr != null &&
            typeof appErr === "object" &&
            Object.keys(appErr as object).length > 0);

        if (hasAppError) {
          const det =
            typeof body.details === "string" ? body.details.trim() : "";
          const baseMsg =
            typeof appErr === "string"
              ? appErr
              : `recognize-food: ${JSON.stringify(appErr).slice(0, 200)}`;
          const msg = det
            ? `${baseMsg} ${humanizeOpenAIErrorBody(502, det)}`.trim()
            : baseMsg;
          const quotaOnServer = edgeResponseIndicatesOpenAIQuota(det, baseMsg);
          if (
            (allowClientFallback || quotaOnServer) &&
            openaiKey &&
            !ranOpenAiFromAppFirst
          ) {
            try {
              return await recognizeMealOpenAIDirect(b64, openaiKey);
            } catch {
              return { dishSummary: null, foods: [], visionError: msg };
            }
          }
          if (fromClientFirst) {
            return fromClientFirst;
          }
          return { dishSummary: null, foods: [], visionError: msg };
        }

        const dishSummary =
          typeof body.dishSummary === "string" && body.dishSummary.trim()
            ? body.dishSummary.trim()
            : null;
        const foodsRaw =
          body.foods ?? body.items ?? body.components ?? body.ingredients;
        const foods = Array.isArray(foodsRaw)
          ? normalizeFoodsList(foodsRaw as unknown[])
          : [];
        const empty = foods.length === 0 && !dishSummary;
        return {
          dishSummary,
          foods,
          visionError: empty
            ? "Edge returned no dish or ingredients. Set OPENROUTER_API_KEY, GEMINI_API_KEY, SELF_HOSTED_MEAL_VISION_URL, or OPENAI_API_KEY on the function."
            : undefined,
        };
      }
    } catch (e) {
      if (fromClientFirst) {
        return fromClientFirst;
      }
      if (allowClientFallback && openaiKey && !ranOpenAiFromAppFirst) {
        try {
          return await recognizeMealOpenAIDirect(b64, openaiKey);
        } catch {
          /* ignore */
        }
      }
      /* Network throw: no Edge body to parse; optional broad fallback only when flag is on */
      return {
        dishSummary: null,
        foods: [],
        visionError:
          e instanceof Error ? e.message : "recognize-food request failed.",
      };
    }
  }

  if (fromClientFirst) {
    return fromClientFirst;
  }

  if (openaiKey) {
    try {
      return await recognizeMealOpenAIDirect(b64, openaiKey);
    } catch {
      return {
        dishSummary: null,
        foods: [],
        visionError:
          "OpenAI request failed. Check key, billing, or configure Supabase recognize-food (self-hosted URL or OPENAI_API_KEY).",
      };
    }
  }

  return {
    dishSummary: null,
    foods: [],
    visionError:
      "Add EXPO_PUBLIC_OPENAI_API_KEY for meal scan with your OpenAI account, or EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (with recognize-food + server AI secrets). See .env.example.",
  };
}

/** @deprecated Use recognizeMealFromImage for dishSummary + full decomposition */
export async function recognizeFoodsInImage(
  imageBase64: string,
): Promise<RecognizedFood[]> {
  const r = await recognizeMealFromImage(imageBase64);
  return r.foods;
}

export { confidenceColor, confidenceLabel } from "./confidence-label";

export function ratioToPortionString(
  ratio: number,
  isDrink: boolean,
  totalAmount = 400,
): string {
  const amount = Math.round(ratio * totalAmount);
  return isDrink ? `${amount}ml` : `${amount}g`;
}

export function ratioToGrams(ratio: number, totalGrams = 400): number {
  return Math.round(ratio * totalGrams);
}
