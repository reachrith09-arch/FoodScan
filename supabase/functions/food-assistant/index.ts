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
      "You are FoodScan Assistant. The user has scanned a product; you receive its full data (product_name, ingredients_text, ingredients_tags, nutriments, etc.) in the context below.",
      "For ANY question about that food you MUST answer using the product context: explain any ingredient, additive, E-number, or label term that appears in the product in plain language. You can answer 'what does X mean', 'what is X', 'is X safe', nutrition questions, and healthier-alternative questions. Do not say you don't know or don't have information when the product data is provided — use it plus general food-science knowledge to give a short, clear answer.",
      "You ONLY answer questions about food, ingredients, additives, nutrition, label terms, allergens, and healthier alternatives. If the question is clearly not about food (e.g. weather, sports, politics), reply exactly: \"I can only answer questions about food, ingredients, and nutrition.\"",
      "Write for a general audience (8th-grade reading). Be concise, practical, and non-judgmental. For healthier options give 2-4 concrete swap ideas. Do not diagnose or treat; add 'Not medical advice.' if asked for medical guidance.",
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
        temperature: 0.2,
        max_tokens: 350,
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