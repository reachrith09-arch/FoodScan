import { getTodayKey } from "@/lib/analytics";
import { getScanHistory } from "@/lib/storage";
import type { HealthProfile, MealType } from "@/types/food";

export interface ScanContext {
  todayScansCount: number;
  mealType: MealType | undefined;
  timeOfDay: "morning" | "midday" | "afternoon" | "evening" | "night";
  recentMealTypes: MealType[];
}

function getTimeOfDay(): ScanContext["timeOfDay"] {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "midday";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/**
 * Get context for the current scan: today's scan count, meal type, time of day, recent meals.
 */
export async function getScanContext(
  currentMealType?: MealType,
  currentTimestamp?: number
): Promise<ScanContext> {
  const todayKey = getTodayKey();
  const history = await getScanHistory();
  const todayScans = history.filter((s) => {
    const d = new Date(s.timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}` === todayKey;
  });
  const recentMealTypes = todayScans
    .slice(0, 5)
    .map((s) => s.mealType)
    .filter((m): m is MealType => !!m);

  return {
    todayScansCount: todayScans.length,
    mealType: currentMealType,
    timeOfDay: getTimeOfDay(),
    recentMealTypes,
  };
}

/**
 * Generate a short context-aware note for the score page.
 */
export function getContextNote(
  context: ScanContext,
  profile: HealthProfile | null
): string | null {
  const parts: string[] = [];

  if (context.todayScansCount > 0) {
    parts.push(`${context.todayScansCount} scan${context.todayScansCount === 1 ? "" : "s"} today`);
  }
  if (context.mealType) {
    parts.push(`logged as ${context.mealType}`);
  }
  if (context.timeOfDay) {
    const labels: Record<ScanContext["timeOfDay"], string> = {
      morning: "morning",
      midday: "lunch time",
      afternoon: "afternoon",
      evening: "evening",
      night: "night",
    };
    parts.push(`(${labels[context.timeOfDay]})`);
  }

  if (parts.length === 0) return null;
  return "Context: " + parts.join(" · ");
}
