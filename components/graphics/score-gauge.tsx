import * as React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/components/ui/text";

interface ScoreGaugeProps {
  score: number; // 0-100
  label: string;
  size?: number;
  isDark?: boolean;
}

export function ScoreGauge({ score, label, size = 120, isDark = false }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = 12;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const progress = (clamped / 100) * c;

  // Green 75–100, yellow 50–75, red 0–50 (matches subscore bars)
  const color =
    clamped >= 75 ? "#22c55e" : clamped >= 50 ? "#eab308" : "#ef4444";
  const scoreColor = isDark ? "#ffffff" : undefined;
  const labelColor = isDark ? "#a1a1aa" : undefined;

  return (
    <View className="items-center justify-center">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${progress} ${c - progress}`}
            strokeLinecap="round"
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-3xl font-semibold text-foreground" style={scoreColor ? { color: scoreColor } : undefined}>
            {clamped}
          </Text>
          <Text className="text-xs text-muted-foreground" style={labelColor ? { color: labelColor } : undefined}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

