import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let clientInstance: SupabaseClient | null = null;
let anonymousAuthPromise: Promise<string | null> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && 
    supabaseAnonKey && 
    typeof supabaseUrl === 'string' && 
    supabaseUrl.trim().startsWith('http') && 
    typeof supabaseAnonKey === 'string' && 
    supabaseAnonKey.trim().length > 10
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
  return clientInstance;
}

/**
 * Ensures a single anonymous session per browser/user.
 * Never prompts the user for login or credentials.
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  if (anonymousAuthPromise) {
    return anonymousAuthPromise;
  }

  anonymousAuthPromise = (async () => {
    try {
      // 1. Check existing session
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      if (!sessionErr && sessionData?.session?.user?.id) {
        return sessionData.session.user.id;
      }

      // 2. If no session, sign in anonymously
      if (typeof client.auth.signInAnonymously === 'function') {
        const { data: anonData, error: anonErr } = await client.auth.signInAnonymously();
        if (!anonErr && anonData?.user?.id) {
          console.log('[SUPABASE AUTH] Anonymous session initialized:', anonData.user.id);
          return anonData.user.id;
        }
        if (anonErr) {
          console.warn('[SUPABASE AUTH] Anonymous sign-in error:', anonErr.message);
        }
      }

      // 3. Fallback: retrieve current user or return null
      const { data: userData } = await client.auth.getUser();
      return userData?.user?.id || null;
    } catch (err) {
      console.warn('[SUPABASE AUTH] Auth initialization exception:', err);
      return null;
    } finally {
      anonymousAuthPromise = null;
    }
  })();

  return anonymousAuthPromise;
}
