import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  // Strip quotes
  url = url.replace(/^["'`]|["'`]$/g, '').trim();
  // Strip subpaths if user pasted full REST or Auth endpoint URL
  url = url.replace(/\/(rest|auth|storage|graphql)\/v\d+.*$/i, '');
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  return url;
}

export function sanitizeSupabaseKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let key = rawKey.trim();
  key = key.replace(/^["'`]|["'`]$/g, '').trim();
  return key;
}

const rawSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey = sanitizeSupabaseKey(rawSupabaseAnonKey);

let clientInstance: SupabaseClient | null = null;
let anonymousAuthPromise: Promise<string | null> | null = null;

export function resetSupabaseClient(): void {
  clientInstance = null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (import.meta as any).env?.VITE_SUPABASE_URL &&
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  );
}

console.log('[EMKA SUPABASE CONFIG]', {
  urlConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
  keyConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY)
});

console.log('[EMKA ENV]', {
  supabaseUrlConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
  supabaseKeyConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY),
  youtubeConfigured: Boolean((import.meta as any).env?.VITE_YOUTUBE_API_KEY)
});

export function printEmkaDiagnostic(): void {
  if (typeof window === 'undefined') return;
  console.log('[EMKA SUPABASE CONFIG]', {
    urlConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
    keyConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY)
  });
  console.log('[EMKA ENV]', {
    supabaseUrlConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
    supabaseKeyConfigured: Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY),
    youtubeConfigured: Boolean((import.meta as any).env?.VITE_YOUTUBE_API_KEY)
  });
  console.log(
    '[EMKA SUPABASE]',
    Boolean((import.meta as any).env?.VITE_SUPABASE_URL),
    Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY)
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    printEmkaDiagnostic();
  }
  return clientInstance;
}

/**
 * Ensures a single anonymous session per browser/user.
 * Logs [EMKA AUTH] session, user, anonymous.
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
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) {
        if (typeof client.auth.signInAnonymously === 'function') {
          await client.auth.signInAnonymously();
        }
      }

      // 2. Retrieve session and user status
      const { data: latestSessionData } = await client.auth.getSession();
      const sessionExists = Boolean(latestSessionData?.session);
      let { data: userData, error: userErr } = await client.auth.getUser();

      if (userErr && (userErr.code === 'PGRST303' || userErr.message?.includes('JWT issued at future'))) {
        console.warn('[EMKA AUTH] Detected PGRST303 clock skew on getUser. Clearing session...');
        try {
          await client.auth.signOut();
          if (typeof client.auth.signInAnonymously === 'function') {
            await client.auth.signInAnonymously();
          }
        } catch {}
        const retryUser = await client.auth.getUser();
        userData = retryUser.data;
      }

      const userExists = Boolean(userData?.user);
      const isAnon = Boolean(userData?.user?.is_anonymous);

      console.log(`[EMKA AUTH]\nsession: ${sessionExists}\nuser: ${userExists}\nanonymous: ${isAnon}`);

      return userData?.user?.id || null;
    } catch (err: any) {
      console.warn('[EMKA AUTH] Exception:', err?.message || err);
      return null;
    } finally {
      anonymousAuthPromise = null;
    }
  })();

  return anonymousAuthPromise;
}

/**
 * Checks current Supabase Auth session for Admin authorization.
 * Admin must have a valid non-anonymous session with app_metadata.role === 'admin'.
 */
export async function getAdminSessionStatus(): Promise<{
  sessionExists: boolean;
  isAdmin: boolean;
  isAnonymous: boolean;
  userId: string | null;
  role: string | null;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      sessionExists: false,
      isAdmin: false,
      isAnonymous: false,
      userId: null,
      role: null
    };
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session || !session.user) {
      return {
        sessionExists: false,
        isAdmin: false,
        isAnonymous: false,
        userId: null,
        role: null,
        error: error?.message
      };
    }

    const user = session.user;
    const isAnonymous = Boolean(user.is_anonymous);
    const appRole = (user.app_metadata as any)?.role || null;
    const isAdmin = !isAnonymous && appRole === 'admin';

    return {
      sessionExists: true,
      isAdmin,
      isAnonymous,
      userId: user.id,
      role: appRole || (isAnonymous ? 'anonymous' : 'user')
    };
  } catch (err: any) {
    return {
      sessionExists: false,
      isAdmin: false,
      isAnonymous: false,
      userId: null,
      role: null,
      error: err?.message
    };
  }
}

/**
 * Signs in as Admin via server-side PIN verification.
 * No PIN or admin credentials are stored or compared in frontend.
 */
export async function loginAdminWithServerPin(
  pin: string
): Promise<{ success: boolean; error?: string; user?: any }> {
  try {
    const response = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin.trim() })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Tidak dapat masuk. PIN salah.' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: true };
    }

    // 1. If server returned Supabase Auth session tokens, set session directly
    if (data.session?.access_token && data.session?.refresh_token) {
      const { data: sessionData, error: sessionErr } = await client.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      if (sessionErr) {
        console.warn('[ADMIN AUTH] setSession warning:', sessionErr.message);
      } else if (sessionData?.user) {
        console.log('[ADMIN AUTH] Supabase admin session established');
        return { success: true, user: sessionData.user };
      }
    }

    // 2. If server returned authorized credentials to sign in client
    if (data.email && data.password) {
      const { data: authData, error: authErr } = await client.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authErr) {
        console.warn('[ADMIN AUTH] signInWithPassword error:', authErr.message);
        return { success: false, error: authErr.message };
      }

      console.log('[ADMIN AUTH] Supabase admin sign-in succeeded');
      return { success: true, user: authData.user };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[ADMIN AUTH] Verify PIN exception:', err);
    return { success: false, error: 'Tidak dapat masuk. PIN salah atau server bermasalah.' };
  }
}

/**
 * Signs in as permanent Admin using Supabase Auth with custom email and password.
 */
export async function loginAdminToSupabase(
  customEmail?: string,
  customPassword?: string
): Promise<{ success: boolean; error?: string; user?: any; isAdminRole?: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client not configured.' };
  }

  if (!customEmail || !customPassword) {
    return { success: false, error: 'Email dan password harus diisi.' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: customEmail.trim(),
      password: customPassword.trim()
    });

    if (error) {
      console.warn('[ADMIN AUTH] Login failed:', error.message);
      return { success: false, error: error.message };
    }

    const user = data.user;
    const isAnonymous = Boolean(user?.is_anonymous);
    const role = (user?.app_metadata as any)?.role || 'user';
    const isAdminRole = !isAnonymous && role === 'admin';

    console.log('[ADMIN AUTH] session exists: true');
    console.log(`[ADMIN AUTH] user id: ${user?.id}`);
    console.log(`[ADMIN AUTH] is anonymous: ${isAnonymous}`);
    console.log(`[ADMIN AUTH] role: ${role}`);

    return { success: true, user, isAdminRole };
  } catch (err: any) {
    console.error('[ADMIN AUTH] Login exception:', err);
    return { success: false, error: err?.message || 'Gagal login ke Supabase Auth.' };
  }
}

/**
 * Signs out admin and switches back to anonymous session.
 */
export async function logoutAdminFromSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.auth.signOut();
    console.log('[ADMIN AUTH] Admin signed out');
    await ensureAnonymousSession();
  } catch (err: any) {
    console.warn('[ADMIN AUTH] Sign out error:', err?.message);
  }
}
