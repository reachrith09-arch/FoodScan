import * as React from "react";
import { router } from "expo-router";
import { Pressable, Text as RNText, useColorScheme, View } from "react-native";
import { User, ScanBarcode } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  /**
   * Defaults to "/(tabs)/profile"
   */
  rightHref?: string;
  /**
   * Defaults to a User icon.
   */
  rightIcon?: React.ReactNode;
  /**
   * For accessibility (icon button label).
   */
  rightLabel?: string;
};

export function AppHeader({
  title = "FoodScan",
  subtitle = "Eat smarter. Live better",
  rightHref = "/(tabs)/profile",
  rightIcon,
  rightLabel = "Open profile",
}: AppHeaderProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = isDark ? THEME.white : THEME.primary;
  const subtitleColor = isDark ? "#a1a1aa" : THEME.mutedGrey;
  const headerBg = isDark ? THEME.darkCard : THEME.cardLight;

  return (
    <View
      style={{
        paddingTop: 4,
        backgroundColor: headerBg,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? THEME.borderDark : THEME.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="flex-row items-center px-4 pb-3 pt-2">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: THEME.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ScanBarcode size={22} color={THEME.white} strokeWidth={2.5} />
        </View>
        <View className="ml-3 flex-1">
          <RNText style={{ fontSize: 20, fontWeight: "700", color: isDark ? THEME.white : THEME.darkGrey }}>
            {title}
          </RNText>
          <Text className="text-xs leading-4" style={{ color: subtitleColor, marginTop: 2 }} numberOfLines={1}>
            {subtitle.endsWith(".") ? subtitle.slice(0, -1) : subtitle}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(rightHref)}
          accessibilityLabel={rightLabel}
          className="h-10 w-10 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {rightIcon ?? <User size={22} color={iconColor} strokeWidth={2} />}
        </Pressable>
      </View>
    </View>
  );
}

