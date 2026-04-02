// Supabase Edge Function: recognize-food
// 1) Optional self-hosted HTTP API (your server / Ollama / vLLM wrapper)
// 2) Else OpenRouter (OpenAI-compatible; use if Google AI Studio / Gemini API is blocked)
// 3) Else native Google Gemini when GEMINI_API_KEY is set
// 4) Else OpenAI when OPENAI_API_KEY is set

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  imageBase64?: string;
};

export interface RecognizedFood {
  name: string;
  isDrink: boolean;
  confidence: number;
  portionRatio: number;
  isBlended: boolean;
}

const MAX_COMPONENTS = 22;

const SYSTEM_PROMPT = `You analyze meal photos for a nutrition app. Compare what you see to how this dish usually looks in food photos, menus, and social posts (typical plating — not live web search). Use top-level keys exactly "dishSummary" and "items".

Return ONE JSON object only. No markdown, no code fences, no extra text.

Shape:
{"dishSummary":"string","items":[...]}

dishSummary (required):
- One clear sentence naming the meal, e.g. "Penne pasta with tomato sauce and fresh basil".

items (required): array of 6–18 objects (up to ${MAX_COMPONENTS} if needed). Each object:
- "name": specific component (e.g. "penne pasta", "tomato marinara sauce", "grated parmesan", "fresh basil", "olive oil", "garlic" — NEVER one vague row for the whole plate).
- "isDrink": boolean — true for beverages; true for sauces/dressings as liquid components.
- "confidence": 0–100 — higher when clearly visible; ~45–72 for ingredients inferred only from typical recipes.
- "portionRatio": 0.0–1.0 — must sum to 1.0 across all items.
- "isBlended": true only for inseparable blends (smoothie, pureed soup). Pasta + sauce: false per component.

CRITICAL — items from BOTH:
(1) VISIBLE components in the photo.
(2) TYPICAL INGREDIENTS: from world knowledge of how this dish is usually made, add plausible ingredients often present.

Rules:
- Many specific rows; no single "pasta dish" catch-all.
- If unclear, still give best dishSummary and reasonable components with moderate confidence.
- portionRatios sum to 1.0.

Output must be valid JSON with keys dishSummary (string) and items (array).`;

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function normalizeFoods(raw: unknown[]): RecognizedFood[] {
  const foods = raw
    .filter(
      (f): f is Record<string, unknown> =>
        f != null && typeof f === "object" && typeof (f as Record<string, unknown>).name === "string",
    )
    .map((f) => ({
      name: String(f.name).trim(),
      isDrink: Boolean(f.isDrink),
      confidence: Math.min(100, Math.max(0, Math.round(Number(f.confidence) || 70))),
      portionRatio: Math.min(1, Math.max(0, Number(f.portionRatio) || 1)),
      isBlended: Boolean(f.isBlended),
    }))
    .filter((f) => f.name.length > 0);

  const confident = foods.filter((f) => f.confidence >= 40);
  let usable =
    confident.length > 0 ? confident : foods.slice(0).sort((a, b) => b.confidence - a.confidence).slice(0, 12);

  usable = usable.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_COMPONENTS);

  const total = usable.reduce((s, f) => s + f.portionRatio, 0);
  if (total > 0) {
    for (const f of usable) f.portionRatio = f.portionRatio / total;
  } else if (usable.length > 0) {
    const even = 1 / usable.length;
    for (const f of usable) f.portionRatio = even;
  }
  return usable.sort((a, b) => b.confidence - a.confidence);
}

function parseModelJson(content: string): { dishSummary: string | null; foods: RecognizedFood[] } {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return { dishSummary: null, foods: normalizeFoods(parsed) };
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      let dishSummary: string | null = null;
      for (const k of ["dishSummary", "dish_title", "mealName", "meal", "title"] as const) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) {
          dishSummary = v.trim();
          break;
        }
      }
      const raw = o.items ?? o.components ?? o.foods ?? o.ingredients;
      if (Array.isArray(raw)) {
        return { dishSummary, foods: normalizeFoods(raw) };
      }
    }
  } catch {
    /* ignore */
  }
  return { dishSummary: null, foods: [] };
}

