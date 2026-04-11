import { Linking, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/** Authoritative references for nutrition labeling, dietary guidance, and scoring-related concepts. */
export const HEALTH_INFORMATION_SOURCES: { label: string; url: string }[] = [
  {
    label: "WHO — Healthy diet (fact sheet)",
    url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  {
    label: "FDA — Nutrition Facts label",
    url: "https://www.fda.gov/food/nutrition-education-resources-materials/nutrition-facts-label",
  },
  {
    label: "USDA & HHS — Dietary Guidelines for Americans",
    url: "https://www.dietaryguidelines.gov/",
  },
  {
    label: "NHS — Eat well",
    url: "https://www.nhs.uk/live-well/eat-well/",
  },
  {
    label: "Harvard T.H. Chan — Nutrition Source",
    url: "https://www.hsph.harvard.edu/nutritionsource/",
  },
  {
    label: "FAO — Sustainable healthy diets (background document)",
    url: "https://www.fao.org/3/ca5644en/ca5644en.pdf",
  },
  {
    label: "Open Food Facts — product database (barcode data)",
    url: "https://world.openfoodfacts.org/",
  },
];

export function HealthInformationSources({ isDark }: { isDark?: boolean }) {
  const linkColor = isDark ? "#60a5fa" : "#2563eb";
  const muted = isDark ? "#a1a1aa" : "#71717a";

  return (
    <View className="gap-2">
      <Text
        className="text-muted-foreground text-sm"
        style={isDark ? { color: muted } : undefined}
      >
        Scores and explanations use label data and widely published nutrition
        guidance. Tap a link to open the source in your browser.
      </Text>
      {HEALTH_INFORMATION_SOURCES.map(({ label, url }) => (
        <Pressable
          key={url}
          onPress={() => void Linking.openURL(url)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.75 : 1,
            paddingVertical: 8,
            minHeight: 44,
            justifyContent: "center",
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: linkColor }}>
            {label}
            {" \u2197"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
