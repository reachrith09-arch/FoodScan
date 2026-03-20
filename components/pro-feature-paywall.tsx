import * as React from "react";
import { ActivityIndicator, Pressable, useColorScheme, View } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
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
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;

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

        <Text className="text-center text-2xl font-bold" style={textWhite}>
          {title}
        </Text>
        <Text className="mt-2 text-center text-base leading-6 text-muted-foreground" style={textMuted}>
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
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={textMuted}>
            {featureName}
          </Text>
          <Text className="mt-2 text-sm leading-6" style={textWhite}>
            {description}
          </Text>
        </View>

        <Button
          className="mt-8 h-12 rounded-xl"
          onPress={handleUnlock}
          disabled={unlocking}
        >
          {unlocking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-primary-foreground">Unlock with FoodScan Pro</Text>
          )}
        </Button>

        <Pressable onPress={onClose} className="mt-4 py-2" accessibilityRole="button">
          <Text className="text-center text-sm text-muted-foreground" style={textMuted}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
