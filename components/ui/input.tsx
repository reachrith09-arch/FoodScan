import * as React from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InputFormat = "integer" | undefined;

function formatIntegerWithCommas(input: string): string {
  if (input === "") return "";
  const isNegative = input.startsWith("-");
  const digits = input.replace(/[^0-9]/g, "");
  if (digits === "") return isNegative ? "-" : "";
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return isNegative ? `-${withCommas}` : withCommas;
}

function sanitizeIntegerInput(input: string): string {
  // Allow optional leading '-' and digits only
  const isNegative = input.startsWith("-");
  const digits = input.replace(/[^0-9]/g, "");
  return isNegative ? (digits ? `-${digits}` : "-") : digits;
}

function Input({
  className,
  placeholderClassName,
  onChangeText,
  keyboardType,
  value,
  format,
  label,
  ...props
}: TextInputProps & {
  ref?: React.RefObject<TextInput>;
  format?: InputFormat;
  label?: string;
}) {
  const isInteger = format === "integer";

  const handleChangeText = React.useCallback(
    (text: string) => {
      if (isInteger) {
        const sanitized = sanitizeIntegerInput(text);
        if (onChangeText) onChangeText(sanitized);
      } else {
        if (onChangeText) onChangeText(text);
      }
    },
    [isInteger, onChangeText],
  );

  const displayValue = React.useMemo(() => {
    if (!isInteger) return value as string;
    const raw =
      typeof value === "string" ? value : value == null ? "" : String(value);
    return formatIntegerWithCommas(raw);
  }, [isInteger, value]);

  return (
    <View className="flex-col gap-2">
      {label && <Label>{label}</Label>}
      <TextInput
        className={cn(
          "web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-input-background px-3 web:py-2 native:text-lg text-base text-foreground native:leading-[1.25] web:ring-offset-background file:border-0 file:bg-transparent file:font-medium placeholder:text-muted-foreground web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2 lg:text-sm",
          props.editable === false && "web:cursor-not-allowed opacity-50",
          className,
        )}
        placeholderClassName={cn("text-muted-foreground", placeholderClassName)}
        keyboardType={isInteger ? (keyboardType ?? "number-pad") : keyboardType}
        value={displayValue}
        onChangeText={handleChangeText}
        {...props}
      />
    </View>
  );
}

export { Input };
