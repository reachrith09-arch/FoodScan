import { useLocalSearchParams, useRouter } from "expo-router";
import { Mic, Search as SearchIcon, UtensilsCrossed, ChevronRight } from "lucide-react-native";
import * as React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addRecentSearch, addToScanHistory, getHealthProfile, getRecentSearches } from "@/lib/storage";
import { analyzeProduct } from "@/lib/scoring";
import { searchProducts } from "@/lib/open-food-facts";
import { getDisplayProductName } from "@/lib/product-display";
import type { ProductResult } from "@/types/food";
import type { ScanResult } from "@/types/food";

const SUGGEST_DEBOUNCE_MS = 300;
const MIN_CHARS_FOR_SUGGEST = 2;
const SUGGEST_RESULTS_COUNT = 6;
const SEARCH_TIMEOUT_MS = 10000;

export default function SearchScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const isDark = useColorScheme() === "dark";
  const [query, setQuery] = React.useState("");
  const [products, setProducts] = React.useState<ProductResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [suggestions, setSuggestions] = React.useState<ProductResult[]>([]);
  const [suggesting, setSuggesting] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = React.useState(false);
  const [voiceDraft, setVoiceDraft] = React.useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = React.useRef(query);
  queryRef.current = query;

  React.useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  React.useEffect(() => {
    if (typeof q === "string" && q.trim()) {
      setQuery(q.trim());
      search(q.trim());
    }
  }, [q]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS_FOR_SUGGEST) {
      setSuggestions([]);
      setSuggesting(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const queryForRequest = q;
      setSuggestions([]);
      setSuggesting(true);
      try {
        const profile = await getHealthProfile();
        const list = await searchProducts(queryForRequest, SUGGEST_RESULTS_COUNT, SEARCH_TIMEOUT_MS, profile?.countryCode);
        if (queryRef.current.trim() === queryForRequest) {
          setSuggestions(list);
        }
      } catch {
        if (queryRef.current.trim() === queryForRequest) {
          setSuggestions([]);
        }
      } finally {
        if (queryRef.current.trim() === queryForRequest) {
          setSuggesting(false);
        }
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const search = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    if (overrideQuery) setQuery(overrideQuery);
    setShowSuggestions(false);
    setSearching(true);
    const previousSuggestions = suggestions;
    setProducts([]);
    try {
      const profile = await getHealthProfile();
      const list = await searchProducts(q, 24, SEARCH_TIMEOUT_MS, profile?.countryCode);
      const results = list.length > 0 ? list : previousSuggestions;
      setProducts(results);
      await addRecentSearch(q);
      setRecentSearches((prev) => [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 5));
    } catch {
      setProducts(previousSuggestions);
    } finally {
      setSearching(false);
    }
  };

  const onSelectProduct = async (product: ProductResult) => {
    setShowSuggestions(false);
    const searchQuery = query.trim();
    if (searchQuery) {
      await addRecentSearch(searchQuery);
      setRecentSearches((prev) => [searchQuery, ...prev.filter((s) => s.toLowerCase() !== searchQuery.toLowerCase())].slice(0, 5));
    }
    setLoading(true);
    try {
      const profile = await getHealthProfile();
      const analysis = analyzeProduct(profile, product);
      const result: ScanResult = {
        id: `${Date.now()}-${product.code}`,
        timestamp: Date.now(),
        source: "search",
        barcode: product.code,
        product,
        healthRisks: analysis.healthRisks,
        analysis,
      };
      await addToScanHistory(result);
      router.replace(`/results/${result.id}`);
    } finally {
      setLoading(false);
    }
  };

  const recentFiltered = query.trim()
    ? recentSearches.filter((s) => s.toLowerCase().startsWith(query.trim().toLowerCase()))
    : recentSearches.slice(0, 5);
  const showDropdown =
    showSuggestions &&
    (recentFiltered.length > 0 || query.length >= 1 || suggestions.length > 0 || suggesting);

  const insets = useSafeAreaInsets();
  const searchBg = isDark ? "#0a0a0a" : "#f8fafc";
  const cardBg = isDark ? "#141414" : "#ffffff";
  const borderColor = isDark ? "#333" : "#e2e8f0";
  const primaryGreen = isDark ? "#22c55e" : "#16a34a";
  const mutedColor = isDark ? "#a1a1aa" : "#64748b";

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: searchBg,
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="flex-1 flex-row items-center rounded-2xl border px-4"
          style={{
            backgroundColor: cardBg,
            borderColor,
            minHeight: 52,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <SearchIcon size={20} color={mutedColor} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Input
              className="border-0 bg-transparent text-base native:text-lg min-h-0"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 220)}
              placeholder="Product name or brand"
              placeholderTextColor={isDark ? "#a1a1aa" : "#64748b"}
              onSubmitEditing={() => search()}
              returnKeyType="search"
              editable={!loading}
              style={{ color: isDark ? "#ffffff" : "#18181b" }}
            />
          </View>
          <Pressable
            onPress={() => {
              setVoiceDraft("");
              setVoiceModalOpen(true);
            }}
            className="pl-2"
            accessibilityLabel="Voice or paste search"
          >
            <Mic size={22} color={mutedColor} />
          </Pressable>
        </View>
        <Button
          onPress={() => search()}
          disabled={searching || loading}
          variant="default"
          size="lg"
          className="rounded-2xl min-h-[52px] px-5 bg-[#16a34a] opacity-100"
          style={{ opacity: searching || loading ? 0.85 : 1 }}
        >
          {searching ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text className="font-semibold text-white" style={{ fontSize: 16 }}>
                Searching…
              </Text>
            </>
          ) : (
            <Text className="font-semibold text-white" style={{ fontSize: 16 }}>
              Search
            </Text>
          )}
        </Button>
      </View>

      {showDropdown && (
        <View
          className="mt-3 rounded-2xl overflow-hidden"
          style={{
            maxHeight: 280,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.06,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 276 }}>
            {recentFiltered.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor }}>
                <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: mutedColor, marginBottom: 8 }}>
                  Recent
                </Text>
                {recentFiltered.slice(0, 5).map((s) => (
                  <Pressable key={s} onPress={() => search(s)} style={{ paddingVertical: 10 }}>
                    <Text className="text-base" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {query.trim().length >= MIN_CHARS_FOR_SUGGEST ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: mutedColor, marginBottom: 8 }}>
                  Suggestions
                </Text>
                {suggesting ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={primaryGreen} />
                  </View>
                ) : suggestions.length === 0 ? (
                  <Text className="text-sm" style={{ color: mutedColor, paddingVertical: 8 }}>
                    No suggestions. Tap Search for full results.
                  </Text>
                ) : (
                  suggestions.map((p, idx) => (
                    <Pressable
                      key={p.code}
                      onPress={() => onSelectProduct(p)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        borderBottomWidth: idx < suggestions.length - 1 ? 1 : 0,
                        borderColor,
                      }}
                    >
                      <View className="flex-1">
                        <Text className="text-base font-medium" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
                          {getDisplayProductName(p)}
                        </Text>
                        {p.brands && (
                          <Text className="text-sm mt-0.5" style={{ color: mutedColor }}>
                            {p.brands}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={18} color={mutedColor} />
                    </Pressable>
                  ))
                )}
              </View>
            ) : (
              query.length >= 1 && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text className="text-sm" style={{ color: mutedColor }}>
                    Type 2+ characters for product suggestions
                  </Text>
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}

      {loading && (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator size="large" color={primaryGreen} />
          <Text className="mt-2 text-sm" style={{ color: mutedColor }}>
            Opening product…
          </Text>
        </View>
      )}
      <FlatList
        data={products}
        keyExtractor={(item) => item.code}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelectProduct(item)}
            disabled={loading}
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
              borderWidth: 1,
              borderColor,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.15 : 0.04,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
                {getDisplayProductName(item)}
              </Text>
              {item.brands && (
                <Text className="text-sm mt-1" style={{ color: mutedColor }}>
                  {item.brands}
                </Text>
              )}
            </View>
            <ChevronRight size={20} color={mutedColor} />
          </Pressable>
        )}
        ListEmptyComponent={
          searching && query.trim() ? (
            <View style={{ paddingVertical: 32, alignItems: "center", paddingHorizontal: 24 }}>
              <ActivityIndicator size="large" color={primaryGreen} />
              <Text className="mt-3 text-center text-base" style={{ color: mutedColor }}>
                Searching…
              </Text>
            </View>
          ) : !searching && query.trim() ? (
            <View style={{ paddingVertical: 32, alignItems: "center", paddingHorizontal: 24 }}>
              <Text className="text-center text-base" style={{ color: mutedColor }}>
                No products found. Try a different search term or check spelling.
              </Text>
            </View>
          ) : !searching && !query.trim() ? (
            <View style={{ paddingVertical: 48, alignItems: "center", paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: isDark ? "#1f1f1f" : "#e2e8f0",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <UtensilsCrossed size={36} color={mutedColor} />
              </View>
              <Text
                className="text-center font-semibold"
                style={{ fontSize: 18, color: isDark ? "#f4f4f5" : "#18181b", marginBottom: 8 }}
              >
                Find foods, get insights
              </Text>
              <Text className="text-center text-sm" style={{ color: mutedColor, lineHeight: 20 }}>
                Search by product name or brand to see health scores and recommendations.
              </Text>
            </View>
          ) : null
        }
      />
      <Pressable
        onPress={() => router.back()}
        style={{ alignSelf: "center", marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 }}
      >
        <Text className="text-base font-medium" style={{ color: mutedColor }}>
          Cancel
        </Text>
      </Pressable>

      <Modal visible={voiceModalOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-center bg-black/50 px-6"
          onPress={() => setVoiceModalOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-2xl p-4"
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
          >
            <Text className="mb-3 text-sm font-medium" style={{ color: isDark ? "#f4f4f5" : "#18181b" }}>
              Paste or type what you said
            </Text>
            <Input
              className="min-h-0 border-border"
              value={voiceDraft}
              onChangeText={setVoiceDraft}
              placeholder="e.g. from voice dictation"
              style={{ borderColor, color: isDark ? "#f4f4f5" : "#18181b" }}
            />
            <View className="mt-3 flex-row justify-end gap-2">
              <Pressable onPress={() => setVoiceModalOpen(false)}>
                <Text style={{ color: mutedColor }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const t = voiceDraft.trim();
                  if (t) search(t);
                  setVoiceModalOpen(false);
                }}
                className="rounded-lg px-4 py-2"
                style={{ backgroundColor: primaryGreen }}
              >
                <Text className="font-medium text-white">Search</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
