import * as React from "react";
import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button.native";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

interface TagSectionProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  optional?: boolean;
  isDark?: boolean;
}

const textWhite = { color: "#ffffff" as const };
const textMuted = { color: "#a1a1aa" as const };

export function TagSection({
  label,
  value,
  onChange,
  placeholder = "Type and add",
  optional,
  isDark,
}: TagSectionProps) {
  const [input, setInput] = React.useState("");

  const add = () => {
    const t = input.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setInput("");
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <View className="gap-2" style={{ minWidth: 0, alignSelf: "stretch" }}>
      <Text className="text-sm font-medium text-foreground" style={isDark ? textWhite : undefined}>
        {label}
        {optional ? " (optional)" : ""}
      </Text>
      <View className="gap-2">
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          onSubmitEditing={add}
          returnKeyType="done"
          style={isDark ? { color: "#ffffff" } : undefined}
          placeholderTextColor={isDark ? "#a1a1aa" : undefined}
        />
        <Button
          size="sm"
          onPress={add}
          className="self-start flex-row items-center gap-1"
          style={isDark ? { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ffffff" } : undefined}
        >
          <Plus size={16} color={isDark ? "#ffffff" : "#111827"} />
          {isDark ? <Text style={{ color: "#ffffff" }}>Add</Text> : "Add"}
        </Button>
      </View>
      {value.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {value.map((item, i) => (
            <View
              key={`${item}-${i}`}
              className="flex-row items-center rounded-md border border-border bg-muted px-2 py-1"
            >
              <Text className="text-sm text-foreground" style={isDark ? textWhite : undefined}>{item}</Text>
              <Pressable
                onPress={() => remove(i)}
                accessibilityLabel={`Remove ${item}`}
                className="ml-1 rounded p-1"
              >
                <Text className="text-lg text-muted-foreground" style={isDark ? textMuted : undefined}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
