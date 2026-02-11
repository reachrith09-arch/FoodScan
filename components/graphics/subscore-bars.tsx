import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";

const BAR_HEIGHT = 8;
const ROW_MIN_HEIGHT = 38;

interface BarProps {
  label: string;
  value: number; // 0-100
  isDark?: boolean;
}

function Bar({ label, value, isDark }: BarProps) {
  const v = Math.max(0, Math.min(100, Number(value) ?? 0));
  const fillWidthPercent = v;
  // Green 75–100, yellow 50–75, red 0–50
  const barColor =
    v >= 75 ? "#22c55e" : v >= 50 ? "#eab308" : "#ef4444";
  const labelColor = isDark ? "#ffffff" : undefined;
  const valueColor = isDark ? "#a1a1aa" : undefined;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={[styles.barLabel, labelColor ? { color: labelColor } : undefined]}>
          {label}
        </Text>
        <Text style={[styles.barValue, valueColor ? { color: valueColor } : undefined]}>
          {Math.round(v)}
        </Text>
      </View>
      <View style={[styles.track, isDark && styles.trackDark]}>
        <View
          style={[
            styles.fill,
            { width: `${fillWidthPercent}%`, minWidth: v > 0 ? 4 : 0, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

export function SubscoreBars({
  subscores,
  isDark = false,
}: {
  subscores: {
    allergens?: number;
    nutrition?: number;
    additives?: number;
    processing?: number;
    dietFit?: number;
  };
  isDark?: boolean;
}) {
  const s = subscores ?? {};
  const allergens = Number(s.allergens ?? 0);
  const nutrition = Number(s.nutrition ?? 0);
  const additives = Number(s.additives ?? 0);
  const processing = Number(s.processing ?? 0);
  const dietFit = Number(s.dietFit ?? 0);
  const allergenRisk = Math.round(100 - allergens);

  return (
    <View style={styles.container}>
      <Bar label="Allergen risk" value={allergenRisk} isDark={isDark} />
      <Bar label="Nutrition" value={nutrition} isDark={isDark} />
      <Bar label="Additives" value={additives} isDark={isDark} />
      <Bar label="Processing" value={processing} isDark={isDark} />
      <Bar label="Diet fit" value={dietFit} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minWidth: 140,
    gap: 12,
  },
  barRow: {
    minHeight: ROW_MIN_HEIGHT,
    width: "100%",
    gap: 4,
  },
  barLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  barLabel: {
    fontSize: 14,
  },
  barValue: {
    fontSize: 12,
  },
  track: {
    height: BAR_HEIGHT,
    width: "100%",
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  trackDark: {
    backgroundColor: "#27272a",
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
});
