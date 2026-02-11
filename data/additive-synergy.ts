import type { SynergyWarning } from "@/types/food";

/**
 * Seed (rules-based) additive synergy combinations.
 * This is intentionally conservative and uses "low/medium" confidence by default.
 *
 * Keys should be normalized additive keys like "e211", "e102", "e621".
 */
export interface SynergyRule {
  required: string[]; // normalized keys
  warning: SynergyWarning;
}

export const SYNERGY_RULES: SynergyRule[] = [
  {
    required: ["e211", "ascorbic acid"], // sodium benzoate + vitamin C
    warning: {
      title: "Preservative + Vitamin C combination",
      details:
        "Sodium benzoate (E211) combined with vitamin C (ascorbic acid) can form small amounts of benzene under certain conditions. Real-world levels are regulated, but some people prefer to limit this pairing.",
      confidence: "medium",
    },
  },
  {
    required: ["e621", "e631"], // MSG + disodium inosinate (often paired as flavor enhancers)
    warning: {
      title: "Stacked flavor enhancers",
      details:
        "Multiple flavor enhancers (e.g., MSG E621 with inosinate E631) may indicate heavily processed savory products. Some individuals report sensitivity.",
      confidence: "low",
    },
  },
  {
    required: ["e102", "e110"], // common synthetic dyes pairing
    warning: {
      title: "Multiple synthetic dyes",
      details:
        "Several synthetic colors together can be a signal of ultra-processed foods. Some people choose to avoid for personal preference or sensitivity.",
      confidence: "low",
    },
  },
];

