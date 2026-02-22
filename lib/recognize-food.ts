/**
 * Call Supabase recognize-food Edge Function to detect foods in an image.
 */
export async function recognizeFoodsInImage(imageBase64: string): Promise<string[]> {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) return [];

  const { data, error } = await supabase.functions.invoke("recognize-food", {
    body: { imageBase64 },
  });

  if (error || !data?.foods) return [];
  const foods = data.foods;
  return Array.isArray(foods) ? foods.filter((f: unknown) => typeof f === "string" && f.trim()) : [];
}
