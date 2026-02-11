import * as React from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text as RNText,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { getDailySummary, getTodayKey, getLastNDaysSummaries, getWeeklyReportCard } from "@/lib/analytics";
import { Sparkline } from "@/components/graphics/sparkline";
import { getPatternHints } from "@/lib/reactions";
import { getPendingBarcodes } from "@/lib/offline";
import { syncPendingLookups } from "@/lib/offline-sync";
import { getHealthProfile, getScanHistory } from "@/lib/storage";
import { useFontSize } from "@/lib/use-settings";
import { Button } from "@/components/ui/button.native";
import { useRouter } from "expo-router";
import { THEME } from "@/lib/theme";

const HEADER_HIDE_OFFSET = 140;

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = React.useMemo(() => insets.top + 54, [insets.top]);
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  const [todayKey, setTodayKey] = React.useState(getTodayKey());
  const [loading, setLoading] = React.useState(true);
  const [today, setToday] = React.useState<Awaited<ReturnType<typeof getDailySummary>> | null>(null);
  const [last7, setLast7] = React.useState<Awaited<ReturnType<typeof getLastNDaysSummaries>>>([]);
  const [weekly, setWeekly] = React.useState<Awaited<ReturnType<typeof getWeeklyReportCard>> | null>(null);
  const [hints, setHints] = React.useState<Awaited<ReturnType<typeof getPatternHints>>>([]);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof getHealthProfile>>>(null);
  const [recentScanId, setRecentScanId] = React.useState<string | null>(null);

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
    setLoading(true);
    const key = getTodayKey();
    setTodayKey(key);
    const [t, s7, w, p, history] = await Promise.all([
      getDailySummary(key),
      getLastNDaysSummaries(7),
      getWeeklyReportCard(),
      getHealthProfile(),
      getScanHistory(),
    ]);
    setToday(t);
    setLast7(s7);
    setWeekly(w);
    setProfile(p);
    setRecentScanId(history[0]?.id ?? null);
    const h = await getPatternHints();
    setHints(h);
    const pending = await getPendingBarcodes();
    setPendingCount(pending.length);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const upfTrend = last7.map((d) => Math.round(d.ultraProcessedScoreAvg));

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { titleSize } = useFontSize();
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
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
        <AppHeader subtitle="Insights from your recent scans" />
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 24 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
      <View className="px-4 pt-2">
      <Card className="mb-3">
        <CardHeader>
          <RNText style={[textWhite, { fontSize: titleSize, fontWeight: "600" }]}>Daily totals</RNText>
          <Text className="text-sm text-muted-foreground" style={textMuted}>Date: {todayKey}</Text>
        </CardHeader>
        <CardContent className="gap-2">
          {today ? (
            <>
              <View className="flex-row flex-wrap gap-4">
                <View className="rounded-lg border border-border bg-muted/30 p-3">
                  <Text className="text-xs text-muted-foreground" style={textMuted}>Scans</Text>
                  <Text className="text-xl font-semibold text-foreground" style={textWhite}>{today.scansCount}</Text>
                </View>
                <View className="rounded-lg border border-border bg-muted/30 p-3">
                  <Text className="text-xs text-muted-foreground" style={textMuted}>Sodium (mg)</Text>
                  <Text className="text-xl font-semibold text-foreground" style={textWhite}>{Math.round(today.sodiumMgTotal)}</Text>
                </View>
                <View className="rounded-lg border border-border bg-muted/30 p-3">
                  <Text className="text-xs text-muted-foreground" style={textMuted}>Sugar (g)</Text>
                  <Text className="text-xl font-semibold text-foreground" style={textWhite}>{Math.round(Number(today.sugarGTotal) || 0)}</Text>
                </View>
                <View className="rounded-lg border border-border bg-muted/30 p-3">
                  <Text className="text-xs text-muted-foreground" style={textMuted}>Calories (kcal)</Text>
                  <Text className="text-xl font-semibold text-foreground" style={textWhite}>{Math.round(today.caloriesKcalTotal)}</Text>
                </View>
              </View>
              <View className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
                <Text className="text-xs text-muted-foreground" style={textMuted}>Ultra-processed exposure (avg)</Text>
                <Text className="text-xl font-semibold text-foreground" style={textWhite}>
                  {Math.round(today.ultraProcessedScoreAvg)} / 100
                </Text>
              </View>
              {profile?.nutrientGoals && (profile.nutrientGoals.sodiumMgMax != null || profile.nutrientGoals.sugarGMax != null || profile.nutrientGoals.caloriesKcalMax != null) && (
                <View className="mt-2 rounded-lg border border-border bg-muted/20 p-3">
                  <Text className="text-xs font-medium text-muted-foreground" style={textMuted}>Daily goals</Text>
                  {profile.nutrientGoals.sodiumMgMax != null && (
                    <Text className="mt-1 text-sm text-foreground" style={textWhite}>
                      Sodium: {Math.round(today.sodiumMgTotal)} / {profile.nutrientGoals.sodiumMgMax} mg
                    </Text>
                  )}
                  {profile.nutrientGoals.sugarGMax != null && (
                    <Text className="mt-0.5 text-sm text-foreground" style={textWhite}>
                      Sugar: {Math.round(Number(today.sugarGTotal) || 0)} / {profile.nutrientGoals.sugarGMax} g
                    </Text>
                  )}
                  {profile.nutrientGoals.caloriesKcalMax != null && (
                    <Text className="mt-0.5 text-sm text-foreground" style={textWhite}>
                      Calories: {Math.round(today.caloriesKcalTotal)} / {profile.nutrientGoals.caloriesKcalMax} kcal
                    </Text>
                  )}
                </View>
              )}
              {(today.criticalAlertsCount > 0 || today.warningAlertsCount > 0) && (
                <View className="mt-2 rounded-lg border border-warning bg-warning/10 p-3">
                  <Text className="font-medium text-foreground" style={textWhite}>Alerts today</Text>
                  <Text className="text-sm text-muted-foreground" style={textMuted}>
                    Critical: {today.criticalAlertsCount} · Warnings: {today.warningAlertsCount}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text className="text-muted-foreground" style={textMuted}>{loading ? "Loading..." : "No data yet."}</Text>
          )}
        </CardContent>
      </Card>

      {pendingCount > 0 && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle style={textWhite}>Offline pending lookups</CardTitle>
            <Text className="text-sm text-muted-foreground" style={textMuted}>
              You have {pendingCount} scanned barcodes waiting to be resolved when online.
            </Text>
          </CardHeader>
          <CardContent>
            <Button
              onPress={async () => {
                setSyncing(true);
                await syncPendingLookups();
                const pending = await getPendingBarcodes();
                setPendingCount(pending.length);
                setSyncing(false);
              }}
              disabled={syncing}
              style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}
            >
              <Text className="text-primary-foreground">
                {syncing ? "Syncing…" : "Sync now"}
              </Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {(last7.length >= 2 || hints.length > 0) && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle style={textWhite}>Insight</CardTitle>
            <Text className="text-sm text-muted-foreground" style={textMuted}>
              {last7.length >= 2 && last7[0]?.ultraProcessedScoreAvg < (last7[1]?.ultraProcessedScoreAvg ?? 0)
                ? "UPF intensity is trending down this week — nice."
                : today && today.scansCount > 0
                  ? `${today.scansCount} scan${today.scansCount === 1 ? "" : "s"} today. Open a result to see healthier swaps.`
                  : hints.length > 0
                    ? "Reaction patterns can hint at ingredients to watch."
                    : "Scan more to see trends."}
            </Text>
          </CardHeader>
          {recentScanId && (
            <CardContent className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push(`/results/${recentScanId}`)}
                style={isDark ? { borderColor: "#525252" } : undefined}
              >
                <Text className="text-foreground" style={textWhite}>Open last scan → swaps</Text>
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="mb-3">
        <CardHeader>
          <CardTitle style={textWhite}>7-day trend</CardTitle>
          <Text className="text-sm text-muted-foreground" style={textMuted}>Ultra-processed intensity (lower is better)</Text>
        </CardHeader>
        <CardContent className="flex-row items-center justify-between">
          <View>
            <Text className="text-foreground" style={textWhite}>
              Avg UPF: {weekly ? weekly.avgUltraProcessed : 0}
            </Text>
            <Text className="text-xs text-muted-foreground" style={textMuted}>
              Scans: {weekly ? weekly.totalScans : 0} · Critical: {weekly ? weekly.totalCriticalAlerts : 0}
            </Text>
          </View>
          <Sparkline values={upfTrend.length ? upfTrend : [0, 0]} />
        </CardContent>
      </Card>

      {weekly && weekly.topAdditives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle style={textWhite}>Top additives this week</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {weekly.topAdditives.map((a) => (
              <View key={a.key} className="flex-row items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <Text className="text-foreground" style={textWhite}>{a.key}</Text>
                <Text className="text-sm text-muted-foreground" style={textMuted}>{a.count}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {hints.length > 0 && (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle style={textWhite}>Pattern hints (early learning)</CardTitle>
            <Text className="text-sm text-muted-foreground" style={textMuted}>
              Based on your reaction logs. Not proof—use as a clue.
            </Text>
          </CardHeader>
          <CardContent className="gap-2">
            {hints.map((h, i) => (
              <View key={`${h.label}-${i}`} className="rounded-lg border border-border bg-muted/30 p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-foreground" style={textWhite}>{h.label}</Text>
                  <Text className="text-xs text-muted-foreground" style={textMuted}>{h.count}</Text>
                </View>
                <Text className="mt-1 text-sm text-muted-foreground" style={textMuted}>{h.details}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
      </View>
      </Animated.ScrollView>
    </View>
  );
}

