import * as React from "react";
import {
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPatternHints } from "@/lib/reactions";
import { THEME } from "@/lib/theme";

type HintType = "symptom" | "correlation" | "keyword";

function classifyHint(label: string): { type: HintType; name: string } {
  if (label.startsWith("Symptom trend: "))
    return { type: "symptom", name: label.replace("Symptom trend: ", "") };
  if (label.startsWith("Possible correlation: "))
    return { type: "correlation", name: label.replace("Possible correlation: ", "") };
  if (label.startsWith("Note keyword: "))
    return { type: "keyword", name: label.replace("Note keyword: ", "").replace(/"/g, "") };
  return { type: "correlation", name: label };
}

const TYPE_META = {
  symptom: {
    icon: "🩺",
    tag: "Symptom",
    light: { accent: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", tagBg: "#ede9fe" },
    dark:  { accent: "#a78bfa", bg: "#1e1033", border: "#3b2870", tagBg: "#2e1f5e" },
  },
  correlation: {
    icon: "⚠️",
    tag: "Additive",
    light: { accent: "#d97706", bg: "#fffbeb", border: "#fde68a", tagBg: "#fef3c7" },
    dark:  { accent: "#fbbf24", bg: "#1a1505", border: "#5c4a1a", tagBg: "#3d3210" },
  },
  keyword: {
    icon: "📝",
    tag: "From notes",
    light: { accent: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", tagBg: "#cffafe" },
    dark:  { accent: "#22d3ee", bg: "#0a1a1e", border: "#155e75", tagBg: "#133040" },
  },
};

export default function PatternHintsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [hints, setHints] = React.useState<Awaited<ReturnType<typeof getPatternHints>>>([]);

  React.useEffect(() => {
    getPatternHints().then(setHints);
  }, []);

  const bg = isDark ? "#000000" : "#f9fafb";
  const cardBg = isDark ? "#111111" : "#ffffff";
  const border = isDark ? "#2a2a2a" : "#e5e7eb";
  const titleColor = isDark ? "#ffffff" : "#111827";
  const muted = isDark ? "#9ca3af" : "#6b7280";

  const symptoms = hints.filter((h) => h.label.startsWith("Symptom"));
  const correlations = hints.filter((h) => h.label.startsWith("Possible"));
  const keywords = hints.filter((h) => h.label.startsWith("Note"));

  const sections: { title: string; type: HintType; items: typeof hints }[] = [];
  if (symptoms.length) sections.push({ title: "Symptom trends", type: "symptom", items: symptoms });
  if (correlations.length) sections.push({ title: "Possible correlations", type: "correlation", items: correlations });
  if (keywords.length) sections.push({ title: "Recurring note keywords", type: "keyword", items: keywords });

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
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
            <RNText style={[styles.titleText, { color: titleColor }]}>Pattern hints</RNText>
            <RNText style={[styles.subtitle, { color: muted }]}>
              Early clues from your reaction logs
            </RNText>
          </View>
          {hints.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: THEME.primary + "22", borderColor: THEME.primary + "55" }]}>
              <RNText style={[styles.countBadgeText, { color: THEME.primary }]}>
                {hints.length} found
              </RNText>
            </View>
          )}
        </View>
      </View>

      {hints.length === 0 ? (
        <View style={styles.center}>
          <RNText style={styles.emptyIcon}>🔍</RNText>
          <RNText style={[styles.emptyTitle, { color: titleColor }]}>No patterns detected yet</RNText>
          <RNText style={[styles.emptyBody, { color: muted }]}>
            Log more body reactions to see correlations between ingredients and symptoms.
          </RNText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <View style={[styles.disclaimer, { backgroundColor: isDark ? "#1a1a1a" : "#f3f4f6", borderColor: border }]}>
            <RNText style={{ fontSize: 12, color: muted, lineHeight: 17 }}>
              These patterns are based on your logged reactions. They are not medical proof — use them as clues to investigate with a professional.
            </RNText>
          </View>

          {sections.map((section) => {
            const meta = TYPE_META[section.type];
            const colors = isDark ? meta.dark : meta.light;

            return (
              <View key={section.title} style={{ marginTop: 20 }}>
                <RNText style={[styles.sectionTitle, { color: colors.accent }]}>
                  {meta.icon}  {section.title}
                </RNText>

                {section.items.map((h, i) => {
                  const { name } = classifyHint(h.label);
                  return (
                    <View
                      key={`${h.label}-${i}`}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          borderLeftColor: colors.accent,
                        },
                      ]}
                    >
                      <View style={styles.cardTop}>
                        <View style={[styles.tag, { backgroundColor: colors.tagBg }]}>
                          <RNText style={[styles.tagText, { color: colors.accent }]}>{meta.tag}</RNText>
                        </View>
                        <View style={[styles.countPill, { backgroundColor: isDark ? "#ffffff15" : "#00000008" }]}>
                          <RNText style={{ fontSize: 12, fontWeight: "700", color: muted }}>×{h.count}</RNText>
                        </View>
                      </View>
                      <RNText style={[styles.cardName, { color: titleColor }]}>{name}</RNText>
                      <RNText style={[styles.cardDetails, { color: muted }]}>{h.details}</RNText>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 18, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "center" },
  titleText: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
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
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  disclaimer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  card: {
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardName: { fontSize: 17, fontWeight: "700" },
  cardDetails: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