function mimeFromBase64(b64: string): string {
  const head = b64.slice(0, 28);
  if (head.startsWith("/9j")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

function dataUrlForVisionBase64(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  return `data:${mimeFromBase64(clean)};base64,${clean}`;
}

/**
 * POST JSON { imageBase64 } to your server. Respond with JSON:
 * { "dishSummary": string, "items": [ { "name", "isDrink", "confidence", "portionRatio", "isBlended" }, ... ] }
 * Or { "text": "<stringified JSON>" } / { "content": "..." } for LLM wrappers.
 */
async function postSelfHosted(
  imageBase64: string,
  url: string,
  token: string | undefined,
): Promise<{ ok: true; contentJson: string } | { ok: false; message: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ imageBase64 }),
    });
  } catch (e) {
    return { ok: false, message: `Self-hosted fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const text = await resp.text();
  if (!resp.ok) {
    return { ok: false, message: `Self-hosted HTTP ${resp.status}: ${text.slice(0, 400)}` };
  }

  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (
      typeof data.dishSummary === "string" ||
      Array.isArray(data.items) ||
      Array.isArray(data.foods)
    ) {
      return { ok: true, contentJson: text };
    }
    if (typeof data.text === "string" && data.text.trim()) {
      return { ok: true, contentJson: data.text.trim() };
    }
    if (typeof data.content === "string" && data.content.trim()) {
      return { ok: true, contentJson: data.content.trim() };
    }
    const inner = data.result ?? data.data;
    if (inner && typeof inner === "object") {
      return { ok: true, contentJson: JSON.stringify(inner) };
    }
    return {
      ok: false,
      message:
        "Self-hosted JSON must include dishSummary + items (or items under result/data), or text/content with JSON string.",
    };
  } catch {
    return { ok: false, message: "Self-hosted response is not valid JSON." };
  }
}

function textFromGeminiResponse(data: unknown): string | null {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; status?: string };
    promptFeedback?: { blockReason?: string };
  };
  if (d.error?.message) return null;
  if (d.promptFeedback?.blockReason) return null;
  const parts = d.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  const texts = parts.map((p) => (typeof p.text === "string" ? p.text : "")).filter(Boolean);
  return texts.join("") || null;
}

/**
 * Google AI Studio / Gemini API (key from https://aistudio.google.com/apikey).
 * Set GEMINI_MODEL if the default is unavailable in your region (e.g. gemini-1.5-flash).
 */
async function runGemini(
  imageBase64: string,
  apiKey: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-1.5-flash";
  const mime = mimeFromBase64(imageBase64);
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\nRespond with only valid JSON (one object). No markdown.` }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Analyze this meal photo. Return JSON with dishSummary and items only." },
              { inlineData: { mimeType: mime, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (e) {
    return { ok: false, message: `Gemini fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const raw = await resp.text();
  if (!resp.ok) {
    return { ok: false, message: `Gemini HTTP ${resp.status}: ${raw.slice(0, 400)}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Gemini response is not valid JSON." };
  }

  const parsedErr = data as { error?: { message?: string } };
  if (parsedErr.error?.message) {
    return { ok: false, message: `Gemini: ${parsedErr.error.message}` };
  }

  const text = textFromGeminiResponse(data);
  if (!text) {
    return { ok: false, message: "Gemini returned no text (check model id and image size)." };
  }
  return { ok: true, text };
}

/** OpenAI Chat Completions shape; also works for OpenRouter. */
async function postOpenAIStyleVision(
  endpoint: string,
  apiKey: string,
  model: string,
  imageBase64: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nRespond with a single JSON object only.` },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this meal photo. Return JSON with dishSummary and items only.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrlForVisionBase64(imageBase64) },
            },
          ],
        },
      ],
    }),
  });
}

async function runOpenAI(imageBase64: string, apiKey: string): Promise<Response> {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  return await postOpenAIStyleVision(
    "https://api.openai.com/v1/chat/completions",
    apiKey,
    model,
    imageBase64,
  );
}

/**
 * OpenRouter: one API key, pick any vision model (e.g. openai/gpt-4o-mini).
 * https://openrouter.ai/keys — avoids Google AI Studio when Gemini API is unavailable in your region.
 */
async function runOpenRouter(imageBase64: string, apiKey: string): Promise<Response> {
  const model = Deno.env.get("OPENROUTER_MEAL_VISION_MODEL")?.trim() || "openai/gpt-4o-mini";
  const referer = Deno.env.get("OPENROUTER_HTTP_REFERER")?.trim() || "https://localhost/";
  const title = Deno.env.get("OPENROUTER_APP_TITLE")?.trim() || "MealVision";
  return await postOpenAIStyleVision(
    "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model,
    imageBase64,
    {
      "HTTP-Referer": referer,
      "X-Title": title,
    },
  );
}

async function contentJsonFromChatResponse(resp: Response): Promise<string> {
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content ?? "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    let imageBase64 = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json({ error: "Missing imageBase64" }, { status: 400 });
    }
    imageBase64 = imageBase64.trim();
    const dm = imageBase64.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    if (dm) imageBase64 = dm[1].replace(/\s/g, "");
    else imageBase64 = imageBase64.replace(/\s/g, "");

    const selfUrl = Deno.env.get("SELF_HOSTED_MEAL_VISION_URL")?.trim();
    const selfToken = Deno.env.get("SELF_HOSTED_MEAL_VISION_TOKEN")?.trim();
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();
    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const fallbackOpenAi = Deno.env.get("SELF_HOSTED_FALLBACK_OPENAI") === "1";
    const fallbackGemini = Deno.env.get("SELF_HOSTED_FALLBACK_GEMINI") === "1";
    const fallbackOpenRouter = Deno.env.get("SELF_HOSTED_FALLBACK_OPENROUTER") === "1";

    if (!selfUrl && !openrouterKey && !geminiKey && !openaiKey) {
      return json(
        {
          error:
            "Set OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, and/or SELF_HOSTED_MEAL_VISION_URL in Supabase Edge secrets.",
        },
        { status: 500 },
      );
    }

    let contentJson = "{}";

    if (selfUrl) {
      const sh = await postSelfHosted(imageBase64, selfUrl, selfToken);
      if (sh.ok) {
        contentJson = sh.contentJson;
      } else {
        let recovered = false;
        const hints: string[] = [sh.message];
        if (fallbackOpenRouter && openrouterKey) {
          const resp = await runOpenRouter(imageBase64, openrouterKey);
          if (resp.ok) {
            contentJson = await contentJsonFromChatResponse(resp);
            recovered = true;
          } else {
            hints.push(`OpenRouter: ${(await resp.text().catch(() => "")).slice(0, 200)}`);
          }
        }
        if (!recovered && fallbackGemini && geminiKey) {
          const g = await runGemini(imageBase64, geminiKey);
          if (g.ok) {
            contentJson = g.text;
            recovered = true;
          } else hints.push(g.message);
        }
        if (!recovered && fallbackOpenAi && openaiKey) {
          const resp = await runOpenAI(imageBase64, openaiKey);
          if (resp.ok) {
            contentJson = await contentJsonFromChatResponse(resp);
            recovered = true;
          } else {
            hints.push(`OpenAI: ${(await resp.text().catch(() => "")).slice(0, 200)}`);
          }
        }
        if (!recovered) {
          return json(
            { error: "Self-hosted vision failed; enable a fallback secret (see README).", hint: hints.join(" | ") },
            { status: 502 },
          );
        }
      }
    } else if (openrouterKey) {
      let resp = await runOpenRouter(imageBase64, openrouterKey);
      if (resp.ok) {
        contentJson = await contentJsonFromChatResponse(resp);
      } else {
        const openrouterErr = await resp.text().catch(() => "");
        if (geminiKey) {
          const g = await runGemini(imageBase64, geminiKey);
          if (g.ok) {
            contentJson = g.text;
          } else if (openaiKey) {
            resp = await runOpenAI(imageBase64, openaiKey);
            if (!resp.ok) {
              const t = await resp.text().catch(() => "");
              return json(
                {
                  error: "OpenRouter, Gemini, and OpenAI failed",
                  details: t.slice(0, 400),
                  hint: `${openrouterErr.slice(0, 180)} | ${g.message}`,
                },
                { status: 502 },
              );
            }
            contentJson = await contentJsonFromChatResponse(resp);
          } else {
            return json(
              {
                error: "OpenRouter and Gemini failed",
                details: openrouterErr.slice(0, 400),
                hint: g.message,
              },
              { status: 502 },
            );
          }
        } else if (openaiKey) {
          resp = await runOpenAI(imageBase64, openaiKey);
          if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            return json(
              {
                error: "OpenRouter failed; OpenAI fallback failed",
                details: t.slice(0, 400),
                hint: openrouterErr.slice(0, 200),
              },
              { status: 502 },
            );
          }
          contentJson = await contentJsonFromChatResponse(resp);
        } else {
          return json(
            { error: "OpenRouter vision request failed", details: openrouterErr.slice(0, 500) },
            { status: 502 },
          );
        }
      }
    } else if (geminiKey) {
      const g = await runGemini(imageBase64, geminiKey);
      if (g.ok) {
        contentJson = g.text;
      } else if (openaiKey) {
        const resp = await runOpenAI(imageBase64, openaiKey);
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          return json(
            { error: "Gemini failed; OpenAI fallback failed", details: t.slice(0, 400), hint: g.message },
            { status: 502 },
          );
        }
        contentJson = await contentJsonFromChatResponse(resp);
      } else {
        return json({ error: g.message }, { status: 502 });
      }
    } else if (openaiKey) {
      const resp = await runOpenAI(imageBase64, openaiKey);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return json({ error: "OpenAI vision request failed", details: text.slice(0, 500) }, { status: 502 });
      }
      contentJson = await contentJsonFromChatResponse(resp);
    }

    const { dishSummary, foods } = parseModelJson(contentJson);
    return json({ dishSummary, foods });
  } catch (e) {
    return json({ error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});
