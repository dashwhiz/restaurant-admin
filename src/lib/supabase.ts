import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Single browser Supabase client for the whole app. The app is client-side
// (the browser talks directly to Supabase), which keeps it deployable as a
// static export. Every data call goes through a service in src/lib/services/*.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both Supabase values are configured (see .env.local.example). */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Get the shared Supabase client. Throws a clear, human-readable error if the
 * environment variables are missing — the Settings/onboarding screen checks
 * `isSupabaseConfigured` first so this should never surface to end users.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase не е поставен. Копирај .env.local.example во .env.local и внеси ги двете вредности од Supabase (Settings → API), па рестартирај го серверот.',
    );
  }
  if (!client) client = createClient(url, anonKey);
  return client;
}
