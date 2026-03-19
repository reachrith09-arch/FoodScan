import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as React from "react";
import {
  Alert,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Share,
  Text as RNText,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme as useNativeWindScheme } from "nativewind";
import { useColorScheme } from "react-native";
import { Appearance } from "react-native";
import { Crown } from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button.native";
import { THEME } from "@/lib/theme";
import { exportUserData, getSettings, setSettings } from "@/lib/storage";
import { BODY_SIZES, TITLE_SIZES, useFontSize, useUnits } from "@/lib/use-settings";
import { useSubscription } from "@/lib/revenuecat";

const HEADER_HIDE_OFFSET = 140;

export default function SettingsScreen() {
  const router = useRouter();
  const { isPro, showPaywall } = useSubscription();
  const { setColorScheme: setNativeWindScheme } = useNativeWindScheme();
  const insets = useSafeAreaInsets();
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  const { units, setUnits } = useUnits();
  const [colorScheme, setColorScheme] = React.useState<"light" | "dark" | "system">("system");
  const { fontSize, setFontSize } = useFontSize();
  // Local copy so this screen updates immediately when user taps (no wait for context)
  const [displaySize, setDisplaySize] = React.useState(fontSize);
  const [displayUnits, setDisplayUnits] = React.useState<"metric" | "imperial">(units);
  React.useEffect(() => {
    setDisplaySize(fontSize);
  }, [fontSize]);
  React.useEffect(() => {
    setDisplayUnits(units);
  }, [units]);
  const titleSize = TITLE_SIZES[displaySize];
  const bodySize = BODY_SIZES[displaySize];

  const handleSetFontSize = (size: "small" | "medium" | "large") => {
    setDisplaySize(size);
    setFontSize(size);
  };

  const handleSetUnits = (u: "metric" | "imperial") => {
    setDisplayUnits(u);
    setUnits(u);
  };

  useFocusEffect(
    React.useCallback(() => {
      getSettings().then((s) => {
        setColorScheme(s.colorScheme);
        setDisplayUnits(s.units);
      });
    }, []),
  );

  const setBarVisible = React.useCallback(
    (visible: boolean) => {
      if (visible === headerVisible.current) return;
      headerVisible.current = visible;
      Animated.timing(headerY, {
        toValue: visible ? 0 : -HEADER_HIDE_OFFSET,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [headerY],
  );

  const onScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 8) {
        setBarVisible(true);
        return;
      }
      if (dy > 6) setBarVisible(false);
      else if (dy < -6) setBarVisible(true);
    },
    [setBarVisible],
  );


  const setTheme = React.useCallback(
    (t: "light" | "dark" | "system") => {
      setColorScheme(t);
      void setSettings({ colorScheme: t });
      if (t === "system") Appearance.setColorScheme(null);
      else Appearance.setColorScheme(t);
      setNativeWindScheme(t);
    },
    [setNativeWindScheme],
  );

  const handleExport = async () => {
    try {
      const json = await exportUserData();
      try {
        await Share.share({
          message: json,
          title: "FoodScan data export",
        });
      } catch {
        Alert.alert(
          "Export",
          "Share is not available on this device (e.g. simulator). Use a real device to export or share your data.",
        );
      }
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export data.");
    }
  };

  const isDark = useColorScheme() === "dark";
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
  return (
    <View
      className="flex-1"
      style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          transform: [{ translateY: headerY }],
        }}
      >
        <AppHeader subtitle="Preferences and privacy" rightLabel="Open profile" />
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 24 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
      <View className="px-4 pt-2">
      {!isPro ? (
        <Pressable onPress={() => showPaywall()}>
          <Card className="mb-4" style={{ borderWidth: 2, borderColor: THEME.primary }}>
            <CardContent className="flex-row items-center gap-3 py-4">
              <Crown size={24} color={THEME.primary} />
              <View style={{ flex: 1 }}>
                <RNText style={[{ fontSize: 16, fontWeight: "700" }, textWhite]}>
                  Upgrade to FoodScan Pro
                </RNText>
                <Text className="text-sm text-muted-foreground" style={textMuted}>
                  Unlimited scans, AI assistant, full analysis
                </Text>
              </View>
              <RNText style={{ fontSize: 20, color: THEME.primary }}>→</RNText>
            </CardContent>
          </Card>
        </Pressable>
      ) : (
        <Card className="mb-4" style={{ borderWidth: 2, borderColor: THEME.primary }}>
          <CardContent className="flex-row items-center gap-3 py-4">
            <Crown size={24} color={THEME.primary} />
            <View style={{ flex: 1 }}>
              <RNText style={[{ fontSize: 16, fontWeight: "700" }, textWhite]}>
                FoodScan Pro
              </RNText>
              <Text className="text-sm text-muted-foreground" style={textMuted}>
                You have full access to all features
              </Text>
            </View>
          </CardContent>
        </Card>
      )}

      <Pressable
        onPress={() => router.push("/paywall-test")}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: THEME.primary + "66",
          backgroundColor: THEME.primary + "11",
          alignSelf: "flex-start",
        })}
      >
        <RNText style={[{ fontSize: 14, fontWeight: "600" }, { color: THEME.primary }]}>
          Test paywall
        </RNText>
      </Pressable>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <CardTitle style={textWhite}>Units</CardTitle>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Choose metric (g, mg, kcal) or imperial for nutrition display.
          </Text>
        </CardHeader>
        <CardContent className="pt-0">
          <SegmentedControl
            options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]}
            value={displayUnits}
            onValueChange={handleSetUnits}
            isDark={isDark}
            unselectedTextStyle={textWhite}
          />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <CardTitle style={textWhite}>Dark mode</CardTitle>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Use system setting, or force light or dark.
          </Text>
        </CardHeader>
        <CardContent className="pt-0">
          <SegmentedControl
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={colorScheme}
            onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
            isDark={isDark}
            unselectedTextStyle={textWhite}
          />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <RNText
            key={`title-${displaySize}`}
            allowFontScaling={false}
            style={{
              color: isDark ? "#ffffff" : "#18181b",
              fontSize: titleSize,
              fontWeight: "600",
            }}
          >
            Text size
          </RNText>
          <RNText
            key={`desc-${displaySize}`}
            allowFontScaling={false}
            style={{
              color: isDark ? "#a1a1aa" : "#71717a",
              fontSize: bodySize,
              marginTop: 4,
            }}
          >
            Larger text for readability (applies where supported).
          </RNText>
        </CardHeader>
        <CardContent className="pt-0">
          <SegmentedControl
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
            value={displaySize}
            onValueChange={(v) => handleSetFontSize(v as "small" | "medium" | "large")}
            isDark={isDark}
            unselectedTextStyle={isDark ? { color: "#e5e5e5" } : { color: "#18181b" }}
          />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <CardTitle style={textWhite}>Data</CardTitle>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Export a summary of your profile and settings (no scan data). For full backup, use your device backup.
          </Text>
        </CardHeader>
        <CardContent className="pt-0">
          <Button variant="outline" onPress={handleExport} className="min-h-[44px] rounded-xl">
            <Text style={textWhite}>Export my data</Text>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle style={textWhite}>About</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            FoodScan uses Open Food Facts for product data. Add your health profile for personalized insights.
          </Text>
          <Text className="mt-2 text-xs font-medium text-muted-foreground" style={textMuted}>
            Not medical advice. Always consult a healthcare provider for health decisions.
          </Text>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <CardTitle style={textWhite}>Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-muted-foreground" style={textMuted}>
            Your health profile and scan history are stored only on your device.
            We do not send your data to external servers for analysis. Product
            lookups use the public Open Food Facts API.
          </Text>
        </CardContent>
      </Card>
      </View>
      </Animated.ScrollView>
    </View>
  );
}
