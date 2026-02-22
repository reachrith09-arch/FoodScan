import * as React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { getIngredientImpactForUser } from "@/lib/ingredient-impact";
import type { HealthProfile, IngredientDetail } from "@/types/food";

export function IngredientsDropdown({
  ingredients,
  ingredientsRaw,
  getDetail,
  isDark,
  profile,
}: {
  ingredients: string[];
  ingredientsRaw: string[];
  getDetail: (raw: string) => IngredientDetail | null;
  isDark: boolean;
  profile?: HealthProfile | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [expandedRaw, setExpandedRaw] = React.useState<string | null>(null);
  const borderColor = isDark ? "#404040" : "#d4d4d8";
  const cardBg = isDark ? "#18181b" : "#f4f4f5";
  const modalBg = isDark ? "#0a0a0a" : "#ffffff";

  const triggerLabel =
    ingredients.length === 0
      ? "No ingredients"
      : ingredients.length === 1
        ? ingredients[0]
        : `${ingredients.length} ingredients`;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border px-4 py-3"
        style={{
          borderColor,
          borderWidth: 1.5,
          backgroundColor: cardBg,
        }}
      >
        <Text
          className="flex-1 text-base"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: isDark ? "#f4f4f5" : "#18181b" }}
        >
          {triggerLabel}
        </Text>
        <ChevronDown size={20} color={isDark ? "#a1a1aa" : "#64748b"} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => {
            setOpen(false);
            setExpandedRaw(null);
          }}
        >
          <Pressable
            className="max-h-[85%] rounded-t-2xl"
            style={{ backgroundColor: modalBg }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="border-b px-4 pb-3 pt-4" style={{ borderColor: isDark ? "#333" : "#e5e5e7" }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold" style={{ color: isDark ? "#ffffff" : "#18181b" }}>
                  Ingredients
                </Text>
                <Button variant="ghost" size="sm" onPress={() => { setOpen(false); setExpandedRaw(null); }}>
                  <Text style={{ color: isDark ? "#ffffff" : "#18181b" }}>Done</Text>
                </Button>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground" style={{ color: isDark ? "#a1a1aa" : "#64748b" }}>
                From product data; check the package for the official list.
              </Text>
            </View>
            <ScrollView
              className="max-h-96 px-4 py-2"
              keyboardShouldPersistTaps="handled"
            >
              {ingredients.map((ing, i) => {
                const raw = ingredientsRaw[i] ?? ing;
                const detail = getDetail(raw) ?? getDetail(ing);
                const isExpanded = expandedRaw === raw;
                return (
                  <Pressable
                    key={`${raw}-${i}`}
                    onPress={() => setExpandedRaw(isExpanded ? null : raw)}
                    style={{
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: isDark ? "#404040" : "#d4d4d8",
                      backgroundColor: cardBg,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text className="font-medium" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
                      {ing}
                    </Text>
                    {detail && (
                      <Text className="mt-0.5 text-xs" style={{ color: isDark ? "#a1a1aa" : "#64748b" }}>
                        {isExpanded ? "Tap to collapse" : "Tap for details"}
                      </Text>
                    )}
                    {detail && isExpanded && (
                      <View
                        style={{
                          marginTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: isDark ? "#404040" : "#e4e4e7",
                          paddingTop: 10,
                        }}
                      >
                        {profile && (() => {
                          const impact = getIngredientImpactForUser(raw, profile);
                          if (impact) {
                            return (
                              <View
                                className="mb-2 rounded-lg border px-3 py-2"
                                style={{
                                  borderColor: isDark ? "#b91c1c" : "#dc2626",
                                  backgroundColor: isDark ? "rgba(185,28,28,0.15)" : "rgba(220,38,38,0.08)",
                                }}
                              >
                                <Text className="text-xs font-medium" style={{ color: isDark ? "#fca5a5" : "#b91c1c" }}>
                                  For you
                                </Text>
                                <Text className="mt-0.5 text-sm" style={{ color: isDark ? "#fecaca" : "#991b1b" }}>
                                  {impact}
                                </Text>
                              </View>
                            );
                          }
                          return null;
                        })()}
                        <Text className="text-sm" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
                          {detail.plainDescription}
                        </Text>
                        <Text className="mt-1 text-sm" style={{ color: isDark ? "#a1a1aa" : "#64748b" }}>
                          Typical use: {detail.typicalUse}
                        </Text>
                        <Text className="mt-1 text-sm" style={{ color: isDark ? "#a1a1aa" : "#64748b" }}>
                          {detail.healthConsideration}
                        </Text>
                      </View>
                    )}
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
