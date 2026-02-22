import { useRouter } from "expo-router";
import { ArrowLeft, HeartPulse, MessageCircle, Share2, Star } from "lucide-react-native";
import * as React from "react";
import { Share, useColorScheme, View } from "react-native";
import { Button } from "@/components/ui/button.native";
import { Text } from "@/components/ui/text";
import { getDisplayProductName } from "@/lib/product-display";
import {
  addFavorite,
  isFavorite,
  removeFavorite,
} from "@/lib/storage";
import type { ScanResult } from "@/types/food";

const ROW_HEIGHT = 44;

export function ResultHeader({
  display,
  title,
  onChatOpen,
}: {
  display: ScanResult;
  title?: string;
  onChatOpen?: () => void;
}) {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const iconColor = isDark ? "#ffffff" : "#111827";
  const [fav, setFav] = React.useState(false);

  React.useEffect(() => {
    if (!display?.id) return;
    isFavorite(display.id).then(setFav);
  }, [display?.id]);

  const toggleFavorite = async () => {
    if (!display) return;
    if (fav) {
      await removeFavorite(display.id);
      setFav(false);
    } else {
      await addFavorite(display);
      setFav(true);
    }
  };

  const { product } = display;
  const analysis = display.analysis;

  const headerTopPad = 8;
  const headerHeight = headerTopPad + ROW_HEIGHT;

  return (
    <View
      className="bg-card px-4"
      style={{
        height: headerHeight,
        paddingTop: headerTopPad,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: isDark ? "#262626" : "#e5e7eb",
        backgroundColor: isDark ? "#0a0a0a" : "#fff",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Go back">
        <ArrowLeft size={20} color={iconColor} />
      </Button>
      <View style={{ flex: 1, alignItems: title ? "center" : undefined, justifyContent: "center" }}>
        {title ? (
          <Text className="text-base font-semibold" style={{ color: isDark ? "#f4f4f5" : "#18181b" }} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1">
        <Button variant="ghost" size="icon" onPress={() => onChatOpen?.()} accessibilityLabel="Ask about this food">
          <MessageCircle size={20} color={iconColor} />
        </Button>
        <Button variant="ghost" size="icon" onPress={() => router.push({ pathname: "/reaction", params: { scanId: display.id } })} accessibilityLabel="Log a body reaction">
          <HeartPulse size={20} color={iconColor} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onPress={() => {
            const name = getDisplayProductName(product);
            const score = analysis?.overallScore ?? 0;
            Share.share({ message: `${name} — Health score: ${score}/100. Analyzed with FoodScan.`, title: "FoodScan result" });
          }}
          accessibilityLabel="Share result"
        >
          <Share2 size={20} color={iconColor} />
        </Button>
        <Button variant="ghost" size="icon" onPress={toggleFavorite} accessibilityLabel={fav ? "Remove from favorites" : "Save to favorites"}>
          <Star size={20} color={fav ? "#16a34a" : iconColor} fill={fav ? "#16a34a" : "transparent"} />
        </Button>
      </View>
    </View>
  );
}
