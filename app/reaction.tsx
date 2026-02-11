import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Button } from "@/components/ui/button.native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { TagSection } from "@/components/tag-section";
import { addReaction } from "@/lib/reactions";
import type { ReactionLogEntry, SymptomSeverity } from "@/types/analytics";

export default function ReactionScreen() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();

  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [severity, setSeverity] = React.useState<SymptomSeverity>(3);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const entry: ReactionLogEntry = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      relatedScanId: scanId,
      symptoms,
      severity,
      notes: notes.trim() ? notes.trim() : undefined,
    };
    await addReaction(entry);
    setSaving(false);
    router.back();
  };

  return (
    <View className="flex-1 bg-background p-4">
      <Card>
        <CardHeader>
          <CardTitle>Log body reaction</CardTitle>
          <Text className="text-sm text-muted-foreground">
            Track symptoms after eating so the app can spot patterns over time.
          </Text>
        </CardHeader>
        <CardContent className="gap-4">
          <TagSection
            label="Symptoms"
            value={symptoms}
            onChange={setSymptoms}
            placeholder="e.g. headache, bloating, rash"
          />
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Severity (1–5)</Text>
            <View className="flex-row gap-2">
              {([1, 2, 3, 4, 5] as const).map((v) => {
                const selected = severity === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setSeverity(v as SymptomSeverity)}
                    className="flex-1 items-center justify-center py-2"
                    style={
                      selected
                        ? {
                            borderWidth: 1,
                            borderColor: "#16a34a",
                            borderRadius: 8,
                            backgroundColor: "#16a34a",
                          }
                        : undefined
                    }
                  >
                    <Text
                      className={selected ? "font-semibold text-primary-foreground" : "font-medium text-foreground"}
                      style={selected ? { color: "#ffffff" } : undefined}
                    >
                      {v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Notes (optional)</Text>
            <Input value={notes} onChangeText={setNotes} placeholder="What happened? When?" />
          </View>
          <Button onPress={save} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-primary-foreground">Save</Text>
            )}
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            <Text className="text-foreground">Cancel</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}

