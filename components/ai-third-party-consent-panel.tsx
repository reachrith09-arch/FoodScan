import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";

const OPENAI_PRIVACY = "https://openai.com/policies/privacy-policy";

export type AiConsentVariant = "assistant" | "meal_vision";

export function AiThirdPartyConsentPanel(props: {
  variant: AiConsentVariant;
  isDark: boolean;
  onAgree: () => void | Promise<void>;
  onDecline: () => void;
  busy?: boolean;
}) {
  const { variant, isDark, onAgree, onDecline, busy } = props;
  const textMain = isDark ? "#fafafa" : "#18181b";
  const textMuted = isDark ? "#a1a1aa" : "#52525b";
  const cardBg = isDark ? "#1c1c1e" : "#ffffff";
  const borderColor = isDark ? "#3f3f46" : "#e4e4e7";

  const what =
    variant === "meal_vision"
      ? "What we send: your meal photo for vision analysis."
      : "What we send: your messages, recent chat, and context from this scan (product details, scores, and optional health profile or reaction notes when relevant).";

  const who =
    "Who receives it: OpenAI, LLC (United States). Data may go to OpenAI directly from this app and/or through our Supabase-hosted backend first, depending on your app configuration.";

  const policy =
    "Exact endpoints, other subprocessors (including web search where used), retention, and legal bases are described in FoodScan's privacy policy on the App Store.";

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: textMain }}>
        {variant === "meal_vision" ? "Meal photo & AI" : "Sprout & AI"}
      </Text>

      <View
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 21, color: textMain }}>
          • {what}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: textMain }}>
          • {who}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: textMuted }}>
          • {policy}
        </Text>
      </View>

      <Text
        style={{
          marginTop: 14,
          fontSize: 13,
          lineHeight: 20,
          color: textMuted,
        }}
      >
        If you do not agree, we will not send your data for this feature. You
        can withdraw consent in Settings; you will be asked again before the
        next send.
      </Text>

      <Pressable
        onPress={() => void Linking.openURL(OPENAI_PRIVACY)}
        style={{ marginTop: 12, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 14, color: "#2563eb", fontWeight: "600" }}>
          {`OpenAI privacy policy \u2197`}
        </Text>
      </Pressable>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          onPress={() => void Promise.resolve(onAgree())}
          disabled={busy}
          className="min-h-[48px] rounded-xl"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-primary-foreground">
              Agree and continue
            </Text>
          )}
        </Button>
        <Button
          variant="outline"
          onPress={onDecline}
          disabled={busy}
          className="min-h-[48px] rounded-xl"
        >
          <Text className="font-medium text-foreground">Not now</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
