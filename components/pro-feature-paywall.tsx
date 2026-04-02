import * as React from "react";
import { ActivityIndicator, Pressable, Text as RNText, useColorScheme, View } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

export interface ProFeaturePaywallProps {
  title: string;
  subtitle: string;
  featureName: string;
  description: string;
  onClose: () => void;
  onUnlock: () => Promise<void>;
}

export function ProFeaturePaywall({
  title,
  subtitle,
  featureName,
  description,
  onClose,
  onUnlock,
}: ProFeaturePaywallProps) {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [unlocking, setUnlocking] = React.useState(false);

  const bg = isDark ? "#000000" : THEME.bgLight;
  /** Inline colors only — dark-mode CSS tokens set primary to white / foreground to black, which can leave native buttons as black-on-black. */
  const titleColor = isDark ? "#ffffff" : THEME.darkGrey;
  const subtitleColor = isDark ? "#cbd5e1" : THEME.mutedGrey;
  const cardBodyColor = isDark ? "#f1f5f9" : "#1e293b";
  const labelMuted = isDark ? "#94a3b8" : THEME.mutedGrey;

  const handleUnlock = React.useCallback(async () => {
    setUnlocking(true);
    try {
      await onUnlock();
    } finally {
      setUnlocking(false);
    }
  }, [onUnlock]);

  return (
    <View className="flex-1" style={{ backgroundColor: bg, paddingTop: insets.top }}>
      <View className="flex-row items-center justify-end px-4 py-2">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ padding: 8 }}
        >
          <X size={24} color={isDark ? "#a1a1aa" : "#6b7280"} strokeWidth={2} />
        </Pressable>
      </View>

      <View className="flex-1 justify-center px-6 pb-8">
        <View
          style={{
            alignSelf: "center",
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: isDark ? `${THEME.primary}22` : `${THEME.primary}18`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Sparkles size={32} color={THEME.primary} strokeWidth={2} />
        </View>

        <Text className="text-center text-2xl font-bold" style={{ color: titleColor }}>
          {title}
        </Text>
        <Text className="mt-2 text-center text-base leading-6" style={{ color: subtitleColor }}>
          {subtitle}
        </Text>

        <View
          style={{
            marginTop: 28,
            padding: 20,
            borderRadius: 20,
            backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
            borderWidth: 1,
            borderColor: isDark ? "#262626" : "#e5e7eb",
            ...THEME.shadowCard,
          }}
        >
          <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: labelMuted }}>
            {featureName}
          </Text>
          <Text className="mt-3 text-base leading-6" style={{ color: cardBodyColor, fontWeight: "500" }}>
            {description}
          </Text>
        </View>

        <Pressable
          onPress={handleUnlock}
          disabled={unlocking}
          accessibilityRole="button"
          accessibilityLabel="Unlock with FoodScan Pro"
          style={({ pressed }) => ({
            marginTop: 28,
            minHeight: 52,
            borderRadius: 14,
            backgroundColor: THEME.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 14,
            paddingHorizontal: 20,
            opacity: unlocking ? 0.65 : pressed ? 0.92 : 1,
            ...THEME.shadowButton,
          })}
        >
          {unlocking ? (
            <ActivityIndicator color={THEME.white} />
          ) : (
            <RNText style={{ color: THEME.white, fontSize: 17, fontWeight: "700" }}>Unlock with FoodScan Pro</RNText>
          )}
        </Pressable>

        <Pressable onPress={onClose} className="mt-4 py-2" accessibilityRole="button">
          <Text className="text-center text-sm" style={{ color: subtitleColor }}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
