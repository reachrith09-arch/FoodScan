import { useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  useColorScheme,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { Text } from "@/components/ui/text";
import { getScanHistory } from "@/lib/storage";
import { getWeeklyReportCard } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDisplayBrand, getDisplayProductName } from "@/lib/product-display";
import { THEME } from "@/lib/theme";
import type { ScanResult } from "@/types/food";

const HEADER_HIDE_OFFSET = 140;

const statBoxDark = {
  box: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: "#525252",
    borderLeftColor: THEME.primary,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
};
const statBoxLight = {
  box: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: THEME.borderLight,
    borderLeftColor: THEME.primary,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
};

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  const [history, setHistory] = React.useState<ScanResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [weekly, setWeekly] = React.useState<Awaited<ReturnType<typeof getWeeklyReportCard>> | null>(null);

  const LAST_SCANS_COUNT = 5;

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

  const load = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const [list, w] = await Promise.all([getScanHistory(), getWeeklyReportCard()]);
    setHistory(list.slice(0, LAST_SCANS_COUNT));
    setWeekly(w);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load(true);
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}>
        <ActivityIndicator size="large" color={isDark ? THEME.white : THEME.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}>
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
        <AppHeader subtitle="Scan history, trends, and report cards" />
      </Animated.View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: headerHeight, paddingBottom: insets.bottom + 24 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            {weekly && (
              <View className="pt-2">
                <Card
                  style={
                    isDark
                      ? {
                          borderWidth: 1,
                          borderColor: "#333",
                          backgroundColor: "#0a0a0a",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 3,
                          borderRadius: 16,
                        }
                      : {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.06,
                          shadowRadius: 8,
                          elevation: 3,
                        }
                  }
                >
                  <CardHeader>
                    <CardTitle style={isDark ? { color: "#ffffff" } : undefined}>Weekly report card</CardTitle>
                    <Text className="text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                      {weekly.weekStartDateKey} → {weekly.weekEndDateKey}
                    </Text>
                  </CardHeader>
                  <CardContent className="flex-row flex-wrap gap-3">
                    <View style={isDark ? statBoxDark.box : statBoxLight.box}>
                      <Text className="text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>Scans</Text>
                      <Text className="text-lg font-semibold text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>{weekly.totalScans}</Text>
                    </View>
                    <View style={isDark ? statBoxDark.box : statBoxLight.box}>
                      <Text className="text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>Avg score</Text>
                      <Text className="text-lg font-semibold text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>{weekly.avgOverallScore}</Text>
                    </View>
                    <View style={isDark ? statBoxDark.box : statBoxLight.box}>
                      <Text className="text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>Avg UPF</Text>
                      <Text className="text-lg font-semibold text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>{weekly.avgUltraProcessed}</Text>
                    </View>
                    <View style={isDark ? statBoxDark.box : statBoxLight.box}>
                      <Text className="text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>Critical</Text>
                      <Text className="text-lg font-semibold text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>{weekly.totalCriticalAlerts}</Text>
                    </View>
                  </CardContent>
                </Card>
              </View>
            )}
            {weekly && (
              <View className="pt-2 pb-1">
                <Text className="text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                  This week: {weekly.totalScans} scans · avg score {weekly.avgOverallScore}
                </Text>
              </View>
            )}
            <View className="pt-2 pb-2 flex-row items-center gap-2">
              <View
                style={{
                  backgroundColor: THEME.primary,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text className="text-xs font-semibold text-white">Last scanned</Text>
              </View>
              <Text className="text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                Last 5 scans
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const hasImage = !!(item.product.image_small_url || item.product.image_url);
          return (
          <Pressable
            onPress={() => router.push(`/results/${item.id}`)}
            className="mb-2 flex-row overflow-hidden rounded-xl border bg-card py-3 pl-0 pr-4"
            style={[
              isDark ? { borderWidth: 1, borderColor: "#333", backgroundColor: "#141414" } : { borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
              {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.2 : 0.04,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
          >
            {hasImage ? (
              <View className="mr-3 h-14 w-14 overflow-hidden rounded-xl bg-muted">
                <Image
                  source={{ uri: item.product.image_small_url ?? item.product.image_url ?? undefined }}
                  className="h-full w-full"
                  contentFit="cover"
                />
              </View>
            ) : (
              <View style={{ width: 62 }} />
            )}
            <View className="flex-1 min-w-0">
              <Text className="font-medium text-foreground" style={isDark ? { color: "#ffffff" } : undefined}>
                {getDisplayProductName(item.product)}
              </Text>
              <Text className="text-sm text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                {getDisplayBrand(item.product) ?? "Unknown"}
              </Text>
              {item.analysis && (
                <Text className="mt-1 text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                  Score: {item.analysis.overallScore} · UPF: {item.analysis.ultraProcessed.label.toUpperCase()}
                </Text>
              )}
              <Text className="mt-0.5 text-xs text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
                {new Date(item.timestamp).toLocaleDateString()}
                {item.mealType ? ` · ${item.mealType}` : ""}
              </Text>
            </View>
          </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="py-8">
            <Text className="text-center text-muted-foreground" style={isDark ? { color: "#a1a1aa" } : undefined}>
              No scans yet. Scan a barcode or search to get started.
            </Text>
          </View>
        }
      />
    </View>
  );
}
