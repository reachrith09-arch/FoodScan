import * as React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";

export function CountryDropdown({
  value,
  options,
  onSelect,
  isDark,
}: {
  value: string | undefined;
  options: { value: string; label: string }[];
  onSelect: (value: string | undefined) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = value ? options.find((o) => o.value === value)?.label : null;
  const borderColor = isDark ? "#333" : "#e5e7eb";
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border px-4 py-3"
        style={{ borderColor, backgroundColor: isDark ? "#0a0a0a" : "#f8fafc" }}
      >
        <Text className="text-base" style={{ color: selectedLabel ? (isDark ? "#f4f4f5" : "#18181b") : isDark ? "#71717a" : "#64748b" }}>
          {selectedLabel ?? "Select country..."}
        </Text>
        <ChevronDown size={20} color={isDark ? "#a1a1aa" : "#64748b"} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] rounded-t-2xl p-4"
            style={{ backgroundColor: cardBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-semibold" style={{ color: isDark ? "#ffffff" : "#18181b" }}>
                Country or region
              </Text>
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                <Text style={{ color: isDark ? "#ffffff" : "#18181b" }}>Done</Text>
              </Button>
            </View>
            <ScrollView className="max-h-80" keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => {
                  onSelect(undefined);
                  setOpen(false);
                }}
                className="border-b py-3"
                style={{ borderColor: isDark ? "#333" : "#e5e7eb" }}
              >
                <Text className="text-base" style={{ color: isDark ? "#a1a1aa" : "#64748b" }}>None</Text>
              </Pressable>
              {options.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  className="border-b py-3"
                  style={{ borderColor: isDark ? "#333" : "#e5e7eb" }}
                >
                  <Text className="text-base font-medium" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
