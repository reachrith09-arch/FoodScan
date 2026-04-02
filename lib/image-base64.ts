/**
 * SDK 54+: `readAsStringAsync` on the root `expo-file-system` package throws — use legacy.
 * Image picker often omits `asset.base64` when `allowsEditing` is true; this reads the file URI.
 */
import * as FileSystem from "expo-file-system/legacy";

export async function readImageUriAsBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return b64 && b64.length > 80 ? b64 : null;
  } catch {
    return null;
  }
}
