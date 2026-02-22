// Supabase Edge Function: recognize-food
// Takes a base64 image and returns a list of recognized food names.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  imageBase64?: string;
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
    const imageBase64 = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json({ error: "Missing imageBase64" }, { status: 400 });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json(
        { error: "OPENAI_API_KEY is not set for this Edge Function. Set it in Supabase secrets." },
        { status: 500 }
      );
    }

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are a food recognition assistant. Given an image of food, list ALL distinct foods or food items visible (e.g. cereal, milk, banana, bread, butter).
Return a JSON array of strings, each a concise food name (e.g. "Cheerios", "2% milk", "banana", "whole wheat bread").
Do not include quantities or portions—just the food names. Use common product names when identifiable (e.g. "Cheerios" for that cereal).
If nothing edible is clearly visible, return an empty array [].
Reply with ONLY the JSON array, no other text.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json({ error: "Vision request failed", details: text }, { status: 502 });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "[]";
    let foods: string[];
    try {
      foods = JSON.parse(content);
      if (!Array.isArray(foods)) foods = [];
      foods = foods.filter((f) => typeof f === "string" && f.trim().length > 0).map((f) => String(f).trim());
    } catch {
      foods = [];
    }

    return json({ foods });
  } catch (e) {
    return json({ error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});
