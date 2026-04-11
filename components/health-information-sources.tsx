import { ChevronDown } from "lucide-react-native";
import * as React from "react";
import { Linking, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Plain-language methodology; keep in sync with `analyzeProduct` in lib/scoring.ts
 * (weights: nutrition 25%, allergens 25%, additives 20%, processing 20%, diet fit 10%).
 */
export const HEALTH_SCORE_METHODOLOGY =
  "The overall score is 0–100 and combines five parts calculated on your device: nutrition (25%), allergen safety for your profile (25%), additives (20%), how processed the product appears (20%), and diet fit with your preferences (10%). We use ingredient and nutrition data from the product when available (often from Open Food Facts). This is for information only—not medical advice.";

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

function sourceLinkStyles(isDark?: boolean) {
  return {
    linkColor: isDark ? "#60a5fa" : "#2563eb",
    muted: isDark ? "#a1a1aa" : "#71717a",
    chevron: isDark ? "#a1a1aa" : "#52525b",
  };
}

/** Settings: expandable “dropdown” with methodology + tappable official sources. */
export function HealthInformationSources({ isDark }: { isDark?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { linkColor, muted, chevron } = sourceLinkStyles(isDark);
  const titleColor = isDark ? "#fafafa" : "#18181b";

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open
            ? "Hide health score methodology and citations"
            : "Show health score methodology and citations"
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 4,
          minHeight: 48,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          className="flex-1 font-semibold text-sm leading-5"
          style={{ color: titleColor }}
        >
          {open
            ? "Hide score calculation & sources"
            : "Show score calculation & sources"}
        </Text>
        <View
          style={{
            transform: [{ rotate: open ? "180deg" : "0deg" }],
          }}
        >
          <ChevronDown size={22} color={chevron} />
        </View>
      </Pressable>

      {open ? (
        <View className="gap-2" style={{ paddingBottom: 4 }}>
          <Text className="font-semibold text-sm" style={{ color: titleColor }}>
            How this score is calculated
          </Text>
          <Text className="text-sm leading-5" style={{ color: muted }}>
            {HEALTH_SCORE_METHODOLOGY}
          </Text>
          <Text
            className="mt-2 font-semibold text-sm"
            style={{ color: titleColor }}
          >
            Citations and official sources
          </Text>
          <Text className="text-sm leading-5" style={{ color: muted }}>
            Tap a link to open it in your browser.
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
      ) : null}
    </View>
  );
}
