import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Camera, Crown, List, PenLine, ScanBarcode } from "lucide-react-native";
import { useColorScheme as useNativeWindScheme } from "nativewind";
import * as React from "react";
import {
  ActivityIndicator,
  Animated,
  Appearance,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text as RNText,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddFoodDropdown } from "@/components/add-food-dropdown";
import { AppHeader } from "@/components/app-header";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { getProductByBarcode } from "@/lib/open-food-facts";
import { FREE_DAILY_SCANS, useSubscription } from "@/lib/revenuecat";
import { analyzeProduct } from "@/lib/scoring";
import {
  addToScanHistory,
  getHealthProfile,
  getScanHistory,
  getSettings,
} from "@/lib/storage";
import { THEME } from "@/lib/theme";
import { useOnboarding } from "@/lib/use-settings";
import type { ScanResult } from "@/types/food";

const HEADER_HIDE_OFFSET = 140;

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
  const { width: winW } = useWindowDimensions();
  /** Avoid 0-width first frame; use window (not screen) so width matches the scroll view. */
  const windowW = Dimensions.get("window").width;
  const screenW = Math.max(winW || 0, windowW || 0, 360);
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const padLeft = Math.max(insets.left, 12);
  const padRight = Math.max(insets.right, 12);
  const contentWidth = Math.max(1, screenW - padLeft - padRight);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);
  const {
    freeScansRemaining,
    isPro,
    recordScan,
    showPaywall,
    refresh: refreshSub,
  } = useSubscription();

  React.useEffect(() => {
    getSettings().then((s) => {
      setNativeWindScheme(s.colorScheme);
      applyTheme(s.colorScheme);
    });
  }, [setNativeWindScheme]);

  const {
    onboardingDone,
    dismissOnboarding,
    refresh: refreshOnboarding,
  } = useOnboarding();
  const [profileExists, setProfileExists] = React.useState<boolean | null>(
    null,
  );
  const [hasScannedBefore, setHasScannedBefore] = React.useState<
    boolean | null
  >(null);
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState<string>("Analyzing…");
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
    const [h, history] = await Promise.all([
      getHealthProfile(),
      getScanHistory(),
    ]);
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
      refreshSub();
    }, [load, refreshOnboarding, refreshSub]),
  );

  const searchOptions = [
    { label: "Scan barcode", href: "/scanner" as const, icon: ScanBarcode },
    { label: "Scan food", href: "/photo" as const, icon: Camera },
    { label: "Describe food", href: "/label" as const, icon: PenLine },
    { label: "Search foods", href: "/search" as const, icon: List },
  ] as const;

  const onSearchOption = async (href: string) => {
    if (href === "/search") {
      router.push(href);
      return;
    }
    const allowed = await recordScan();
    if (!allowed) {
      await showPaywall();
      return;
    }
    router.push(href as "/scanner" | "/photo" | "/label" | "/search");
  };

  const analyzeBarcode = async (barcode: string) => {
    if (busy) return;
    const allowed = await recordScan();
    if (!allowed) {
      await showPaywall();
      return;
    }
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
  const heroIconBorder = isDark ? THEME.borderDark : THEME.borderLight;
  const heroIconBg = isDark ? "rgba(34, 197, 94, 0.12)" : THEME.primaryLight;
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

      <ScrollView
        style={{ flex: 1, backgroundColor: pageBg }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: Math.max(insets.bottom, 12) + 16,
          width: screenW,
          flexGrow: 1,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View
          style={{
            width: screenW,
            paddingLeft: padLeft,
            paddingRight: padRight,
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          <View>
            {!onboardingDone && (
              <View className="mb-4">
                <OnboardingChecklist
                  onDismiss={dismissOnboarding}
                  isDark={isDark}
                />
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
                backgroundColor: heroIconBg,
                borderWidth: 1,
                borderColor: heroIconBorder,
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
              className="mt-2 text-center"
              style={{
                color: textMuted,
                fontSize: 15,
                lineHeight: 22,
                alignSelf: "center",
                paddingHorizontal: 4,
              }}
            >
              Barcode, photo, description, or search — same health insights
              everywhere.
            </Text>

            {!isPro && (
              <Pressable
                onPress={() => showPaywall()}
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "center",
                  gap: 6,
                  backgroundColor:
                    freeScansRemaining <= 1
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(34,197,94,0.1)",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor:
                    freeScansRemaining <= 1
                      ? "rgba(239,68,68,0.3)"
                      : "rgba(34,197,94,0.3)",
                }}
              >
                <Crown
                  size={14}
                  color={freeScansRemaining <= 1 ? "#ef4444" : THEME.primary}
                />
                <RNText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: freeScansRemaining <= 1 ? "#ef4444" : THEME.primary,
                  }}
                >
                  {freeScansRemaining}/{FREE_DAILY_SCANS} free scans left today
                </RNText>
              </Pressable>
            )}
          </View>

          <View style={{ width: contentWidth, marginTop: 28 }}>
            <RNText
              style={{
                color: textMuted,
                fontSize: 13,
                fontWeight: "600",
                letterSpacing: 0.4,
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 14,
                width: contentWidth,
              }}
            >
              Add a food
            </RNText>
            <AddFoodDropdown
              options={searchOptions}
              onPick={(href) => void onSearchOption(href)}
              isDark={isDark}
              width={contentWidth}
            />
          </View>

          {hasScannedBefore === false ? (
            <View className="mt-8">
              <Text
                className="mb-3 text-center text-sm"
                style={{ color: textMuted }}
              >
                Try these example barcodes:
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {EXAMPLES.map((e) => (
                  <Button
                    key={e.code}
                    variant="outline"
                    onPress={() => analyzeBarcode(e.code)}
                    className="min-w-[45%] flex-1 rounded-2xl px-4 py-4"
                    style={{
                      backgroundColor: isDark ? THEME.darkCard : THEME.white,
                      borderColor: isDark
                        ? THEME.borderDark
                        : THEME.borderLight,
                    }}
                  >
                    <Text
                      className="text-center font-semibold"
                      style={{ color: textPrimary }}
                    >
                      {e.code}
                    </Text>
                    <Text
                      className="mt-1 text-center text-xs"
                      style={{ color: textMuted }}
                    >
                      {e.label}
                    </Text>
                  </Button>
                ))}
              </View>
            </View>
          ) : (
            <Text
              className="mt-8 text-center text-sm"
              style={{ color: textMuted }}
            >
              Scan another product or tap an option above.
            </Text>
          )}
        </View>
      </ScrollView>

      {busy && (
        <View className="absolute inset-0 z-30 items-center justify-center bg-black/40">
          <View
            className="rounded-2xl px-6 py-5"
            style={{
              backgroundColor: isDark ? THEME.darkCard : THEME.cardLight,
            }}
          >
            <ActivityIndicator />
            <Text className="mt-2 text-center" style={{ color: textPrimary }}>
              {busyLabel}
            </Text>
            {profileExists === false && (
              <Text
                className="mt-1 text-center text-xs"
                style={{ color: textMuted }}
              >
                Generic advice shown until you create a profile.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
