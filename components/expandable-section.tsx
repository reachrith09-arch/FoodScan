import { ChevronDown } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

export function ExpandableSection({
  title,
  defaultOpen = false,
  children,
  isDark,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isDark?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const textColor = isDark ? "#ffffff" : undefined;
  const mutedColor = isDark ? "#a1a1aa" : undefined;
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between py-2"
        style={{ minHeight: 44 }}
      >
        <Text className="font-medium text-foreground" style={textColor ? { color: textColor } : undefined}>
          {title}
        </Text>
        <ChevronDown
          size={20}
          color={mutedColor ?? "#71717a"}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? <View className="pt-0 pb-2">{children}</View> : null}
    </View>
  );
}
