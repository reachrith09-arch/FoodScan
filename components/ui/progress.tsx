import * as React from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View> & { value?: number }
>(({ className, value, ...props }, ref) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(`${value || 0}%`, { overshootClamping: true }),
    };
  });

  return (
    <View
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <Animated.View
        className="h-full w-full flex-1 bg-primary transition-all"
        style={animatedStyle}
      />
    </View>
  );
});
Progress.displayName = "Progress";

export { Progress };
