import * as React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Polygon, Stop } from "react-native-svg";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

interface ScoreGaugeProps {
  score: number; // 0-100
  label: string;
  size?: number;
  isDark?: boolean;
}

// Gradient: deep blue → teal → neon green (like reference)
const GRADIENT_COLORS = {
  blue: "#0077b6",
  teal: "#06b6d4",
  green: "#00d68f",
  greenBright: THEME.primaryBright,
};

export function ScoreGauge({ score, label, size = 120, isDark = false }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const progress = (clamped / 100) * c;

  // Arc starts at 6 o'clock (rotation 90). Pointer angle: 90° + progress (clockwise from bottom)
  const angleDeg = 90 + (clamped / 100) * 360;
  const outerR = r + strokeWidth / 2 + 4;
  const pointerX = cx + outerR * Math.cos((angleDeg * Math.PI) / 180);
  const pointerY = cy + outerR * Math.sin((angleDeg * Math.PI) / 180);

  const scoreColor = isDark ? "#ffffff" : "#111827";
  const labelColor = isDark ? "#a1a1aa" : "#6b7280";
  const innerGlow = isDark
    ? "rgba(0, 119, 182, 0.12)"
    : "rgba(34, 197, 94, 0.08)";

  return (
    <View className="items-center justify-center">
      <View
        style={{
          width: size + 32,
          height: size + 32,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: (size + 32) / 2,
          backgroundColor: innerGlow,
        }}
      >
        <View style={{ width: size + 20, height: size + 20 }}>
          <Svg width={size + 20} height={size + 20} viewBox={`0 0 ${size + 20} ${size + 20}`}>
            <Defs>
              <LinearGradient
                id="ringGradient"
                x1="0"
                y1="0.5"
                x2="1"
                y2="0.5"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0" stopColor={GRADIENT_COLORS.blue} stopOpacity={1} />
                <Stop offset="0.5" stopColor={GRADIENT_COLORS.teal} stopOpacity={1} />
                <Stop offset="1" stopColor={GRADIENT_COLORS.greenBright} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <G transform={`translate(10, 10)`}>
              {/* Glow layer: wider, softer stroke behind main ring */}
              <Circle
                cx={cx}
                cy={cy}
                r={r + 2}
                stroke="url(#ringGradient)"
                strokeWidth={strokeWidth + 6}
                fill="none"
                strokeOpacity={0.35}
                strokeDasharray={`${progress} ${c + 20}`}
                strokeLinecap="round"
                rotation={90}
                originX={cx}
                originY={cy}
              />
              {/* Track */}
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                stroke={isDark ? "rgba(82,82,82,0.6)" : "rgba(148,163,184,0.3)"}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Gradient progress ring */}
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                stroke="url(#ringGradient)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${progress} ${c - progress}`}
                strokeLinecap="round"
                rotation={90}
                originX={cx}
                originY={cy}
              />
              {/* Pointer triangle - tip at origin, points outward after rotate */}
              <G transform={`translate(${pointerX}, ${pointerY}) rotate(${angleDeg})`}>
                <Polygon
                  points="0,-6 -4,5 4,5"
                  fill={isDark ? "rgba(255,255,255,0.9)" : "#ffffff"}
                  stroke={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.08)"}
                  strokeWidth={1}
                />
              </G>
            </G>
          </Svg>
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ left: 10, right: 10, top: 10, bottom: 10 }}
          >
            <Text
              className="font-bold text-foreground"
              style={[
                scoreColor ? { color: scoreColor } : undefined,
                {
                  fontSize: 40,
                  textShadowColor: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.06)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: isDark ? 8 : 4,
                },
              ]}
            >
              {clamped}
            </Text>
            <Text
              className="mt-0.5 font-medium text-muted-foreground"
              style={[
                labelColor ? { color: labelColor } : undefined,
                {
                  fontSize: 12,
                  letterSpacing: 1,
                  textShadowColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.04)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 4,
                },
              ]}
            >
              {label}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
