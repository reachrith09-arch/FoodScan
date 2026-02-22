// Supabase Edge Function: lookup-product-online
// When a product isn't in Open Food Facts, search the web and extract product info.
// Requires SERPER_API_KEY and OPENAI_API_KEY in Supabase secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  query?: string;
  barcode?: string;
};

type SerperOrganic = { title?: string; link?: string; snippet?: string };
type SerperResponse = { organic?: SerperOrganic[] };

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
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const barcode = typeof body?.barcode === "string" ? body.barcode.trim() : "";

    const searchQuery = barcode
      ? `barcode ${barcode} product nutrition ingredients`
      : query
        ? `${query} nutrition ingredients per 100g`
        : "";
    if (!searchQuery) {
      return json({ product: null, error: "Missing query or barcode" }, { status: 400 });
    }

    const serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      return json(
        { product: null, error: "SERPER_API_KEY is not set. Add it in Supabase secrets to enable online lookup." },
        { status: 500 }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json(
        { product: null, error: "OPENAI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: searchQuery, num: 5 }),
    });

    if (!serperRes.ok) {
      const text = await serperRes.text().catch(() => "");
      return json({ product: null, error: "Search failed", details: text }, { status: 502 });
    }

    const serperData = (await serperRes.json()) as SerperResponse;
    const organic = serperData?.organic ?? [];
    const topResults = organic.slice(0, 4).map((o) => ({
      title: o.title ?? "",
      snippet: o.snippet ?? "",
      link: o.link ?? "",
    }));

    if (topResults.length === 0) {
      return json({ product: null });
    }

    const prompt = `The user searched for: "${searchQuery}"

Extract food product information ONLY if it clearly matches this search (same product type and brand). If the results describe a different product (e.g. Lindt chocolate when searching for KIND granola), return {"product_name": null}.

Return a JSON object with: product_name (string or null - must match the search), brands (string or null), ingredients_text (string or null), nutriments (object with: "energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "sodium_100g", "sugars_100g" - numbers only, use null if unknown). If nutrition is per serving, estimate per 100g. Return ONLY valid JSON.

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
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You extract food product data from search results. ONLY return a product that clearly matches the user's search (same food type and brand). If results describe a different product, set product_name to null. Return valid JSON with keys: product_name, brands, ingredients_text, nutriments. nutriments values are numbers per 100g.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => "");
      return json({ product: null, error: "Extraction failed", details: text }, { status: 502 });
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content ?? "{}";
    let extracted: {
      product_name?: string;
      brands?: string | null;
      ingredients_text?: string | null;
      nutriments?: Record<string, number | null> | null;
    } = {};

    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        extracted = parsed;
      }
    } catch {
      return json({ product: null });
    }

    const productName = extracted.product_name && typeof extracted.product_name === "string"
      ? extracted.product_name.trim()
      : null;
    if (!productName) {
      return json({ product: null });
    }

    const nutriments = extracted.nutriments && typeof extracted.nutriments === "object"
      ? {
          "energy-kcal_100g": numOrUndef(extracted.nutriments["energy-kcal_100g"]),
          proteins_100g: numOrUndef(extracted.nutriments.proteins_100g),
          carbohydrates_100g: numOrUndef(extracted.nutriments.carbohydrates_100g),
          fat_100g: numOrUndef(extracted.nutriments.fat_100g),
          sodium_100g: numOrUndef(extracted.nutriments.sodium_100g),
          sugars_100g: numOrUndef(extracted.nutriments.sugars_100g),
        }
      : undefined;

    const product = {
      code: barcode || `online-${Date.now()}`,
      product_name: productName,
      brands: extracted.brands && String(extracted.brands).trim() ? String(extracted.brands).trim() : undefined,
      ingredients_text: extracted.ingredients_text && String(extracted.ingredients_text).trim()
        ? String(extracted.ingredients_text).trim()
        : undefined,
      nutriments,
    };

    return json({ product });
  } catch (e) {
    return json({ product: null, error: "Unexpected error", details: String(e) }, { status: 500 });
  }
});

function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
