import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, useColorScheme, View } from "react-native";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getFavoriteNote, getFavorites, setFavoriteNote } from "@/lib/storage";
import { getDisplayBrand, getDisplayProductName } from "@/lib/product-display";
import type { ScanResult } from "@/types/food";

export default function FavoritesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [list, setList] = React.useState<ScanResult[]>([]);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const favs = await getFavorites();
    setList(favs);
    const noteMap: Record<string, string> = {};
    await Promise.all(
      favs.map(async (item) => {
        noteMap[item.id] = await getFavoriteNote(item.id);
      }),
    );
    setNotes(noteMap);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text className="text-2xl font-semibold text-foreground">Favorites</Text>
        <Button variant="ghost" size="sm" onPress={() => router.back()} style={isDark ? { borderWidth: 1, borderColor: "#525252", borderRadius: 8 } : undefined}>
          <Text className="text-foreground">Done</Text>
        </Button>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        renderItem={({ item }) => (
          <View
            className="mb-3 rounded-xl border border-border bg-card p-4"
            style={isDark ? { borderWidth: 1, borderColor: "#525252" } : undefined}
          >
            <Pressable onPress={() => router.push(`/results/${item.id}`)}>
              <Text className="font-medium text-foreground">
                {getDisplayProductName(item.product)}
              </Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">
                {getDisplayBrand(item.product) ?? "Unknown"}
              </Text>
            </Pressable>
            <Input
              className="mt-2 min-h-0 border-border bg-muted/30 text-sm"
              value={notes[item.id] ?? ""}
              onChangeText={(t) => setNotes((prev) => ({ ...prev, [item.id]: t }))}
              onBlur={() => setFavoriteNote(item.id, notes[item.id] ?? "")}
              placeholder="Add a note"
              style={isDark ? { borderColor: "#525252", color: "#f4f4f5" } : undefined}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="py-8">
            <Text className="text-center text-muted-foreground">
              No favorites yet. Save products from results to see them here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
