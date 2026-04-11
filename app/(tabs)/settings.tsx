import { useFocusEffect } from "@react-navigation/native";
import { Crown } from "lucide-react-native";
import { useColorScheme as useNativeWindScheme } from "nativewind";
import * as React from "react";
import {
  Alert,
  Animated,
  Appearance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text as RNText,
  Share,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { HealthInformationSources } from "@/components/health-information-sources";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import {
  clearAiThirdPartySharingConsent,
  isCloudFoodAssistantAvailable,
} from "@/lib/ai-third-party-consent";
import { isFoodRecognitionAvailable } from "@/lib/recognize-food";
import { useSubscription } from "@/lib/revenuecat";
import { exportUserData, getSettings, setSettings } from "@/lib/storage";
import { THEME } from "@/lib/theme";
import {
  BODY_SIZES,
  TITLE_SIZES,
  useFontSize,
  useUnits,
} from "@/lib/use-settings";

const HEADER_HIDE_OFFSET = 140;

export default function SettingsScreen() {
  const { isPro, showPaywall } = useSubscription();
  const { setColorScheme: setNativeWindScheme } = useNativeWindScheme();
  const insets = useSafeAreaInsets();
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  const { units, setUnits } = useUnits();
  const [colorScheme, setColorScheme] = React.useState<
    "light" | "dark" | "system"
  >("system");
  const { fontSize, setFontSize } = useFontSize();
  // Local copy so this screen updates immediately when user taps (no wait for context)
  const [displaySize, setDisplaySize] = React.useState(fontSize);
  const [displayUnits, setDisplayUnits] = React.useState<"metric" | "imperial">(
    units,
  );
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
      const message = await exportUserData();
      try {
        await Share.share({
          message,
          title: "FoodScan data export",
        });
      } catch {
        Alert.alert(
          "Export",
          "Share is not available on this device (e.g. simulator). Use a real device to export or share your data.",
        );
      }
    } catch (e) {
      Alert.alert(
        "Export failed",
        e instanceof Error ? e.message : "Could not export data.",
      );
    }
  };

  const aiFeaturesConfigured =
    isCloudFoodAssistantAvailable() || isFoodRecognitionAvailable();

  const handleResetAiConsent = () => {
    Alert.alert(
      "Reset AI sharing permission?",
      "Next time you use Sprout or meal photo analysis, you will be asked again before any data is sent to AI services.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void clearAiThirdPartySharingConsent();
          },
        },
      ],
    );
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
        <AppHeader
          subtitle="Preferences and privacy"
          rightLabel="Open profile"
        />
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 pt-2">
          {!isPro ? (
            <Pressable onPress={() => showPaywall()}>
              <Card
                className="mb-4"
                style={{ borderWidth: 2, borderColor: THEME.primary }}
              >
                <CardContent className="flex-row items-center gap-3 py-4">
                  <Crown size={24} color={THEME.primary} />
                  <View style={{ flex: 1 }}>
                    <RNText
                      style={[{ fontSize: 16, fontWeight: "700" }, textWhite]}
                    >
                      Upgrade to FoodScan Pro
                    </RNText>
                    <Text
                      className="text-muted-foreground text-sm"
                      style={textMuted}
                    >
                      Unlimited scans, AI assistant, full analysis
                    </Text>
                  </View>
                  <RNText style={{ fontSize: 20, color: THEME.primary }}>
                    →
                  </RNText>
                </CardContent>
              </Card>
            </Pressable>
          ) : (
            <Card
              className="mb-4"
              style={{ borderWidth: 2, borderColor: THEME.primary }}
            >
              <CardContent className="flex-row items-center gap-3 py-4">
                <Crown size={24} color={THEME.primary} />
                <View style={{ flex: 1 }}>
                  <RNText
                    style={[{ fontSize: 16, fontWeight: "700" }, textWhite]}
                  >
                    FoodScan Pro
                  </RNText>
                  <Text
                    className="text-muted-foreground text-sm"
                    style={textMuted}
                  >
                    You have full access to all features
                  </Text>
                </View>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader className="pb-1">
              <CardTitle style={textWhite}>Units</CardTitle>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Choose metric (g, mg, kcal) or imperial for nutrition display.
              </Text>
            </CardHeader>
            <CardContent className="pt-0">
              <SegmentedControl
                options={[
                  { value: "metric", label: "Metric" },
                  { value: "imperial", label: "Imperial" },
                ]}
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
              <Text className="text-muted-foreground text-sm" style={textMuted}>
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
                onValueChange={(v) =>
                  setTheme(v as "light" | "dark" | "system")
                }
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
                onValueChange={(v) =>
                  handleSetFontSize(v as "small" | "medium" | "large")
                }
                isDark={isDark}
                unselectedTextStyle={
                  isDark ? { color: "#e5e5e5" } : { color: "#18181b" }
                }
              />
            </CardContent>
          </Card>

          {aiFeaturesConfigured ? (
            <Card className="mb-4">
              <CardHeader className="pb-1">
                <CardTitle style={textWhite}>Third-party AI</CardTitle>
                <Text
                  className="text-muted-foreground text-sm"
                  style={textMuted}
                >
                  Sprout and meal photo AI send data to third parties only after
                  you agree on the consent screen. Exact URLs, categories of
                  data, and subprocessors are in our privacy policy. Reset here
                  to be asked again before the next send.
                </Text>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  onPress={handleResetAiConsent}
                  className="min-h-[44px] rounded-xl"
                >
                  <Text style={textWhite}>Reset AI sharing permission</Text>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="mb-4">
            <CardHeader className="pb-1">
              <CardTitle style={textWhite}>Data</CardTitle>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Share a short, readable summary of your profile and activity (no
                raw data file). For full backup, use your device backup.
              </Text>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                onPress={handleExport}
                className="min-h-[44px] rounded-xl"
              >
                <Text style={textWhite}>Export my data</Text>
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle style={textWhite}>About</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                FoodScan uses Open Food Facts for product data. Add your health
                profile for personalized insights.
              </Text>
              <Text
                className="mt-2 font-medium text-muted-foreground text-xs"
                style={textMuted}
              >
                Not medical advice. Always consult a healthcare provider for
                health decisions.
              </Text>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader className="pb-1">
              <CardTitle style={textWhite}>
                Health information sources
              </CardTitle>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Expand below for how we calculate health scores and links to
                official sources (opens in your browser).
              </Text>
            </CardHeader>
            <CardContent className="pt-0">
              <HealthInformationSources isDark={isDark} />
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader className="pb-1">
              <CardTitle style={textWhite}>Privacy & data</CardTitle>
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Short summary. The privacy policy linked on the App Store lists
                every service, URL, data category, and purpose in full.
              </Text>
            </CardHeader>
            <CardContent className="gap-3">
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Most data (profile, scans, reactions, settings) stays on your
                device. Product lookups use Open Food Facts. Pro subscriptions
                use RevenueCat.
              </Text>
              {aiFeaturesConfigured ? (
                <Text
                  className="text-muted-foreground text-sm"
                  style={textMuted}
                >
                  Optional AI (Sprout, meal photo) sends data to OpenAI and may
                  route through our Supabase project—only after you consent.
                </Text>
              ) : null}
              <Text className="text-muted-foreground text-sm" style={textMuted}>
                Some builds also use our backend to search the web for missing
                products (third-party search + AI). Export and Share send only
                what you choose.
              </Text>
            </CardContent>
          </Card>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
