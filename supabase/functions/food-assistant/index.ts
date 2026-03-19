// Supabase Edge Function: food-assistant
// - Answers food questions using an LLM
// - Refuses non-food questions
// - Keeps responses short and easy to digest

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  question: string;
  product?: unknown;
  analysis?: unknown;
  profile?: unknown;
  reactionSummary?: string | null;
};

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

    const systemParts = [
      "You are FoodScan Assistant. The user has scanned a food product and you have its full data (product_name, ingredients_text, nutriments, additives, etc.) in the context below.",
      "INGREDIENT QUESTIONS ('what is X', 'what does X mean', 'is X safe'): Give a specific, useful answer in 3–5 sentences. Cover: (1) what the ingredient actually IS and where it comes from, (2) why it is used in this specific product (texture, preservation, sweetness, etc.), (3) any health considerations at the amount typically found in food, and (4) who should watch out for it (e.g. people with allergies, diabetes, high blood pressure). Be direct — never say 'it's often used for texture or flavour' as a standalone answer. Use the product's actual ingredient list to give context.",
      "NUTRITION QUESTIONS: Reference the actual nutriments from the product data. Give numbers (e.g. '12g of sugar per 100g') and explain what that means in plain terms (e.g. 'that's about 3 teaspoons').",
      "HEALTH/SAFETY QUESTIONS: Be honest and specific. If an ingredient has known concerns (e.g. high sodium, artificial dyes, controversial additives), say so clearly but without alarmism. If it's generally safe, say that too.",
      "HEALTHIER ALTERNATIVES: Give 2–3 specific product types or brands, not vague advice.",
      "You ONLY answer questions about food, ingredients, additives, nutrition, label terms, allergens, and healthier alternatives. If the question is clearly not about food, reply exactly: \"I can only answer questions about food, ingredients, and nutrition.\"",
      "Format: Use plain language (8th-grade reading level). Keep answers under 120 words. Use short paragraphs. Do not use bullet points. Do not diagnose or treat medical conditions; add 'Not medical advice.' only if the user asks for medical guidance.",
    ];
    if (body.reactionSummary && String(body.reactionSummary).trim()) {
      systemParts.push(
        "The user has also logged body reactions (symptoms, severity, notes) in the app. When relevant, briefly consider their logged symptoms and notes to personalize advice (e.g. if they often log headaches or bloating, you may mention ingredients that could be worth watching). Do not diagnose; keep it to practical, food-related suggestions."
      );
    }
    const system = systemParts.join("\n");

    const context: Record<string, unknown> = {
      question,
      product: body.product ?? null,
      analysis: body.analysis ?? null,
      profile: body.profile ?? null,
    };
    if (body.reactionSummary && String(body.reactionSummary).trim()) {
      context.reactionSummary = body.reactionSummary;
    }
    const user = [
      "Scanned product and question — use the product (ingredients, nutriments, etc.) to answer:",
      JSON.stringify(context, null, 2),
    ].join("\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
image.png