import * as Slot from "@rn-primitives/slot";
import * as React from "react";
import { Text as RNText } from "react-native";
import { cn } from "@/lib/utils";
import type { TextSizeVariant } from "@/lib/use-settings";
import { useFontSizeOptional } from "@/lib/use-settings";

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  size = "body",
  style,
  ...props
}: React.ComponentProps<typeof RNText> & {
  ref?: React.RefObject<RNText>;
  asChild?: boolean;
  /** App font-size setting: title (section headers), body (default), caption (small labels). */
  size?: TextSizeVariant;
}) {
  const textClass = React.useContext(TextClassContext);
  const fontContext = useFontSizeOptional();
  const Component = asChild ? Slot.Text : RNText;

  const rawSize =
    fontContext &&
    (size === "title"
      ? fontContext.titleSize
      : size === "caption"
        ? fontContext.captionSize
        : fontContext.bodySize);
  const scaledFontSize = rawSize != null ? Math.round(rawSize) : null;

  return (
    <Component
      className={cn("font-sans text-foreground text-lg", textClass, className)}
      style={scaledFontSize != null ? [style, { fontSize: scaledFontSize }] : style}
      allowFontScaling={scaledFontSize != null ? false : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
