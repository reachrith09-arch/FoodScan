// Supabase Edge Function: recognize-food
// Takes a base64 image and returns recognized foods with similarity scores,
// blend detection, and estimated portion ratios.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  imageBase64?: string;
};

export interface RecognizedFood {
  /** Common/product name (e.g. "Cheerios", "orange juice", "black coffee") */
  name: string;
  /** True when this item is primarily a liquid beverage */
  isDrink: boolean;
  /**
   * Similarity confidence 0–100. How confident the AI is this food/drink is present.
   * Modeled after object detection confidence scores.
   */
  confidence: number;
  /**
   * Estimated visual portion ratio 0–1 (sums to 1.0 across all items).
   * Used to weight the blended health score.
   */
  portionRatio: number;
  /**
   * True when ingredients are physically mixed/blended together (smoothie, soup,
   * cocktail). A single drink in a glass is NOT blended.
   */
  isBlended: boolean;
}

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

    const systemPrompt = `You are a food and drink recognition AI similar to object detection systems used in nutritional analysis.

Given an image of food OR drink, identify ALL distinct items visible and return a structured JSON array.

CRITICAL for salads, bowls, plates, and mixed meals: List EACH ingredient separately. Do NOT group. A homemade salad = lettuce, tomato, cucumber, onion, dressing, cheese, croutons, etc. as separate items. A Buddha bowl = rice, chickpeas, avocado, greens, tahini, etc. A sandwich = bread, lettuce, tomato, meat, cheese, mayo, etc. The health score is a composite of every component — nothing should be omitted.

For each item return:
- "name": concise, common name. For drinks use specific names like "orange juice", "whole milk", "black coffee", "Coca-Cola", "green smoothie", "red wine", "oat milk latte". For food use "brown rice", "grilled chicken", "banana", "romaine lettuce", "olive oil dressing", "feta cheese".
- "isDrink": boolean — true if this item is primarily a liquid beverage (juice, milk, coffee, tea, soda, beer, wine, water, smoothie, shake, broth, dressing, sauce, etc.)
- "confidence": integer 0-100 — detection confidence (like an object detection score)
- "portionRatio": float 0.0-1.0 — estimated visual fraction of the total scene (all must sum to 1.0)
- "isBlended": boolean — true ONLY if ingredients are physically mixed/blended together so they cannot be separated (smoothie, soup, stew, curry, cocktail with multiple ingredients). A salad with distinct veggies: isBlended false for each. A smoothie: isBlended true for each.

Rules:
- Include ALL visible foods, drinks, dressings, sauces, toppings, and garnishes
- List each component separately — never group "salad" as one item; list lettuce, tomato, dressing, etc.
- Only include items with confidence >= 40
- portionRatios must sum to exactly 1.0
- A standalone glass of juice or bottle of water: isBlended: false, isDrink: true
- A smoothie with visible mixed ingredients: isBlended: true, isDrink: true
- Reply ONLY with a valid JSON array, no markdown, no explanation

Example — glass of orange juice and a banana:
[
  {"name":"orange juice","isDrink":true,"confidence":96,"portionRatio":0.60,"isBlended":false},
  {"name":"banana","isDrink":false,"confidence":98,"portionRatio":0.40,"isBlended":false}
]

Example — bowl of cereal with milk and coffee on the side:
[
  {"name":"Cheerios","isDrink":false,"confidence":95,"portionRatio":0.35,"isBlended":false},
  {"name":"whole milk","isDrink":true,"confidence":90,"portionRatio":0.30,"isBlended":false},
  {"name":"black coffee","isDrink":true,"confidence":92,"portionRatio":0.35,"isBlended":false}
]

Example — green smoothie (blended ingredients):
[
  {"name":"spinach","isDrink":false,"confidence":85,"portionRatio":0.35,"isBlended":true},
  {"name":"banana","isDrink":false,"confidence":80,"portionRatio":0.35,"isBlended":true},
  {"name":"almond milk","isDrink":true,"confidence":70,"portionRatio":0.30,"isBlended":true}
]

Example — can of Coca-Cola:
[
  {"name":"Coca-Cola","isDrink":true,"confidence":98,"portionRatio":1.0,"isBlended":false}
]

Example — homemade salad (each ingredient separate):
[
  {"name":"romaine lettuce","isDrink":false,"confidence":95,"portionRatio":0.25,"isBlended":false},
  {"name":"cherry tomatoes","isDrink":false,"confidence":92,"portionRatio":0.15,"isBlended":false},
  {"name":"cucumber","isDrink":false,"confidence":90,"portionRatio":0.15,"isBlended":false},
  {"name":"red onion","isDrink":false,"confidence":85,"portionRatio":0.08,"isBlended":false},
  {"name":"feta cheese","isDrink":false,"confidence":88,"portionRatio":0.12,"isBlended":false},
  {"name":"olive oil dressing","isDrink":true,"confidence":75,"portionRatio":0.15,"isBlended":false},
  {"name":"croutons","isDrink":false,"confidence":82,"portionRatio":0.10,"isBlended":false}
]`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
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
    const content: string = data?.choices?.[0]?.message?.content ?? "[]";

    let foods: RecognizedFood[];
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        foods = [];
      } else {
        foods = parsed
          .filter(
            (f: unknown) =>
              f != null &&
              typeof f === "object" &&
              typeof (f as Record<string, unknown>).name === "string" &&
              (f as Record<string, unknown>).name !== ""
          )
          .map((f: Record<string, unknown>) => ({
            name: String(f.name).trim(),
            isDrink: Boolean(f.isDrink),
            confidence: Math.min(100, Math.max(0, Math.round(Number(f.confidence) || 70))),
            portionRatio: Math.min(1, Math.max(0, Number(f.portionRatio) || 1)),
            isBlended: Boolean(f.isBlended),
          }));

        // Re-normalise portionRatios so they always sum to 1.0
        const total = foods.reduce((s, f) => s + f.portionRatio, 0);
        if (total > 0) {
          for (const f of foods) f.portionRatio = f.portionRatio / total;
        } else if (foods.length > 0) {
          const even = 1 / foods.length;
          for (const f of foods) f.portionRatio = even;
        }
      }
    } catch {
      foods = [];
    }

    return json({ foods });
  } catch (e) {
    return json({ error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});
