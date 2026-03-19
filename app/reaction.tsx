import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { TagSection } from "@/components/tag-section";
import { addReaction } from "@/lib/reactions";
import { THEME } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactionLogEntry, SymptomSeverity } from "@/types/analytics";

const SEVERITIES = [1, 2, 3, 4, 5] as const;

export default function ReactionScreen() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [severity, setSeverity] = React.useState<SymptomSeverity>(3);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const bg      = isDark ? "#000000" : "#f9fafb";
  const cardBg  = isDark ? "#111111" : "#ffffff";
  const border  = isDark ? "#2a2a2a" : "#e5e7eb";
  const title   = isDark ? "#ffffff" : "#111827";
  const muted   = isDark ? "#9ca3af" : "#6b7280";
  const label   = isDark ? "#f4f4f5" : "#111827";
  const inputBg = isDark ? "#1a1a1a" : "#f9fafb";

  const save = async () => {
    setSaving(true);
    const entry: ReactionLogEntry = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      relatedScanId: scanId,
      symptoms,
      severity,
      notes: notes.trim() || undefined,
    };
    await addReaction(entry);
    setSaving(false);
    router.back();
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: bg }]}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Card */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>

        {/* Header */}
        <View style={styles.header}>
          <RNText style={[styles.titleText, { color: title }]}>Log body reaction</RNText>
          <RNText style={[styles.subtitleText, { color: muted }]}>
            Track symptoms after eating so the app can spot patterns over time.
          </RNText>
        </View>

        <View style={styles.body}>

          {/* Symptoms */}
          <TagSection
            label="Symptoms"
            value={symptoms}
            onChange={setSymptoms}
            placeholder="e.g. headache, bloating, rash"
            isDark={isDark}
          />

          {/* Severity */}
          <View style={styles.section}>
            <RNText style={[styles.sectionLabel, { color: label }]}>Severity (1–5)</RNText>

            <View style={styles.severityRow}>
              {SEVERITIES.map((v) => {
                const selected = severity === v;
                return (
                  <TouchableOpacity
                    key={v}
                    activeOpacity={0.7}
                    onPress={() => setSeverity(v as SymptomSeverity)}
                    style={[
                      styles.severityBtn,
                      {
                        backgroundColor: selected ? THEME.primary : inputBg,
                        borderColor: selected ? THEME.primary : border,
                      },
                    ]}
                  >
                    <RNText
                      style={[
                        styles.severityNum,
                        { color: selected ? "#ffffff" : label },
                      ]}
                    >
                      {v}
                    </RNText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.severityHints}>
              <RNText style={[styles.hintText, { color: muted }]}>Mild</RNText>
              <RNText style={[styles.hintText, { color: muted }]}>Severe</RNText>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <RNText style={[styles.sectionLabel, { color: label }]}>
              Notes{" "}
              <RNText style={{ fontSize: 12, color: muted }}>
                (optional · used in future scans)
              </RNText>
            </RNText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What happened? When? Any patterns?"
              placeholderTextColor={muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={[
                styles.notesInput,
                {
                  backgroundColor: inputBg,
                  borderColor: border,
                  color: label,
                },
              ]}
            />
          </View>

        </View>
      </View>

      {/* Save — centered, floats at the bottom of the scroll content */}
      <View style={styles.saveBtnWrap}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: THEME.primary, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <RNText style={styles.saveBtnText}>Save</RNText>
          )}
        </TouchableOpacity>
      </View>

      {/* Cancel */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => router.back()}
        style={styles.cancelBtn}
      >
        <RNText style={[styles.cancelText, { color: muted }]}>Cancel</RNText>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 6,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
  },

  body: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 28,
  },

  section: { gap: 10 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  severityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  severityBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },

  severityNum: {
    fontSize: 18,
    fontWeight: "700",
  },

  severityHints: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
  },

  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
  },

  saveBtnWrap: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 8,
  },

  saveBtn: {
    width: "60%",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },

  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
