/**
 * FoodScan app theme: greens, white, light gray.
 */
export const THEME = {
  /** Primary green for buttons, active tab (slightly more saturated) */
  primary: "#15803d",
  /** Brighter green for gradient start */
  primaryBright: "#22c55e",
  /** Darker green for gradient end */
  primaryDark: "#166534",
  /** Light pastel green background */
  bgLight: "#e8f7ef",
  /** Slightly lighter at top for gradient */
  bgLightTop: "#f0fdf4",
  /** Header / card light */
  cardLight: "#f7fcf9",
  /** Dark forest green for headings and logo */
  darkGrey: "#14532d",
  /** Muted grey for secondary text */
  mutedGrey: "#6b7280",
  /** Border light */
  borderLight: "#d1fae5",
  /** Lighter green for subtle backgrounds */
  primaryLight: "rgba(34, 197, 94, 0.25)",
  darkBg: "#000000",
  darkCard: "#0a0a0a",
  borderDark: "#525252",
  white: "#ffffff",
  /** Soft shadow for cards */
  shadowCard: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  /** Softer shadow for buttons */
  shadowButton: { shadowColor: "#15803d", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
} as const;
