import * as React from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type ChatTypingIndicatorProps = {
  dotColor: string;
  pillBg: string;
  borderColor: string;
};

/** Three-dot bounce similar to Snapchat’s chat typing indicator. */
export function ChatTypingIndicator({
  dotColor,
  pillBg,
  borderColor,
}: ChatTypingIndicatorProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor,
        backgroundColor: pillBg,
        alignSelf: "flex-start",
        gap: 5,
      }}
    >
      <TypingDot color={dotColor} delayMs={0} />
      <TypingDot color={dotColor} delayMs={120} />
      <TypingDot color={dotColor} delayMs={240} />
    </View>
  );
}

function TypingDot({ color, delayMs }: { color: string; delayMs: number }) {
  const y = useSharedValue(0);

  React.useEffect(() => {
    y.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-6, { duration: 220, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }),
          withTiming(0, { duration: 280 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
