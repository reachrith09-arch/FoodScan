import * as React from "react";
import { StyleSheet, View } from "react-native";
import { AlertTriangle, Flame, FlaskConical, Cog, Heart } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

const BAR_HEIGHT = 8;
const ROW_MIN_HEIGHT = 44;

interface BarProps {
  label: string;
  value: number; // 0-100
  isDark?: boolean;
}

const LABEL_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  "Allergen safety": AlertTriangle,
  "Nutrition": Flame,
  "Additives": FlaskConical,
  "Processing": Cog,
  "Diet fit": Heart,
};

function Bar({ label, value, isDark }: BarProps) {
  const v = Math.max(0, Math.min(100, Number(value) ?? 0));
  const fillWidthPercent = v;
  const barColor = v >= 75 ? THEME.primary : v >= 50 ? "#eab308" : "#ef4444";
  const labelColor = isDark ? "#ffffff" : undefined;
  const valueColor = isDark ? "#a1a1aa" : undefined;
  const Icon = LABEL_ICONS[label] ?? null;
  const iconColor = isDark ? "#a1a1aa" : THEME.mutedGrey;
  return (
    <View style={[styles.barRow, styles.barCard, isDark && styles.barCardDark]}>
      <View style={styles.barLabelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {Icon && <Icon size={14} color={iconColor} />}
          <Text style={[styles.barLabel, labelColor ? { color: labelColor } : undefined]}>
            {label}
          </Text>
        </View>
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
  // Same polarity as scoring.ts: higher = better. (Previously we showed 100−safety as “risk”
  // but used the same green/yellow/red scale as other rows, so a safe meal looked dangerously red.)

  return (
    <View style={styles.container}>
      <Bar label="Allergen safety" value={Math.round(allergens)} isDark={isDark} />
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
    gap: 14,
  },
  barRow: {
    minHeight: ROW_MIN_HEIGHT,
    width: "100%",
    gap: 4,
  },
  barCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  barCardDark: {
    backgroundColor: "rgba(26,26,26,0.8)",
    shadowOpacity: 0.1,
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
