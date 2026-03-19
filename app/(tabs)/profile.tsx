import * as React from "react";
import {
  ActivityIndicator,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text as RNText,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagSection } from "@/components/tag-section";
import { Text } from "@/components/ui/text";
import {
  getHealthProfile,
  hasMinimumProfile,
  setHealthProfile,
} from "@/lib/storage";
import { useFontSize } from "@/lib/use-settings";
import { ExpandableSection } from "@/components/expandable-section";
import { Input } from "@/components/ui/input";
import type { ActivityLevel, AgeRange, HealthProfile } from "@/types/food";
import { EMPTY_HEALTH_PROFILE } from "@/types/food";
import { CountryDropdown } from "@/components/country-dropdown";
import { COUNTRY_OPTIONS } from "@/data/countries";
import { THEME } from "@/lib/theme";

const AGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: "under-18", label: "Under 18" },
  { value: "18-30", label: "18–30" },
  { value: "31-50", label: "31–50" },
  { value: "51-64", label: "51–64" },
  { value: "65-plus", label: "65+" },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very-active", label: "Very active" },
];

// Use a large offset so the header always moves fully off-screen (AppHeader height varies).
const HEADER_HIDE_OFFSET = 140;

const textWhite = { color: "#ffffff" as const };
const textMuted = { color: "#a1a1aa" as const };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const headerHeight = React.useMemo(
    () => insets.top + 54,
    [insets.top],
  );
  const headerY = React.useRef(new Animated.Value(0)).current;
  const lastScrollY = React.useRef(0);
  const headerVisible = React.useRef(true);

  const [profile, setProfile] = React.useState<HealthProfile>(EMPTY_HEALTH_PROFILE);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getHealthProfile().then((p) => {
      if (mounted && p) setProfile(p);
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await setHealthProfile(profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasMinimum = hasMinimumProfile(profile);
  const { titleSize } = useFontSize();

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : undefined} />
      </View>
    );
  }

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
          subtitle="Set up your health profile for personalized insights"
          rightLabel="Open settings"
          rightHref="/(tabs)/settings"
        />
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        style={{ backgroundColor: isDark ? THEME.darkBg : THEME.bgLight }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          width: "100%",
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View className="pt-0">
          <Card className="mb-3">
            <CardHeader>
              <RNText style={[isDark ? textWhite : undefined, { fontSize: titleSize, fontWeight: "600" }]}>My Health</RNText>
              <Text className="text-sm text-muted-foreground" style={isDark ? textMuted : undefined}>
                Add at least one of: allergies, conditions, or goals so we can give you personalized
                food insights.
              </Text>
            </CardHeader>
            <CardContent className="gap-6">
              <TagSection
                label="Conditions"
                value={profile.conditions}
                onChange={(v) => setProfile((p) => ({ ...p, conditions: v }))}
                placeholder="e.g. diabetes, IBS, GERD, gout, PCOS, celiac"
                isDark={isDark}
              />
              <TagSection
                label="Allergies"
                value={profile.allergies}
                onChange={(v) => setProfile((p) => ({ ...p, allergies: v }))}
                placeholder="e.g. nuts, dairy, sesame, shellfish, eggs, soy"
                isDark={isDark}
              />
              <TagSection
                label="Dietary preferences"
                value={profile.dietaryPreferences}
                onChange={(v) => setProfile((p) => ({ ...p, dietaryPreferences: v }))}
                placeholder="e.g. vegan, keto, halal, paleo, low FODMAP"
                isDark={isDark}
              />
              <TagSection
                label="Medications (optional)"
                value={profile.medications ?? []}
                onChange={(v) => setProfile((p) => ({ ...p, medications: v }))}
                placeholder="e.g. warfarin, statins, metformin, MAOI"
                optional
                isDark={isDark}
              />
              <TagSection
                label="Goals"
                value={profile.goals}
                onChange={(v) => setProfile((p) => ({ ...p, goals: v }))}
                placeholder="e.g. weight loss, heart health, gut health, anti-inflammatory"
                isDark={isDark}
              />
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardHeader>
              <CardTitle style={isDark ? textWhite : undefined}>About you & goals</CardTitle>
              <Text className="text-sm text-muted-foreground" style={isDark ? textMuted : undefined}>
                Optional. Helps tailor advice (e.g. sodium for age, calories for activity).
              </Text>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground" style={isDark ? textWhite : undefined}>Country or region</Text>
                <Text className="text-xs text-muted-foreground" style={isDark ? textMuted : undefined}>
                  Where you&apos;re from — we&apos;ll show the most common brands for your area.
                </Text>
                <CountryDropdown
                  value={profile.countryCode}
                  options={COUNTRY_OPTIONS}
                  onSelect={(value) => setProfile((p) => ({ ...p, countryCode: value }))}
                  isDark={isDark}
                />
              </View>
              <ExpandableSection title="Age & activity" defaultOpen={false} isDark={isDark}>
                <View className="gap-3">
                  <Text className="text-sm text-muted-foreground" style={isDark ? textMuted : undefined}>Age range</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {AGE_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setProfile((p) => ({ ...p, ageRange: opt.value }))}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: profile.ageRange === opt.value ? "#16a34a" : isDark ? "#333" : "#e5e7eb",
                          backgroundColor: profile.ageRange === opt.value ? "rgba(34,197,94,0.1)" : isDark ? "#1a1a1a" : "#f8fafc",
                        }}
                      >
                        <Text className="text-sm" style={{ color: profile.ageRange === opt.value ? "#16a34a" : isDark ? "#e5e5e5" : "#18181b" }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="text-sm text-muted-foreground mt-1" style={isDark ? textMuted : undefined}>Activity level</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setProfile((p) => ({ ...p, activityLevel: opt.value }))}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: profile.activityLevel === opt.value ? "#16a34a" : isDark ? "#333" : "#e5e7eb",
                          backgroundColor: profile.activityLevel === opt.value ? "rgba(34,197,94,0.1)" : isDark ? "#1a1a1a" : "#f8fafc",
                        }}
                      >
                        <Text className="text-sm" style={{ color: profile.activityLevel === opt.value ? "#16a34a" : isDark ? "#e5e5e5" : "#18181b" }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ExpandableSection>
              <ExpandableSection title="Daily goals (optional)" defaultOpen={false} isDark={isDark}>
                <View className="gap-2">
                  <Text className="text-sm text-muted-foreground" style={isDark ? textMuted : undefined}>Max sodium (mg/day)</Text>
                  <Input
                    value={profile.nutrientGoals?.sodiumMgMax != null ? String(profile.nutrientGoals.sodiumMgMax) : ""}
                    onChangeText={(t) => {
                      const n = parseInt(t, 10);
                      setProfile((p) => ({
                        ...p,
                        nutrientGoals: { ...p.nutrientGoals, sodiumMgMax: Number.isFinite(n) ? n : undefined },
                      }));
                    }}
                    placeholder="e.g. 2300"
                    keyboardType="number-pad"
                  />
                  <Text className="text-sm text-muted-foreground mt-2" style={isDark ? textMuted : undefined}>Max sugar (g/day)</Text>
                  <Input
                    value={profile.nutrientGoals?.sugarGMax != null ? String(profile.nutrientGoals.sugarGMax) : ""}
                    onChangeText={(t) => {
                      const n = parseInt(t, 10);
                      setProfile((p) => ({
                        ...p,
                        nutrientGoals: { ...p.nutrientGoals, sugarGMax: Number.isFinite(n) ? n : undefined },
                      }));
                    }}
                    placeholder="e.g. 50"
                    keyboardType="number-pad"
                  />
                </View>
              </ExpandableSection>
            </CardContent>
          </Card>

          <View className="mt-4 pt-4">
            <Button
              onPress={handleSave}
              disabled={saving}
              className="w-full bg-[#16a34a]"
              style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : saved ? (
                <Text className="text-white">Saved</Text>
              ) : (
                <Text className="text-white">Save profile</Text>
              )}
            </Button>
            {hasMinimum && (
              <Text className="mt-2 text-center text-sm text-muted-foreground" style={isDark ? textMuted : undefined}>
                Profile is complete. You can now get personalized insights.
              </Text>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
