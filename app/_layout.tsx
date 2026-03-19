import { Stack } from "expo-router";
import * as React from "react";
import { StatusBar as RNStatusBar, useColorScheme, View } from "react-native";
import "react-native-reanimated";
import "@/global.css";
import { THEME } from "@/lib/theme";
import { FontSizeProvider, UnitsProvider } from "@/lib/use-settings";
import { SubscriptionProvider } from "@/lib/revenuecat";
import { SafeAreaView } from "react-native-safe-area-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const barStyle = isDark ? "light-content" : "dark-content";
  const backgroundColor = isDark ? THEME.darkBg : THEME.bgLight;
  React.useEffect(() => {
    RNStatusBar.setBarStyle(barStyle, true);
  }, [barStyle]);
  return (
    <SubscriptionProvider>
    <FontSizeProvider>
      <UnitsProvider>
      <View style={{ flex: 1, backgroundColor }}>
        <RNStatusBar barStyle={barStyle} backgroundColor={backgroundColor} />
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SafeAreaView>
      </View>
      </UnitsProvider>
    </FontSizeProvider>
    </SubscriptionProvider>
  );
}
