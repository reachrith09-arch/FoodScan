import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReactionLogEntry } from "@/types/analytics";
import { getScanHistory } from "@/lib/storage";

const KEY = "REACTIONS";

export async function getReactions(): Promise<ReactionLogEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ReactionLogEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addReaction(entry: ReactionLogEntry): Promise<void> {
  const list = await getReactions();
  await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, 500)));
}

/**
 * Build a short summary of the user's reaction logs for use in food advice
 * (symptoms, severity, and notes so advice can account for them).
 */
export async function getReactionSummaryForAdvice(maxEntries = 30): Promise<string> {
  const list = await getReactions();
  if (list.length === 0) return "";
  const recent = list.slice(0, maxEntries);
  const symptomCounts = new Map<string, number>();
  const highSeveritySymptoms = new Map<string, number>();
  const noteSnippets: string[] = [];
  for (const r of recent) {
    for (const s of r.symptoms) {
      symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
      if (r.severity >= 4) highSeveritySymptoms.set(s, (highSeveritySymptoms.get(s) ?? 0) + 1);
    }
    if (r.notes?.trim()) noteSnippets.push(r.notes.trim().slice(0, 80));
  }
  const parts: string[] = [];
  const topSymptoms = Array.from(symptomCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([s, c]) => `${s} (${c})`);
  if (topSymptoms.length) parts.push(`Logged symptoms: ${topSymptoms.join(", ")}.`);
  const high = Array.from(highSeveritySymptoms.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);
  if (high.length) parts.push(`High-severity reactions included: ${high.join(", ")}.`);
  const uniqueNotes = [...new Set(noteSnippets)].slice(0, 3);
  if (uniqueNotes.length) parts.push(`User notes from reactions: "${uniqueNotes.join('"; "')}".`);
  return parts.join(" ");
}

export interface PatternHint {
  label: string;
  count: number;
  details: string;
}

/**
 * Very simple "learning" baseline:
 * - Look at high-severity reactions (>=4)
 * - Count additive tags on the linked scans
 * - Return top recurring additive keys
 */
export async function getPatternHints(): Promise<PatternHint[]> {
  const [reactions, scans] = await Promise.all([getReactions(), getScanHistory()]);
  const scanMap = new Map(scans.map((s) => [s.id, s]));
  const additiveCounts = new Map<string, number>();
  const symptomCounts = new Map<string, number>();

  for (const r of reactions) {
    for (const s of r.symptoms) symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
    if (r.severity < 4) continue;
    const scan = r.relatedScanId ? scanMap.get(r.relatedScanId) : undefined;
    if (!scan) continue;
    for (const a of scan.product.additives_tags ?? []) {
      const key = a.toLowerCase().replace(/^en:/, "");
      additiveCounts.set(key, (additiveCounts.get(key) ?? 0) + 1);
    }
  }

  const topSymptoms = Array.from(symptomCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((s) => ({ label: `Symptom trend: ${s.label}`, count: s.count, details: "Logged reactions over time." }));

  const topAdditives = Array.from(additiveCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((a) => ({
      label: `Possible correlation: ${a.key}`,
      count: a.count,
      details:
        "This additive appears in multiple high-severity reaction logs. This is not proof—use as a clue to investigate and consult a professional if needed.",
    }));

  return [...topSymptoms, ...topAdditives];
}

