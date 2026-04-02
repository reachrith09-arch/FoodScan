// Supabase Edge Function: food-assistant
// - Answers food questions using an LLM (multi-turn, compact product context)
// - Refuses non-food questions
// - Conversational: avoid dumping full label unless asked

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatTurn = { role: "user" | "assistant"; content: string };

type Payload = {
  question: string;
  history?: ChatTurn[];
  product?: unknown;
  analysis?: unknown;
  profile?: unknown;
  reactionSummary?: string | null;
};

const MAX_HISTORY_TURNS = 16;
const MAX_MSG_CHARS = 2500;

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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function compactProduct(product: unknown): string {
  const p = asRecord(product);
  if (!p) return "No product data.";
  const name = String(p.product_name_en ?? p.product_name ?? "Unknown product");
  const brands = p.brands != null ? String(p.brands) : "";
  const n = asRecord(p.nutriments) ?? {};
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = n[k];
      if (typeof v === "number" && !Number.isNaN(v)) return v;
    }
    return undefined;
  };
  const sugars = pick(["sugars_100g", "sugars"]);
  const sodium = pick(["sodium_100g", "sodium"]);
  const energy = pick(["energy-kcal_100g", "energy_100g", "energy"]);
  const protein = pick(["proteins_100g", "proteins"]);
  const fat = pick(["fat_100g", "fat"]);
  const fiber = pick(["fiber_100g", "fiber"]);
  const ingFull = String(p.ingredients_text_en ?? p.ingredients_text ?? "").replace(/\s+/g, " ").trim();
  const ingExcerpt = ingFull.length > 550 ? `${ingFull.slice(0, 550)}…` : ingFull;
  const additives = Array.isArray(p.additives_tags) ? (p.additives_tags as string[]).slice(0, 12) : [];
  const allergens = Array.isArray(p.allergens_tags) ? (p.allergens_tags as string[]).slice(0, 8) : [];
  const lines = [
    `Name: ${name}${brands ? ` — ${brands}` : ""}`,
    `Per 100g (when available): energy ~${energy ?? "?"} kcal, sugar ~${sugars ?? "?"} g, sodium ~${sodium ?? "?"} mg, protein ~${protein ?? "?"} g, fat ~${fat ?? "?"} g, fiber ~${fiber ?? "?"} g`,
  ];
  if (ingExcerpt) lines.push(`Ingredients (excerpt): ${ingExcerpt}`);
  if (additives.length) lines.push(`Additives (tags): ${additives.join(", ")}`);
  if (allergens.length) lines.push(`Allergen tags: ${allergens.join(", ")}`);
  return lines.join("\n");
}

function compactAnalysis(analysis: unknown): string {
  const a = asRecord(analysis);
  if (!a) return "";
  const score = a.overallScore;
  const label = a.overallLabel;
  const drivers = Array.isArray(a.drivers) ? (a.drivers as Record<string, unknown>[]) : [];
  const driverLines = drivers.slice(0, 4).map((d) => {
    const l = String(d.label ?? "");
    const det = String(d.detail ?? "").slice(0, 120);
    return l && det ? `${l}: ${det}` : l || det;
  });
  const parts = [
    typeof score === "number" ? `App score: ${score}/100 (${String(label ?? "")})` : "",
    ...driverLines,
  ].filter(Boolean);
  return parts.length ? `Analysis summary:\n${parts.join("\n")}` : "";
}

function compactProfile(profile: unknown): string {
  const pr = asRecord(profile);
  if (!pr) return "";
  const prefs = Array.isArray(pr.dietaryPreferences) ? (pr.dietaryPreferences as string[]).join(", ") : "";
  const allergies = Array.isArray(pr.allergies) ? (pr.allergies as string[]).join(", ") : "";
  const goals = Array.isArray(pr.goals) ? (pr.goals as string[]).join(", ") : "";
  const bits = [
    prefs && `Diet: ${prefs}`,
    allergies && `Allergies: ${allergies}`,
    goals && `Goals: ${goals}`,
  ].filter(Boolean);
  return bits.length ? `User profile (respect when relevant):\n${bits.join("\n")}` : "";
}

function normalizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const role = o.role === "user" || o.role === "assistant" ? o.role : null;
    if (!role) continue;
    const content = String(o.content ?? "").trim().slice(0, MAX_MSG_CHARS);
    if (!content) continue;
    out.push({ role, content });
  }
  return out.slice(-MAX_HISTORY_TURNS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    const question = String(body.question ?? "").trim();
    if (!question) return json({ error: "Missing question" }, { status: 400 });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "OPENAI_API_KEY is not set for this Edge Function. Set it in Supabase secrets.",
        },
        { status: 500 },
      );
    }

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    const history = normalizeHistory(body.history);

    const productBlock = compactProduct(body.product);
    const analysisBlock = compactAnalysis(body.analysis);
    const profileBlock = compactProfile(body.profile);

    const systemParts = [
      "You are FoodScan Assistant — a friendly, conversational helper (like mainstream chat AIs) for someone who scanned a packaged food product.",
      "STYLE: Answer only what they asked in their latest message. Use natural sentences; you may use short bullet lists when listing swaps, options, or steps. Do not paste huge walls of text.",
      "CONTEXT: You have a compact summary of the scanned product below. Do NOT dump the full ingredient string, full nutrition table, raw JSON, or OCR text unless they explicitly ask for the full list, full label, or everything on the package.",
      "FOLLOW-UPS: Use the conversation history. If they say “a few more”, “what else”, “any others” after you discussed swaps, give only 2–4 more swap ideas — no full product recap.",
      "MEAL-TYPE ONLY: If their message is only a category (snack, breakfast, drink, dessert, lunch, dinner, meal), treat it as asking for swaps in that category for the scanned product — not as an ingredient name.",
      "INGREDIENT QUESTIONS: Be specific — what it is, why it’s in this product, sensible health notes, who should be cautious. Use the ingredient excerpt when relevant.",
      "NUTRITION: Give numbers from the summary when available and explain in plain language.",
      "HEALTHIER ALTERNATIVES: Suggest concrete product types or categories; 2–4 ideas unless they ask for more.",
      "NON-FOOD: If clearly not about food, reply exactly: \"I can only answer questions about food, ingredients, and nutrition.\"",
      "DISCLAIMER: Do not diagnose or prescribe. If they ask for medical treatment, briefly note this is not medical advice.",
      "Keep answers focused; aim under ~150 words unless they ask for detail.",
      "",
      "--- Scanned product (reference; do not repeat wholesale) ---",
      productBlock,
    ];
    if (analysisBlock) {
      systemParts.push("", analysisBlock);
    }
    if (profileBlock) {
      systemParts.push("", profileBlock);
    }
    if (body.reactionSummary && String(body.reactionSummary).trim()) {
      systemParts.push(
        "",
        "Logged body reactions (symptoms, notes) — personalize cautiously when relevant; do not diagnose:",
        String(body.reactionSummary).trim().slice(0, 1200),
      );
    }

    const system = systemParts.join("\n");

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: system },
    ];
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: "user", content: question.slice(0, MAX_MSG_CHARS) });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 800,
        messages,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json({ error: "LLM request failed", details: text }, { status: 502 });
    }

    const data = await resp.json();
    const answer =
      data?.choices?.[0]?.message?.content ??
      "Sorry—something went wrong generating an answer.";

    return json({ answer });
  } catch (e) {
    return json({ error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});
