/** Shared UI labels for AI / vision confidence scores (0–100). */

export function confidenceLabel(confidence: number): string {
  if (confidence >= 90) return "Very likely";
  if (confidence >= 75) return "Likely";
  if (confidence >= 55) return "Possibly";
  return "Uncertain";
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 90) return "#16a34a";
  if (confidence >= 75) return "#84cc16";
  if (confidence >= 55) return "#f59e0b";
  return "#ef4444";
}
