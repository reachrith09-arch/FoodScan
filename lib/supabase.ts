import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { env } from "@/env";
import type { Database } from "@/types/database.types";

type SupabaseClient = import("@supabase/supabase-js").SupabaseClient<Database>;
let _client: SupabaseClient | null | undefined = undefined;

function initSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  try {
    const { createClient } = require("@supabase/supabase-js");
    const url = env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      _client = null;
      return null;
    }
    _client = createClient<Database>(url, anon, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    return _client;
  } catch {
    _client = null;
    return null;
  }
}

export const supabase = initSupabase();
