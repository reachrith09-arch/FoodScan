/**
 * Client wrapper for the recognize-food Supabase Edge Function.
 * Returns rich recognition results including similarity confidence scores,
 * portion ratios, and blend detection — modeled after AI trash/object detection.
 */

export interface RecognizedFood {
  /** Common/product name (e.g. "Cheerios", "orange juice", "black coffee") */
  name: string;
  /** True when this item is primarily a liquid beverage */
  isDrink: boolean;
  /**
   * Similarity confidence 0–100. How confident the AI is this food/drink is present.
   * Treat like a detection confidence score — higher = more certain match.
   */
  confidence: number;
  /**
   * Estimated visual portion ratio 0–1 (all items in a meal/drink sum to 1.0).
   * Used to auto-populate portion sizes and weight blended scores.
   */
  portionRatio: number;
  /**
   * True when ingredients are physically mixed/blended together (smoothie, soup,
   * cocktail). A single drink in a glass is NOT blended.
   */
  isBlended: boolean;
}

/**
 * Recognize all foods in an image using AI vision.
 *
 * Returns an array of RecognizedFood objects sorted by confidence (highest first).
 * Returns [] on error or if no foods are detected.
 */
export async function recognizeFoodsInImage(
  imageBase64: string,
): Promise<RecognizedFood[]> {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) return [];

  const { data, error } = await supabase.functions.invoke("recognize-food", {
    body: { imageBase64 },
  });

  if (error || !data?.foods) return [];

  const foods = data.foods;
  if (!Array.isArray(foods)) return [];

  return (foods as RecognizedFood[])
    .filter(
      (f) =>
        f != null &&
        typeof f === "object" &&
        typeof f.name === "string" &&
        f.name.trim().length > 0,
    )
    .map((f) => ({
      name: String(f.name).trim(),
      isDrink: Boolean(f.isDrink),
      confidence: Math.min(100, Math.max(0, Number(f.confidence) || 70)),
      portionRatio: Math.min(1, Math.max(0, Number(f.portionRatio) || 1)),
      isBlended: Boolean(f.isBlended),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/** Confidence label for display */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 90) return "Very likely";
  if (confidence >= 75) return "Likely";
  if (confidence >= 55) return "Possibly";
  return "Uncertain";
}

/** Confidence colour for display */
export function confidenceColor(confidence: number): string {
  if (confidence >= 90) return "#16a34a"; // green
  if (confidence >= 75) return "#84cc16"; // lime
  if (confidence >= 55) return "#f59e0b"; // amber
  return "#ef4444";                        // red
}

/**
 * Convert a portionRatio (0–1) to a human-readable portion string.
 * Drinks get ml units; foods get grams.
 *
 * Assumes a default total of 400ml for an all-drink scene or 400g for food.
 * For mixed scenes the caller should pass the appropriate total.
 */
export function ratioToPortionString(
  ratio: number,
  isDrink: boolean,
  totalAmount = 400,
): string {
  const amount = Math.round(ratio * totalAmount);
  return isDrink ? `${amount}ml` : `${amount}g`;
}

/**
 * @deprecated Use ratioToPortionString instead.
 * Kept for backward compatibility — returns a gram value.
 */
export function ratioToGrams(ratio: number, totalGrams = 400): number {
  return Math.round(ratio * totalGrams);
}
