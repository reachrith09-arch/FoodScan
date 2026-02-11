import * as React from "react";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { getHealthProfile, getScanHistory, hasMinimumProfile } from "@/lib/storage";

type Props = {
  onDismiss: () => void;
  isDark: boolean;
};

export function OnboardingChecklist({ onDismiss, isDark }: Props) {
  const router = useRouter();
  const [profileDone, setProfileDone] = React.useState(false);
  const [scanDone, setScanDone] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([getHealthProfile(), getScanHistory()]).then(([profile, history]) => {
      if (mounted) {
        setProfileDone(hasMinimumProfile(profile));
        setScanDone((history?.length ?? 0) > 0);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;
  const iconColor = isDark ? "#a1a1aa" : "#71717a";

  return (
    <Card className="mb-3 overflow-hidden" style={isDark ? { backgroundColor: "#1a1a1a", borderColor: "#333" } : undefined}>
      <CardContent className="pt-4 pb-3">
        <Text className="mb-3 text-sm font-medium text-foreground" style={textWhite}>
          Quick start
        </Text>
        <View className="gap-1">
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            className="flex-row items-center justify-between py-2"
          >
            <View className="flex-row items-center gap-2">
              {profileDone ? (
                <CheckCircle2 size={20} color="#22c55e" />
              ) : (
                <Circle size={20} color={iconColor} />
              )}
              <Text className="text-sm text-foreground" style={textWhite}>
                Complete your profile
              </Text>
            </View>
            <ChevronRight size={18} color={iconColor} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/scanner")}
            className="flex-row items-center justify-between py-2"
          >
            <View className="flex-row items-center gap-2">
              {scanDone ? (
                <CheckCircle2 size={20} color="#22c55e" />
              ) : (
                <Circle size={20} color={iconColor} />
              )}
              <Text className="text-sm text-foreground" style={textWhite}>
                Do your first scan
              </Text>
            </View>
            <ChevronRight size={18} color={iconColor} />
          </Pressable>
        </View>
        <Pressable
          onPress={onDismiss}
          className="mt-3 items-center justify-center rounded-md border border-border py-2"
          style={isDark ? { borderColor: "#525252" } : undefined}
        >
          <Text className="text-sm font-medium text-muted-foreground" style={textMuted}>
            Got it
          </Text>
        </Pressable>
      </CardContent>
    </Card>
  );
}
