import { Crown } from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { AiThirdPartyConsentPanel } from "@/components/ai-third-party-consent-panel";
import { ChatTypingIndicator } from "@/components/chat-typing-indicator";
import { FoodBuddyMascot } from "@/components/food-buddy-mascot";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  getAiThirdPartySharingConsent,
  isCloudFoodAssistantAvailable,
  setAiThirdPartySharingConsent,
} from "@/lib/ai-third-party-consent";
import { answerFoodQuestion } from "@/lib/food-assistant";
import { getReactionSummaryForAdvice } from "@/lib/reactions";
import { useSubscription } from "@/lib/revenuecat";
import { THEME } from "@/lib/theme";
import type {
  HealthProfile,
  ProductAnalysis,
  ProductResult,
} from "@/types/food";

const PENDING_REPLY_LABEL = "Writing…";

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
  const {
    canUseAssistant,
    showPaywall,
    refresh: refreshSubscription,
  } = useSubscription();
  /** True after a successful paywall close so the chat appears even if context `isPro` lags one frame. */
  const [assistantUnlocked, setAssistantUnlocked] = React.useState(false);
  const prevVisibleRef = React.useRef(false);
  React.useEffect(() => {
    if (canUseAssistant) setAssistantUnlocked(false);
  }, [canUseAssistant]);
  React.useEffect(() => {
    const opening = props.visible && !prevVisibleRef.current;
    prevVisibleRef.current = props.visible;
    if (opening && !canUseAssistant) setAssistantUnlocked(false);
  }, [props.visible, canUseAssistant]);
  const allowAssistant = canUseAssistant || assistantUnlocked;
  const needsCloudAssistant = isCloudFoodAssistantAvailable();
  const [assistantConsentReady, setAssistantConsentReady] =
    React.useState(false);
  const [hasAssistantAiConsent, setHasAssistantAiConsent] =
    React.useState(false);
  const [assistantConsentBusy, setAssistantConsentBusy] = React.useState(false);

  React.useEffect(() => {
    if (!props.visible) {
      setAssistantConsentReady(false);
      return;
    }
    if (!allowAssistant) return;
    let cancelled = false;
    void (async () => {
      if (!needsCloudAssistant) {
        if (!cancelled) {
          setHasAssistantAiConsent(true);
          setAssistantConsentReady(true);
        }
        return;
      }
      const c = await getAiThirdPartySharingConsent();
      if (!cancelled) {
        setHasAssistantAiConsent(c);
        setAssistantConsentReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.visible, allowAssistant, needsCloudAssistant]);

  const handleUnlockPro = React.useCallback(async () => {
    const ok = await showPaywall({ forceShow: true });
    await refreshSubscription();
    if (ok) setAssistantUnlocked(true);
  }, [showPaywall, refreshSubscription]);
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
    const junk = /\b(group|international|ltd|llc|inc\.?|corp|gmbh|wacool)\b/i;
    return raw
      .split(/[,;]+/)
      .map((s: string) =>
        s
          .trim()
          .replace(/^\s*[_\-•*]+\s*/, "")
          .replace(/\s*\(.*?\)/g, "")
          .trim(),
      )
      .map((s: string) => s.replace(/\bholesterol\b/gi, "cholesterol"))
      .filter(
        (s: string) =>
          s.length >= 3 &&
          s.length <= 40 &&
          !/^\d/.test(s) &&
          !junk.test(s) &&
          s.split(/\s+/).length <= 6,
      )
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
        text: "Hey — I’m Sprout, your food guide.\n\nAsk me anything about this scan: ingredients, nutrition, whether it fits your diet, or healthier swaps.\n\nTalk naturally — you can say snack, breakfast, or drink when you want swap ideas narrowed down.",
      },
    ]);
  }, [props.visible, productKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scroll when `messages` updates
  React.useEffect(() => {
    // Auto-scroll to bottom when messages change (including same-length reply updates).
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const send = async () => {
    const q = draft.trim();
    if (!q || sending) return;
    const chatHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter(
        (m) =>
          !/^(Thinking|Writing)…$/.test(m.text) &&
          m.text !== PENDING_REPLY_LABEL,
      )
      .slice(-14)
      .map((m) => ({ role: m.role, content: m.text }));
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
      { id: pendingId, role: "assistant", text: PENDING_REPLY_LABEL },
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
        chatHistory,
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
          className="border-b px-4 pt-3 pb-3"
          style={{
            borderColor: borderColor ?? undefined,
            backgroundColor: cardBg,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              <FoodBuddyMascot size={50} />
              <View className="min-w-0 flex-1">
                <Text
                  className="font-semibold text-foreground text-lg"
                  style={textWhite}
                >
                  Sprout
                </Text>
                <Text
                  className="text-muted-foreground text-xs"
                  style={textMuted}
                >
                  Your food guide · Not medical advice
                </Text>
              </View>
            </View>
            <Button variant="ghost" size="sm" onPress={props.onClose}>
              <Text className="text-foreground" style={textWhite}>
                Close
              </Text>
            </Button>
          </View>
        </View>

        {!allowAssistant ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <FoodBuddyMascot size={64} animate={false} />
            <View style={{ marginTop: 12 }}>
              <Crown size={40} color={THEME.primary} strokeWidth={2} />
            </View>
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
              Upgrade to FoodScan Pro for unlimited AI-powered food questions,
              full analysis, and more.
            </Text>
            <Pressable
              onPress={() => {
                void handleUnlockPro();
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
        ) : !assistantConsentReady ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
            }}
          >
            <ActivityIndicator
              size="large"
              color={isDark ? "#a1a1aa" : "#71717a"}
            />
          </View>
        ) : needsCloudAssistant && !hasAssistantAiConsent ? (
          <AiThirdPartyConsentPanel
            variant="assistant"
            isDark={isDark}
            busy={assistantConsentBusy}
            onDecline={props.onClose}
            onAgree={async () => {
              setAssistantConsentBusy(true);
              try {
                await setAiThirdPartySharingConsent(true);
                setHasAssistantAiConsent(true);
              } finally {
                setAssistantConsentBusy(false);
              }
            }}
          />
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              style={{ backgroundColor: bg }}
            >
              {messages.map((m) => {
                const isPending =
                  m.role === "assistant" && m.text === PENDING_REPLY_LABEL;
                if (isPending) {
                  return (
                    <View
                      key={m.id}
                      className="mb-3 max-w-[92%] flex-row items-end gap-2"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <FoodBuddyMascot size={40} />
                      <ChatTypingIndicator
                        dotColor={isDark ? "#a3a3a3" : "#71717a"}
                        pillBg={isDark ? "#1c1c1e" : "#f4f4f5"}
                        borderColor={isDark ? "#3f3f46" : "#e4e4e7"}
                      />
                    </View>
                  );
                }
                if (m.role === "assistant") {
                  return (
                    <View
                      key={m.id}
                      className="mb-3 max-w-[92%] flex-row items-start gap-2"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <FoodBuddyMascot size={40} animate={false} />
                      <View
                        className="min-w-0 flex-1 rounded-2xl border px-4 py-3"
                        style={{
                          borderColor: borderColor ?? "#e5e7eb",
                          backgroundColor: isDark
                            ? "#1c1c1e"
                            : (cardBg ?? "#ffffff"),
                        }}
                      >
                        <Text
                          className="text-foreground text-sm"
                          style={[textWhite, { lineHeight: 22 }]}
                        >
                          {m.text}
                        </Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View
                    key={m.id}
                    className="mb-3 max-w-[85%] rounded-2xl border px-4 py-3"
                    style={{
                      alignSelf: "flex-end",
                      borderColor: "rgba(34,197,94,0.35)",
                      backgroundColor: "rgba(34,197,94,0.12)",
                    }}
                  >
                    <Text
                      className="text-foreground text-sm"
                      style={[textWhite, { lineHeight: 22 }]}
                    >
                      {m.text}
                    </Text>
                  </View>
                );
              })}

              <View className="mt-4 w-full">
                <Text
                  className="mb-2 text-center text-xs"
                  style={[textMuted, { fontWeight: "600" }]}
                >
                  Suggestions
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 8,
                    alignSelf: "stretch",
                  }}
                >
                  {(
                    [
                      [
                        "Healthier swaps",
                        "What are some healthier swaps for this product?",
                      ],
                      ["Is this vegan?", "Is this vegan?"],
                      [
                        "How much sugar?",
                        "How much sugar is in this per 100g?",
                      ],
                      ["Why this score?", "Why is it scored this way?"],
                    ] as const
                  ).map(([label, fill]) => (
                    <Pressable
                      key={label}
                      onPress={() => setDraft(fill)}
                      style={{
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isDark ? "#3f3f46" : "#d4d4d8",
                        backgroundColor: isDark
                          ? "#27272a"
                          : "rgba(255,255,255,0.9)",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        className="text-foreground text-sm"
                        style={[textWhite, { fontSize: 13 }]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {quickIngredients.length > 0 ? (
                <View className="mt-5 w-full">
                  <Text
                    className="mb-2 text-center text-xs"
                    style={[textMuted, { fontWeight: "600" }]}
                  >
                    Ask about an ingredient
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: 8,
                      alignSelf: "stretch",
                    }}
                  >
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
                          backgroundColor: isDark
                            ? "#1a1a1a"
                            : "rgba(243,244,246,0.8)",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          className="text-foreground text-sm"
                          style={[textWhite, { fontSize: 13 }]}
                        >
                          {ing}
                        </Text>
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
                  style={{
                    borderColor: borderColor ?? "#e5e7eb",
                    backgroundColor: isDark
                      ? "#1a1a1a"
                      : "rgba(243,244,246,0.5)",
                  }}
                >
                  <Text className="text-foreground text-sm" style={textWhite}>
                    Tap to ask: What is [ingredient name]?
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
            >
              <View
                className="border-t py-3"
                style={{
                  borderColor: borderColor ?? undefined,
                  backgroundColor: cardBg,
                  paddingLeft: 28,
                  paddingRight: 20,
                }}
              >
                <View className="flex-row items-end gap-2">
                  <View className="min-w-0 flex-1">
                    <Input
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Ask anything about this product…"
                      placeholderTextColor={isDark ? "#a1a1aa" : undefined}
                      onSubmitEditing={send}
                      returnKeyType="send"
                      style={
                        isDark
                          ? {
                              color: "#ffffff",
                              backgroundColor: "#1a1a1a",
                              borderColor: "#333",
                            }
                          : undefined
                      }
                    />
                  </View>
                  <Button
                    onPress={send}
                    className="h-12 px-4"
                    style={isDark ? { backgroundColor: "#22c55e" } : undefined}
                  >
                    <Text
                      className="text-primary-foreground"
                      style={isDark ? { color: "#ffffff" } : undefined}
                    >
                      Send
                    </Text>
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
