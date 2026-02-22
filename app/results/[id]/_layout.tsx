import { Stack } from "expo-router";

export default function ResultLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="drivers" />
      <Stack.Screen name="diet" />
      <Stack.Screen name="swaps" />
      <Stack.Screen name="nutrition" />
      <Stack.Screen name="health" />
      <Stack.Screen name="ingredients" />
      <Stack.Screen name="exposure" />
    </Stack>
  );
}
