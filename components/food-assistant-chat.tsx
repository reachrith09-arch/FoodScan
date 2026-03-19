import * as React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { Crown } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { useSubscription } from "@/lib/revenuecat";
import type { HealthProfile, ProductAnalysis, ProductResult } from "@/types/food";
import { answerFoodQuestion } from "@/lib/food-assistant";
import { getReactionSummaryForAdvice } from "@/lib/reactions";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function FoodAssistantChat(props: {
  visible: boolean;
  onClose: () => void;
  product?: ProductResult;
  analysis?: ProductAnalysis;
  profile?: HealthProfile | null;
}) {
  const isDark = useColorScheme() === "dark";
  const { canUseAssistant, showPaywall } = useSubscription();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const productKey = props.product?.code ?? "unknown";

  // Pick up to 5 real ingredients from the product to show as quick-ask chips
  const quickIngredients = React.useMemo(() => {
    const raw =
      props.product?.ingredients_text_en ??
      props.product?.ingredients_text ??
      "";
    if (!raw) return [];
    return raw
      .split(/[,;]+/)
      .map((s: string) => s.trim().replace(/^\s*[_\-•*]+\s*/, "").replace(/\s*\(.*?\)/g, "").trim())
      .filter((s: string) => s.length >= 3 && s.length <= 40 && !/^\d/.test(s))
      .slice(0, 6);
  }, [props.product]);

  const bg = isDark ? "#000000" : "#F3FBF7";
  const cardBg = isDark ? "#141414" : undefined;
  const borderColor = isDark ? "#333333" : undefined;
  const textWhite = isDark ? { color: "#ffffff" as const } : undefined;
  const textMuted = isDark ? { color: "#a1a1aa" as const } : undefined;

  React.useEffect(() => {
    if (!props.visible) return;
    // New product → reset chat.
    setDraft("");
    setMessages([
      {
        id: `m0-${productKey}`,
        role: "assistant",
        text:
          "Ask me about ingredients, additives, or nutrition.\n\nExamples:\n- What does … mean?\n- What are the ingredients?\n- What’s a healthier alternative?",
      },
    ]);
  }, [props.visible, productKey]);

  React.useEffect(() => {
    // Auto-scroll to bottom when messages change.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const send = async () => {
    const q = draft.trim();
    if (!q || sending) return;
    setDraft("");
    setSending(true);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: q,
    };
    const pendingId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      userMsg,
      { id: pendingId, role: "assistant", text: "Thinking…" },
    ]);
    try {
      let reactionSummary: string | undefined;
      try {
        reactionSummary = (await getReactionSummaryForAdvice()) || undefined;
      } catch {
        reactionSummary = undefined;
      }
      const a = await answerFoodQuestion({
        question: q,
        product: props.product,
        analysis: props.analysis,
        profile: props.profile ?? null,
        reactionSummary,
      });
      setMessages((m) =>
        m.map((msg) => (msg.id === pendingId ? { ...msg, text: a } : msg)),
      );
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                text: "Sorry — I couldn’t reach the assistant right now. Try again.",
              }
            : msg,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
      presentationStyle="pageSheet"
    >
      <View className="flex-1" style={{ backgroundColor: bg }}>
        <View
          className="border-b px-4 pb-3 pt-3"
          style={{ borderColor: borderColor ?? undefined, backgroundColor: cardBg }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-semibold text-foreground" style={textWhite}>
                Ask about this food
              </Text>
              <Text className="text-xs text-muted-foreground" style={textMuted}>
                Short, easy explanations. Not medical advice.
              </Text>
            </View>
            <Button variant="ghost" size="sm" onPress={props.onClose}>
              <Text className="text-foreground" style={textWhite}>Close</Text>
            </Button>
          </View>
        </View>

        {!canUseAssistant ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Crown size={48} color={THEME.primary} strokeWidth={2} />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: isDark ? "#fff" : "#111",
                marginTop: 24,
                textAlign: "center",
              }}
            >
              AI Assistant is a Pro feature
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: isDark ? "#a1a1aa" : "#6b7280",
                marginTop: 8,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Upgrade to FoodScan Pro for unlimited AI-powered food questions, full analysis, and more.
            </Text>
            <Pressable
              onPress={() => {
                props.onClose();
                setTimeout(() => showPaywall(), 300);
              }}
              style={{
                marginTop: 24,
                backgroundColor: THEME.primary,
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 12,
                ...THEME.shadowButton,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Unlock Pro
              </Text>
            </Pressable>
          </View>
        ) : (
        <>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: bg }}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              className="mb-3 max-w-[90%] rounded-2xl border px-4 py-3"
              style={[
                m.role === "user"
                  ? { alignSelf: "flex-end", borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.1)" }
                  : { alignSelf: "flex-start", borderColor: borderColor ?? "#e5e7eb", backgroundColor: cardBg ?? "#ffffff" },
              ]}
            >
              <Text className="text-sm text-foreground" style={textWhite}>{m.text}</Text>
            </View>
          ))}

          {quickIngredients.length > 0 ? (
            <View className="mt-3">
              <Text className="text-xs mb-2" style={[textMuted, { fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }]}>
                Tap an ingredient to ask about it
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {quickIngredients.map((ing: string) => (
                  <Pressable
                    key={ing}
                    onPress={() => {
                      setDraft(`What is ${ing}?`);
                    }}
                    style={{
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: isDark ? "#333" : "#d1d5db",
                      backgroundColor: isDark ? "#1a1a1a" : "rgba(243,244,246,0.8)",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text className="text-sm text-foreground" style={[textWhite, { fontSize: 13 }]}>{ing}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setDraft("What is ");
              }}
              className="mt-2 rounded-xl border px-4 py-3"
              style={{ borderColor: borderColor ?? "#e5e7eb", backgroundColor: isDark ? "#1a1a1a" : "rgba(243,244,246,0.5)" }}
            >
              <Text className="text-sm text-foreground" style={textWhite}>Tap to ask: What is [ingredient name]?</Text>
            </Pressable>
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <View
            className="border-t py-3"
            style={{ borderColor: borderColor ?? undefined, backgroundColor: cardBg, paddingLeft: 28, paddingRight: 20 }}
          >
            <View className="flex-row items-end gap-2">
              <View className="flex-1 min-w-0">
                <Input
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ask about an ingredient…"
                  placeholderTextColor={isDark ? "#a1a1aa" : undefined}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  style={isDark ? { color: "#ffffff", backgroundColor: "#1a1a1a", borderColor: "#333" } : undefined}
                />
              </View>
              <Button onPress={send} className="h-12 px-4" style={isDark ? { backgroundColor: "#22c55e" } : undefined}>
                <Text className="text-primary-foreground" style={isDark ? { color: "#ffffff" } : undefined}>Send</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
        </>
        )}
      </View>
    </Modal>
  );
}

