import { ChevronDown } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

type IconCmp = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export function AddFoodDropdown(props: {
  options: readonly { label: string; href: string; icon: IconCmp }[];
  onPick: (href: string) => void;
  isDark: boolean;
  width: number;
}) {
  const [open, setOpen] = React.useState(false);
  const borderColor = props.isDark ? "#333" : "#e5e7eb";
  const cardBg = props.isDark ? "#1a1a1a" : "#ffffff";
  const triggerBg = props.isDark ? "#0f2918" : "#d1fae5";
  const triggerBorder = THEME.primary;
  const primaryText = props.isDark ? "#f4f4f5" : THEME.darkGrey;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a food — choose how"
        style={{
          width: props.width,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: triggerBorder,
          backgroundColor: triggerBg,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <Text
          className="font-semibold text-base"
          style={{ color: primaryText }}
        >
          Choose how to add…
        </Text>
        <ChevronDown size={22} color={THEME.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              maxHeight: "72%",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              backgroundColor: cardBg,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                className="font-semibold text-lg"
                style={{ color: props.isDark ? "#ffffff" : "#18181b" }}
              >
                Add a food
              </Text>
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                <Text style={{ color: props.isDark ? "#ffffff" : "#18181b" }}>
                  Done
                </Text>
              </Button>
            </View>
            <ScrollView
              className="max-h-96"
              keyboardShouldPersistTaps="handled"
            >
              {props.options.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Pressable
                    key={opt.href}
                    onPress={() => {
                      props.onPick(opt.href);
                      setOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor,
                      paddingVertical: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        marginRight: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: props.isDark
                          ? "rgba(34, 197, 94, 0.12)"
                          : "rgba(21, 128, 61, 0.08)",
                      }}
                    >
                      <Icon size={22} color={THEME.primary} strokeWidth={2.2} />
                    </View>
                    <Text
                      className="flex-1 font-medium text-base"
                      style={{ color: primaryText }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
