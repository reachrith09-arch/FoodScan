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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
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
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const productKey = props.product?.code ?? "unknown";

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

          <Pressable
            onPress={() => {
              setDraft("What does ... mean?");
            }}
            className="mt-2 rounded-xl border px-4 py-3"
            style={{ borderColor: borderColor ?? "#e5e7eb", backgroundColor: isDark ? "#1a1a1a" : "rgba(243,244,246,0.5)" }}
          >
            <Text className="text-sm text-foreground" style={textWhite}>Tap to ask: What does ... mean?</Text>
          </Pressable>
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
      </View>
    </Modal>
  );
}

