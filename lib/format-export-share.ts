import type { ReactionLogEntry } from "@/types/analytics";
import type { HealthProfile } from "@/types/food";

/** Same shape as `exportUserData` JSON (without `null` profile quirks). */
export interface UserDataExportPayload {
  exportedAt: string;
  profile: HealthProfile | null;
  scanHistoryCount: number;
  favoritesCount: number;
  reactionsCount: number;
  reactions: ReactionLogEntry[];
  settings: { units: string; colorScheme: string };
}

function listLine(label: string, items: string[] | undefined, empty = "None"): string {
  const v = items?.map((s) => s.trim()).filter(Boolean) ?? [];
  return `• ${label}: ${v.length ? v.join(", ") : empty}`;
}

function humanizeCountry(code: string | undefined): string {
  if (!code?.trim()) return "Not set";
  const raw = code.replace(/^en:/i, "").replace(/_/g, "-");
  return raw
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function humanizeAgeRange(range: HealthProfile["ageRange"]): string {
  if (!range) return "Not set";
  const map: Record<string, string> = {
    "under-18": "Under 18",
    "18-30": "18–30",
    "31-50": "31–50",
    "51-64": "51–64",
    "65-plus": "65+",
  };
  return map[range] ?? range;
}

function humanizeActivity(level: HealthProfile["activityLevel"]): string {
  if (!level) return "Not set";
  const map: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Light",
    moderate: "Moderate",
    active: "Active",
    "very-active": "Very active",
  };
  return map[level] ?? level.replace(/-/g, " ");
}

function humanizeUnits(u: string): string {
  return u === "imperial" ? "Imperial (oz, lb)" : "Metric (g, ml, kcal)";
}

function humanizeColorScheme(s: string): string {
  const map: Record<string, string> = {
    light: "Light",
    dark: "Dark",
    system: "Match system",
  };
  return map[s] ?? s;
}

/** Plain-language summary for Share sheet / messages (human-readable only). */
export function formatUserDataExportForShare(data: UserDataExportPayload): string {
  const p = data.profile;
  const lines: string[] = [];

  lines.push("FoodScan — my data");
  lines.push("");
  const when = Number.isNaN(Date.parse(data.exportedAt))
    ? data.exportedAt
    : new Date(data.exportedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
  lines.push(`Exported: ${when}`);
  lines.push("");
  lines.push("Health profile");
  if (p) {
    lines.push(listLine("Conditions", p.conditions));
    lines.push(listLine("Allergies", p.allergies));
    lines.push(listLine("Dietary preferences", p.dietaryPreferences));
    lines.push(listLine("Goals", p.goals));
    lines.push(listLine("Medications", p.medications ?? []));
    lines.push(`• Country / region: ${humanizeCountry(p.countryCode)}`);
    lines.push(`• Age range: ${humanizeAgeRange(p.ageRange)}`);
    lines.push(`• Activity: ${humanizeActivity(p.activityLevel)}`);
  } else {
    lines.push("• No health profile saved in the app.");
  }

  lines.push("");
  lines.push("Activity in app");
  lines.push(`• Saved scans: ${data.scanHistoryCount}`);
  lines.push(`• Favorites: ${data.favoritesCount}`);
  lines.push(`• Symptom / reaction logs: ${data.reactionsCount}`);
  if (data.reactions.length > 0) {
    lines.push("Recent reactions (up to 10):");
    for (const r of data.reactions.slice(0, 10)) {
      const sev = `severity ${r.severity}/5`;
      const sym = (r.symptoms ?? []).join(", ") || "symptoms logged";
      const whenR = new Date(r.timestamp).toLocaleDateString(undefined, { dateStyle: "short" });
      lines.push(`  – ${whenR}: ${sym} (${sev})`);
    }
    if (data.reactions.length > 10) {
      lines.push(`  … and ${data.reactions.length - 10} more not listed here.`);
    }
  }

  lines.push("");
  lines.push("Settings");
  lines.push(`• Units: ${humanizeUnits(data.settings.units)}`);
  lines.push(`• Appearance: ${humanizeColorScheme(data.settings.colorScheme)}`);

  return lines.join("\n");
}
