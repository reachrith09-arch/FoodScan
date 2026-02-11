import * as React from "react";
import { getSettings, setSettings } from "@/lib/storage";

export type FontSize = "small" | "medium" | "large";

/** Medium = default size. Small = smaller. Large = larger. */
export const TITLE_SIZES: Record<FontSize, number> = {
  small: 14,
  medium: 20,
  large: 24,
};

/** Body/subtitle text sizes to match. */
export const BODY_SIZES: Record<FontSize, number> = {
  small: 12,
  medium: 16,
  large: 20,
};

/** Small labels / captions. */
export const CAPTION_SIZES: Record<FontSize, number> = {
  small: 10,
  medium: 13,
  large: 14,
};

export type TextSizeVariant = "title" | "body" | "caption";

type FontSizeContextValue = {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  titleSize: number;
  bodySize: number;
  captionSize: number;
};

const FontSizeContext = React.createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = React.useState<FontSize>("medium");
  React.useEffect(() => {
    getSettings().then((s) =>
      setFontSizeState((s.fontSize ?? "medium") as FontSize),
    );
  }, []);
  const setFontSize = React.useCallback((size: FontSize) => {
    setFontSizeState(size);
    void setSettings({ fontSize: size });
  }, []);
  const value = React.useMemo(
    () => ({
      fontSize,
      setFontSize,
      titleSize: TITLE_SIZES[fontSize],
      bodySize: BODY_SIZES[fontSize],
      captionSize: CAPTION_SIZES[fontSize],
    }),
    [fontSize, setFontSize],
  );
  return (
    <FontSizeContext.Provider value={value}>{children}</FontSizeContext.Provider>
  );
}

export function useFontSize(): FontSizeContextValue {
  const ctx = React.useContext(FontSizeContext);
  if (!ctx) {
    throw new Error("useFontSize must be used within FontSizeProvider");
  }
  return ctx;
}

/** Returns context or null when outside provider (e.g. for optional scaling in Text). */
export function useFontSizeOptional(): FontSizeContextValue | null {
  return React.useContext(FontSizeContext);
}

// ---------------------------------------------------------------------------
// Units (metric / imperial) – reactive so nutrition labels update app-wide
// ---------------------------------------------------------------------------

export type Units = "metric" | "imperial";

type UnitsContextValue = {
  units: Units;
  setUnits: (u: Units) => void;
};

const UnitsContext = React.createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnitsState] = React.useState<Units>("metric");
  React.useEffect(() => {
    getSettings().then((s) => setUnitsState(s.units));
  }, []);
  const setUnits = React.useCallback((u: Units) => {
    setUnitsState(u);
    void setSettings({ units: u });
  }, []);
  const value = React.useMemo(() => ({ units, setUnits }), [units, setUnits]);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const ctx = React.useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}

export function useOnboarding(): {
  onboardingDone: boolean;
  dismissOnboarding: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [onboardingDone, setOnboardingDone] = React.useState(false);
  const refresh = React.useCallback(async () => {
    const s = await getSettings();
    setOnboardingDone(!!s.onboardingDone);
  }, []);
  const dismissOnboarding = React.useCallback(async () => {
    await setSettings({ onboardingDone: true });
    setOnboardingDone(true);
  }, []);
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  return { onboardingDone, dismissOnboarding, refresh };
}
