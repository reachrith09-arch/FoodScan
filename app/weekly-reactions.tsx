import { useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { getReactions } from "@/lib/reactions";
import { THEME } from "@/lib/theme";
import type { ReactionLogEntry } from "@/types/analytics";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function fmtWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`;
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SEVERITY_META: Record<
  number,
  { color: string; bg: string; label: string }
> = {
  1: { color: "#16a34a", bg: "#dcfce7", label: "Very mild" },
  2: { color: "#65a30d", bg: "#ecfccb", label: "Mild" },
  3: { color: "#d97706", bg: "#fef3c7", label: "Moderate" },
  4: { color: "#ea580c", bg: "#ffedd5", label: "Severe" },
  5: { color: "#dc2626", bg: "#fee2e2", label: "Very severe" },
};

const SEVERITY_META_DARK: Record<
  number,
  { color: string; bg: string; label: string }
> = {
  1: { color: "#4ade80", bg: "#14532d33", label: "Very mild" },
  2: { color: "#a3e635", bg: "#365314aa", label: "Mild" },
  3: { color: "#fbbf24", bg: "#78350f55", label: "Moderate" },
  4: { color: "#fb923c", bg: "#7c2d1255", label: "Severe" },
  5: { color: "#f87171", bg: "#7f1d1d55", label: "Very severe" },
};

// ─── summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({
  reactions,
  isDark,
}: {
  reactions: ReactionLogEntry[];
  isDark: boolean;
}) {
  const cardBg = isDark ? "#111111" : "#ffffff";
  const border = isDark ? "#2a2a2a" : "#e5e7eb";
  const label  = isDark ? "#f4f4f5" : "#111827";
  const muted  = isDark ? "#9ca3af" : "#6b7280";

  const avgSeverity =
    reactions.length === 0
      ? 0
      : Math.round(
          reactions.reduce((s, r) => s + r.severity, 0) / reactions.length
        );

  const allSymptoms = reactions.flatMap((r) => r.symptoms);
  const counts = new Map<string, number>();
  for (const s of allSymptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
  const topSymptom = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const meta = (isDark ? SEVERITY_META_DARK : SEVERITY_META)[avgSeverity] ?? SEVERITY_META[1];

  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: cardBg, borderColor: border },
      ]}
    >
      <View style={styles.summaryItem}>
        <RNText style={[styles.summaryNum, { color: label }]}>
          {reactions.length}
        </RNText>
        <RNText style={[styles.summaryLbl, { color: muted }]}>Reactions</RNText>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: border }]} />
      <View style={styles.summaryItem}>
        <RNText style={[styles.summaryNum, { color: meta.color }]}>
          {reactions.length === 0 ? "—" : avgSeverity}
        </RNText>
        <RNText style={[styles.summaryLbl, { color: muted }]}>Avg severity</RNText>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: border }]} />
      <View style={styles.summaryItem}>
        <RNText
          style={[styles.summaryNum, { color: label, fontSize: 14 }]}
          numberOfLines={1}
        >
          {topSymptom ? topSymptom[0] : "—"}
        </RNText>
        <RNText style={[styles.summaryLbl, { color: muted }]}>Top symptom</RNText>
      </View>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function WeeklyReactionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const [reactions, setReactions] = React.useState<ReactionLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const { start: weekStart, end: weekEnd } = getWeekBounds();

  const bg     = isDark ? "#000000" : "#f9fafb";
  const cardBg = isDark ? "#111111" : "#ffffff";
  const border = isDark ? "#2a2a2a" : "#e5e7eb";
  const title  = isDark ? "#ffffff" : "#111827";
  const muted  = isDark ? "#9ca3af" : "#6b7280";
  const label  = isDark ? "#f4f4f5" : "#111827";

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const all = await getReactions();
        const filtered = all.filter(
          (r) => r.timestamp >= weekStart.getTime() && r.timestamp <= weekEnd.getTime()
        );
        if (active) {
          setReactions(filtered);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 8,
            backgroundColor: cardBg,
            borderBottomColor: border,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.backBtn}>
          <RNText style={[styles.backText, { color: THEME.primary }]}>← Back</RNText>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <RNText style={[styles.titleText, { color: title }]}>Body reactions</RNText>
            <RNText style={[styles.weekRange, { color: muted }]}>
              {fmtWeekRange(weekStart, weekEnd)}
            </RNText>
          </View>
          {!loading && reactions.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: THEME.primary + "22", borderColor: THEME.primary + "55" }]}>
              <RNText style={[styles.countBadgeText, { color: THEME.primary }]}>
                {reactions.length} logged
              </RNText>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.primary} size="large" />
        </View>
      ) : reactions.length === 0 ? (
        <View style={styles.center}>
          <RNText style={styles.emptyIcon}>💤</RNText>
          <RNText style={[styles.emptyTitle, { color: title }]}>No reactions this week</RNText>
          <RNText style={[styles.emptyBody, { color: muted }]}>
            After a meal, tap "Log reaction" on a scan result to track how your body responds.
          </RNText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SummaryBar reactions={reactions} isDark={isDark} />

          {reactions.map((r) => {
            const meta = (isDark ? SEVERITY_META_DARK : SEVERITY_META)[r.severity];
            return (
              <View
                key={r.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: cardBg,
                    borderColor: border,
                    borderLeftColor: meta.color,
                  },
                ]}
              >
                {/* Date row */}
                <RNText style={[styles.dateText, { color: muted }]}>
                  {fmtDateTime(r.timestamp)}
                </RNText>

                {/* Severity pill */}
                <View
                  style={[
                    styles.severityPill,
                    { backgroundColor: meta.bg, borderColor: meta.color + "66" },
                  ]}
                >
                  <View style={[styles.severityDot, { backgroundColor: meta.color }]} />
                  <RNText style={[styles.severityPillText, { color: meta.color }]}>
                    Severity {r.severity} · {meta.label}
                  </RNText>
                </View>

                {/* Symptom tags */}
                {r.symptoms.length > 0 && (
                  <View style={styles.tagsRow}>
                    {r.symptoms.map((s) => (
                      <View
                        key={s}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: isDark ? "#1e1e1e" : "#f3f4f6",
                            borderColor: border,
                          },
                        ]}
                      >
                        <RNText style={[styles.tagText, { color: label }]}>{s}</RNText>
                      </View>
                    ))}
                  </View>
                )}

                {/* Notes */}
                {r.notes ? (
                  <View style={[styles.notesBox, { backgroundColor: isDark ? "#1a1a1a" : "#f9fafb", borderColor: border }]}>
                    <RNText style={[styles.notesLabel, { color: muted }]}>Notes</RNText>
                    <RNText style={[styles.notesText, { color: label }]}>{r.notes}</RNText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 18, fontWeight: "600" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  weekRange: { fontSize: 13, marginTop: 2 },
  countBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 10,
  },
  countBadgeText: { fontSize: 12, fontWeight: "700" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 36,
  },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 280 },

  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 16,
    marginBottom: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLbl: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    marginVertical: 4,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    gap: 12,
  },
  dateText: { fontSize: 12, fontWeight: "500" },

  severityPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  severityPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, fontWeight: "600" },

  notesBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  notesLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  notesText: { fontSize: 13, lineHeight: 19 },
});
