// Supabase Edge Function: search-products-online
// Search Google for products matching the query and extract multiple options.
// Requires SERPER_API_KEY and OPENAI_API_KEY in Supabase secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = { query?: string };

type SerperOrganic = { title?: string; link?: string; snippet?: string };
type SerperResponse = { organic?: SerperOrganic[] };

type ExtractedProduct = {
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  serving_size?: string;
  nutriments?: Record<string, number | null>;
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

function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return json({ products: [], error: "Missing query" }, { status: 400 });
    }

    const serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      return json(
        { products: [], error: "SERPER_API_KEY is not set. Add it in Supabase secrets." },
        { status: 500 }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json({ products: [], error: "OPENAI_API_KEY is not set." }, { status: 500 });
    }

    const searchQuery = `${query} food product nutrition ingredients`;
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: searchQuery, num: 15 }),
    });

    if (!serperRes.ok) {
      const text = await serperRes.text().catch(() => "");
      return json({ products: [], error: "Search failed", details: text }, { status: 502 });
    }

    const serperData = (await serperRes.json()) as SerperResponse;
    const organic = serperData?.organic ?? [];
    const topResults = organic.slice(0, 12).map((o) => ({
      title: o.title ?? "",
      snippet: o.snippet ?? "",
      link: o.link ?? "",
    }));

    if (topResults.length === 0) {
      return json({ products: [] });
    }

    const prompt = `The user searched for: "${query}"

From the search results below, extract ALL food products with COMPLETE information. Return a JSON array of objects. Each object MUST have:
- product_name (string)
- brands (string or null)
- ingredients_text (string - full ingredients list when available; use null only if truly not in results)
- serving_size (string or null, e.g. "30g", "1 bar")
- nutriments (object with numbers per 100g: "energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "sodium_100g", "sugars_100g" - estimate per 100g from per-serving values when needed; use null for unknown)

Rules:
- Include ALL products that match the search. Extract ingredients and nutrition whenever they appear in the results.
- Exclude irrelevant products (e.g. Lindt when searching for KIND).
- Each product should have ingredients_text and nutriments when the search results contain that info.
- Return ONLY a valid JSON array, no other text.

Search results:
${topResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.link}`).join("\n\n")}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "Extract food products from search results. Return a JSON array of objects with product_name, brands, ingredients_text, nutriments. Only include products that match the user's search. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => "");
      return json({ products: [], error: "Extraction failed", details: text }, { status: 502 });
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content ?? "[]";
    let extracted: ExtractedProduct[] = [];

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        extracted = parsed.filter(
          (x: unknown) => x && typeof x === "object" && typeof (x as ExtractedProduct).product_name === "string"
        );
      }
    } catch {
      return json({ products: [] });
    }

    const products = extracted.map((e, i) => {
      const nutriments = e.nutriments && typeof e.nutriments === "object"
        ? {
            "energy-kcal_100g": numOrUndef(e.nutriments["energy-kcal_100g"]),
            proteins_100g: numOrUndef(e.nutriments.proteins_100g),
            carbohydrates_100g: numOrUndef(e.nutriments.carbohydrates_100g),
            fat_100g: numOrUndef(e.nutriments.fat_100g),
            sodium_100g: numOrUndef(e.nutriments.sodium_100g),
            sugars_100g: numOrUndef(e.nutriments.sugars_100g),
          }
        : undefined;

      return {
        code: `online-${Date.now()}-${i}`,
        product_name: String((e as ExtractedProduct).product_name ?? "Unknown").trim(),
        brands: e.brands && String(e.brands).trim() ? String(e.brands).trim() : undefined,
        ingredients_text: e.ingredients_text && String(e.ingredients_text).trim()
          ? String(e.ingredients_text).trim()
          : undefined,
        serving_size: e.serving_size && String(e.serving_size).trim() ? String(e.serving_size).trim() : undefined,
        nutriments,
      };
    });

    return json({ products });
  } catch (e) {
    return json({ products: [], error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});
