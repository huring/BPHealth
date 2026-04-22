import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createClient(supabaseUrl as string, supabaseAnonKey as string);
}
