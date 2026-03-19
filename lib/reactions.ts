import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReactionLogEntry } from "@/types/analytics";
import { getScanHistory } from "@/lib/storage";
import { getAdditiveDisplayName } from "@/data/e-number-names";

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
 * Build a detailed summary of the user's reaction logs for use in food advice.
 * Includes symptoms, high-severity patterns, and full user notes so the AI
 * assistant and health scoring can personalise future scan results.
 */
export async function getReactionSummaryForAdvice(maxEntries = 30): Promise<string> {
  const list = await getReactions();
  if (list.length === 0) return "";
  const recent = list.slice(0, maxEntries);

  const symptomCounts = new Map<string, number>();
  const highSeveritySymptoms = new Map<string, number>();
  const notesBySymptom = new Map<string, string[]>();
  const allNotes: string[] = [];

  for (const r of recent) {
    for (const s of r.symptoms) {
      symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
      if (r.severity >= 4) highSeveritySymptoms.set(s, (highSeveritySymptoms.get(s) ?? 0) + 1);
      // Associate notes with each symptom they were logged alongside
      if (r.notes?.trim()) {
        const existing = notesBySymptom.get(s) ?? [];
        existing.push(r.notes.trim());
        notesBySymptom.set(s, existing);
      }
    }
    if (r.notes?.trim()) allNotes.push(r.notes.trim());
  }

  const parts: string[] = [];

  const topSymptoms = Array.from(symptomCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([s, c]) => `${s} (×${c})`);
  if (topSymptoms.length) {
    parts.push(`Logged symptoms: ${topSymptoms.join(", ")}.`);
  }

  const high = Array.from(highSeveritySymptoms.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);
  if (high.length) {
    parts.push(`High-severity (4–5) reactions: ${high.join(", ")}.`);
  }

  // Include full notes (not truncated) so the AI has complete context
  const uniqueNotes = [...new Set(allNotes)].slice(0, 5);
  if (uniqueNotes.length) {
    parts.push(`User reaction notes: "${uniqueNotes.join('"; "')}".`);
  }

  // Surface symptom-to-note associations for stronger pattern signal
  const symptomNoteLinks: string[] = [];
  for (const [symptom, notes] of notesBySymptom.entries()) {
    const unique = [...new Set(notes)].slice(0, 2);
    if (unique.length) {
      symptomNoteLinks.push(`${symptom}: "${unique.join('"; "')}"`);
    }
  }
  if (symptomNoteLinks.length) {
    parts.push(`Notes linked to symptoms — ${symptomNoteLinks.slice(0, 4).join("; ")}.`);
  }

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
    .map((s) => ({
      label: `Symptom trend: ${s.label}`,
      count: s.count,
      details: `You've logged "${s.label}" ${s.count} time${s.count === 1 ? "" : "s"} across your reaction history.`,
    }));

  // Note-based patterns: collect repeated keywords from notes
  const noteKeywordCounts = new Map<string, number>();
  const STOP_WORDS = new Set(["i", "a", "an", "the", "and", "or", "but", "after", "before", "when", "with", "it", "is", "was", "had", "my", "me", "this", "that", "ate", "felt"]);
  for (const r of reactions) {
    if (!r.notes?.trim()) continue;
    const words = r.notes.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const w of words) {
      if (!STOP_WORDS.has(w)) {
        noteKeywordCounts.set(w, (noteKeywordCounts.get(w) ?? 0) + 1);
      }
    }
  }
  const topNoteKeywords = Array.from(noteKeywordCounts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({
      label: `Note keyword: "${word}"`,
      count,
      details: `You've mentioned "${word}" in ${count} reaction notes. This may indicate a recurring pattern worth tracking.`,
    }));

  const topAdditives = Array.from(additiveCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .filter((a) => a.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((a) => ({
      label: `Possible correlation: ${getAdditiveDisplayName(a.key)}`,
      count: a.count,
      details:
        "This additive appears in multiple high-severity reaction logs. This is not proof—use as a clue to investigate and consult a professional if needed.",
    }));

  return [...topSymptoms, ...topNoteKeywords, ...topAdditives];
}

