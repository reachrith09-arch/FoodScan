import * as React from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  /** Optional: isDark for border colors */
  isDark?: boolean;
  /** Optional inline style for text when selected (e.g. white) */
  selectedTextStyle?: object;
  unselectedTextStyle?: object;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  isDark = false,
  selectedTextStyle,
  unselectedTextStyle,
}: SegmentedControlProps<T>) {
  const borderColor = isDark ? "#525252" : "#e5e7eb";
  const selectedBg = "#22c55e";
  const selectedText = selectedTextStyle ?? { color: "#ffffff" };

  return (
    <View
      className={cn("flex-row rounded-xl border p-0.5", className)}
      style={{ borderColor }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onValueChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className="flex-1 items-center justify-center py-2.5 rounded-lg"
            style={{
              backgroundColor: selected ? selectedBg : "transparent",
            }}
          >
            <Text
              className={selected ? "font-semibold" : ""}
              style={selected ? selectedText : unselectedTextStyle}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
