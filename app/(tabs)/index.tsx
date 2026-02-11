import { useRouter } from "expo-router";
import * as React from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Animated,
  Appearance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text as RNText,
  useColorScheme,
  View,
} from "react-native";
import { useColorScheme as useNativeWindScheme } from "nativewind";
import { Camera, ChevronDown, List, PenLine, ScanBarcode } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { addToScanHistory, getHealthProfile, getScanHistory, getSettings } from "@/lib/storage";
import { useOnboarding } from "@/lib/use-settings";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getProductByBarcode } from "@/lib/open-food-facts";
import { analyzeProduct } from "@/lib/scoring";
import type { ScanResult } from "@/types/food";

const HEADER_HIDE_OFFSET = 140;

const BUTTON_HEIGHT = 50;
const LABEL_LINE_HEIGHT = 22;
const BUTTON_VERTICAL_PADDING = (BUTTON_HEIGHT - LABEL_LINE_HEIGHT) / 2;
const BUTTON_PADDING_TOP = BUTTON_VERTICAL_PADDING + 8;
const BUTTON_PADDING_BOTTOM = BUTTON_VERTICAL_PADDING - 8;

const styles = StyleSheet.create({
  homeButtonWrapper: {
    alignSelf: "stretch",
    height: BUTTON_HEIGHT,
    borderWidth: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  homeButtonPressable: {
    width: "100%",
    height: "100%",
    paddingTop: BUTTON_PADDING_TOP,
    paddingBottom: BUTTON_PADDING_BOTTOM,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  homeButtonChevronWrap: {
    flexShrink: 0,
    minWidth: 24,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonLabel: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign: "center",
    includeFontPadding: false,
  },
});

const EXAMPLES: Array<{ code: string; label: string }> = [
  { code: "3017620422003", label: "Nutella" },
  { code: "5449000000996", label: "Coca Cola" },
  { code: "8000500310427", label: "Nutella Mini" },
  { code: "3228857000852", label: "Kinder Bueno" },
];

function applyTheme(mode: "light" | "dark" | "system") {
  if (mode === "system") Appearance.setColorScheme(null);
  else Appearance.setColorScheme(mode);
}

export default function ScanScreen() {
  const router = useRouter();
  const { setColorScheme: setNativeWindScheme } = useNativeWindScheme();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  React.useEffect(() => {
    getSettings().then((s) => {
      setNativeWindScheme(s.colorScheme);
      applyTheme(s.colorScheme);
    });
  }, [setNativeWindScheme]);

  const { onboardingDone, dismissOnboarding, refresh: refreshOnboarding } = useOnboarding();
  const [profileExists, setProfileExists] = React.useState<boolean | null>(null);
  const [hasScannedBefore, setHasScannedBefore] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState<string>("Analyzing…");
  const [searchDropdownOpen, setSearchDropdownOpen] = React.useState(true);

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

  const load = React.useCallback(async () => {
    const [h, history] = await Promise.all([getHealthProfile(), getScanHistory()]);
    setProfileExists(!!h);
    setHasScannedBefore(history.length > 0);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      load();
      refreshOnboarding();
    }, [load, refreshOnboarding]),
  );

  const searchOptions = [
    { label: "Scan barcode", href: "/scanner" as const, icon: ScanBarcode },
    { label: "Scan food", href: "/photo" as const, icon: Camera },
    { label: "Describe food", href: "/label" as const, icon: PenLine },
    { label: "Search for foods", href: "/search" as const, icon: List },
  ] as const;

  const onSearchOption = (href: string) => {
    setSearchDropdownOpen(false);
    router.push(href as "/scanner" | "/photo" | "/label" | "/search");
  };

  const analyzeBarcode = async (barcode: string) => {
    if (busy) return;
    setBusy(true);
    setBusyLabel("Analyzing product…");
    try {
      const product = await getProductByBarcode(barcode);
      if (!product) return;
      const profile = await getHealthProfile();
      setProfileExists(!!profile);
      const analysis = analyzeProduct(profile, product);
      const result: ScanResult = {
        id: `${Date.now()}-${product.code}`,
        timestamp: Date.now(),
        source: "barcode",
        barcode,
        product,
        healthRisks: analysis.healthRisks,
        analysis,
      };
      await addToScanHistory(result);
      setHasScannedBefore(true);
      router.push(`/results/${result.id}`);
    } finally {
      setBusy(false);
    }
  };

  const isDark = colorScheme === "dark";
  const pageBg = isDark ? THEME.darkBg : THEME.bgLight;
  const textPrimary = isDark ? THEME.white : THEME.darkGrey;
  const textMuted = isDark ? "#a1a1aa" : THEME.mutedGrey;

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
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
        <AppHeader subtitle="Eat smarter, live better" />
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        style={{ backgroundColor: pageBg }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View className="flex-1 px-4 pt-6 pb-6" style={{ minHeight: 400 }}>
          {!onboardingDone && (
            <View className="mb-4">
              <OnboardingChecklist onDismiss={dismissOnboarding} isDark={isDark} />
            </View>
          )}

          {/* Large central icon */}
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 16,
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(22, 163, 74, 0.25)",
            }}
          >
            <ScanBarcode size={48} color={THEME.primary} strokeWidth={2.5} />
          </View>

          <RNText
            style={{
              marginTop: 28,
              color: textPrimary,
              fontSize: 26,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Discover What's Inside
          </RNText>
          <Text
            className="mt-2 text-center px-4"
            style={{ color: textMuted, fontSize: 15, lineHeight: 22, maxWidth: 320, alignSelf: "center" }}
          >
            Scan barcodes for health insights, ingredients, and recommendations.
          </Text>

          <View className="mt-10 w-full" style={{ alignSelf: "stretch" }}>
            <View style={[styles.homeButtonWrapper, { borderColor: THEME.darkGrey }]}>
              <Pressable
                onPress={() => setSearchDropdownOpen((open) => !open)}
                accessibilityLabel="Start scanning"
                role="button"
                style={({ pressed }) => [
                  styles.homeButtonPressable,
                  { paddingTop: 26, paddingBottom: 2 },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={[styles.homeButtonContent, { marginTop: 10 }]}>
                  <RNText style={[styles.homeButtonLabel, { color: textPrimary }]} numberOfLines={1}>
                    {searchDropdownOpen ? "Hide options" : "Start Scanning"}
                  </RNText>
                  <View style={styles.homeButtonChevronWrap} pointerEvents="none">
                    <ChevronDown
                      size={20}
                      color={isDark ? THEME.white : THEME.darkGrey}
                    />
                  </View>
                </View>
              </Pressable>
            </View>
            {searchDropdownOpen && (
              <View
                className="mt-3 w-full overflow-hidden border"
                style={{
                  alignSelf: "stretch",
                  borderRadius: 8,
                  borderColor: isDark ? THEME.borderDark : THEME.borderLight,
                  backgroundColor: isDark ? THEME.darkCard : THEME.white,
                }}
              >
                {searchOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <Button
                      key={opt.href}
                      variant="ghost"
                      onPress={() => onSearchOption(opt.href)}
                      className="flex-row items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 rounded-none"
                    >
                      <Icon size={20} color={THEME.primary} />
                      <Text className="text-base" style={{ color: textPrimary }}>
                        {opt.label}
                      </Text>
                    </Button>
                  );
                })}
              </View>
            )}
          </View>

          {hasScannedBefore === false ? (
            <View className="mt-8">
              <Text className="mb-3 text-center text-sm" style={{ color: textMuted }}>
                Try these example barcodes:
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {EXAMPLES.map((e) => (
                  <Button
                    key={e.code}
                    variant="outline"
                    onPress={() => analyzeBarcode(e.code)}
                    className="flex-1 min-w-[45%] rounded-2xl px-4 py-4"
                    style={{
                      backgroundColor: isDark ? THEME.darkCard : THEME.white,
                      borderColor: isDark ? THEME.borderDark : THEME.borderLight,
                    }}
                  >
                    <Text className="text-center font-semibold" style={{ color: textPrimary }}>
                      {e.code}
                    </Text>
                    <Text className="mt-1 text-center text-xs" style={{ color: textMuted }}>
                      {e.label}
                    </Text>
                  </Button>
                ))}
              </View>
            </View>
          ) : (
            <View className="mt-6 w-full" style={{ alignSelf: "stretch" }}>
              <View style={[styles.homeButtonWrapper, { borderColor: THEME.darkGrey }]}>
                <Pressable
                  onPress={() => router.push("/(tabs)/history")}
                  style={({ pressed }) => [
                    styles.homeButtonPressable,
                    { paddingTop: 26, paddingBottom: 2 },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <RNText
                    style={[styles.homeButtonLabel, { color: textPrimary, marginTop: 10 }]}
                    numberOfLines={1}
                  >
                    View Scan History
                  </RNText>
                </Pressable>
              </View>
              <Text className="mt-4 text-center text-sm" style={{ color: textMuted }}>
                Scan another product or use Start Scanning above.
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {busy && (
        <View className="absolute inset-0 z-30 items-center justify-center bg-black/40">
          <View
            className="rounded-2xl px-6 py-5"
            style={{ backgroundColor: isDark ? THEME.darkCard : THEME.cardLight }}
          >
            <ActivityIndicator />
            <Text className="mt-2 text-center" style={{ color: textPrimary }}>
              {busyLabel}
            </Text>
            {profileExists === false && (
              <Text className="mt-1 text-center text-xs" style={{ color: textMuted }}>
                Generic advice shown until you create a profile.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
