// Authentication (Supabase Auth). The login gate is only enforced when
// NEXT_PUBLIC_REQUIRE_AUTH === 'true' (set in the deployed build). Locally it's
// off so smoke-testing needs no login. See docs/security.md.
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

export const requireAuth = process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void) {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
