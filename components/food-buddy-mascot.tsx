import * as React from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { THEME } from "@/lib/theme";

type FoodBuddyMascotProps = {
  size?: number;
  /** Subtle idle bob (header / beside bubbles). */
  animate?: boolean;
};

/**
 * Sprout — minimal “pea-buddy” mascot: soft bean shape, happy closed eyes (no stare),
 * tiny stem leaves. Reads like a sticker / emoji, not a small realistic face.
 */
export function FoodBuddyMascot({
  size = 56,
  animate = true,
}: FoodBuddyMascotProps) {
  const bob = useSharedValue(0);

  React.useEffect(() => {
    if (!animate) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [animate, bob]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const w = size;
  const h = size;

  return (
    <Animated.View style={wrapperStyle}>
      <View style={{ width: w, height: h }}>
        <Svg width={w} height={h} viewBox="0 0 100 100">
          {/* Round bean body — pastel, outlined like a soft sticker */}
          <Path
            d="M50 26c18 0 30 12 34 28 4 18-6 34-22 40-8 3-16 3-24 0-16-6-26-22-22-40 4-16 16-28 32-28z"
            fill="#d1fae5"
            stroke="#6ee7b7"
            strokeWidth={2.25}
            strokeLinejoin="round"
          />
          {/* Light belly patch */}
          <Path
            d="M50 40c10 0 18 8 20 18 2 12-6 22-20 22s-22-10-20-22c2-10 10-18 20-18z"
            fill="#ecfdf5"
            opacity={0.95}
          />
          {/* Tiny stem + round leaf buds */}
          <Path
            d="M50 26v-8"
            stroke={THEME.primary}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle
            cx={42}
            cy={17}
            r={6}
            fill={THEME.primaryBright}
            stroke={THEME.primary}
            strokeWidth={1}
          />
          <Circle
            cx={58}
            cy={17}
            r={6}
            fill="#86efac"
            stroke={THEME.primary}
            strokeWidth={1}
          />
          {/* Happy squint eyes — upward arcs, no whites / pupils */}
          <Path
            d="M36 55 Q40 50 44 55"
            stroke="#166534"
            strokeWidth={2.35}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M56 55 Q60 50 64 55"
            stroke="#166534"
            strokeWidth={2.35}
            strokeLinecap="round"
            fill="none"
          />
          {/* Small warm smile */}
          <Path
            d="M42 65c4 5 12 5 16 0"
            stroke={THEME.primaryDark}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
          {/* Cheek spots — soft, low contrast */}
          <Circle cx={30} cy={62} r={5} fill="#fda4af" opacity={0.32} />
          <Circle cx={70} cy={62} r={5} fill="#fda4af" opacity={0.32} />
        </Svg>
      </View>
    </Animated.View>
  );
}
