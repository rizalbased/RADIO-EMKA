import {
  getSupabaseClient,
  isSupabaseConfigured,
  ensureAnonymousSession,
  getAdminSessionStatus,
  loginAdminToSupabase,
  logoutAdminFromSupabase
} from '../lib/supabaseClient';
import { SongRequest, DbSongRequest, mapDbRequestToSongRequest, MoodTag } from '../types';

let realtimeChannel: any = null;
let lastAdminQueueError: { code?: string; message: string } | null = null;

export function getLastAdminQueueError() {
  return lastAdminQueueError;
}

export async function fetchSongRequestsFromDb(): Promise<{
  requests: SongRequest[];
  isSupabase: boolean;
  error?: { code?: string; message: string };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { requests: [], isSupabase: false };
  }

  try {
    // 1. Diagnostics logging
    const { data: { session }, error: sessionErr } = await client.auth.getSession();
    const sessionExists = Boolean(!sessionErr && session && session.user);
    const userId = session?.user?.id || 'none';
    const isAnonymous = Boolean(session?.user?.is_anonymous);
    const role = (session?.user?.app_metadata as any)?.role || (isAnonymous ? 'anonymous' : 'authenticated');

    console.log(`[ADMIN AUTH] session exists: ${sessionExists}`);
    console.log(`[ADMIN AUTH] user id: ${userId}`);
    console.log(`[ADMIN AUTH] is anonymous: ${isAnonymous}`);
    console.log(`[ADMIN AUTH] role: ${role}`);
    console.log('[ADMIN QUEUE] fetching requests...');

    // 2. Fetch song_requests ordered by created_at ascending (FIFO)
    const { data, error } = await client
      .from('song_requests')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      lastAdminQueueError = { code: error.code, message: error.message };
      console.error('[ADMIN QUEUE ERROR]', error);
      console.error(`[ADMIN QUEUE ERROR] code: ${error.code} message: ${error.message}`);
      return { requests: [], isSupabase: true, error: { code: error.code, message: error.message } };
    }

    lastAdminQueueError = null;
    const requestCount = data ? data.length : 0;
    console.log(`[ADMIN QUEUE] request count: ${requestCount}`);

    const mapped = (data || []).map((row: DbSongRequest) => mapDbRequestToSongRequest(row));
    return { requests: mapped, isSupabase: true };
  } catch (err: any) {
    const errMsg = err?.message || 'Unknown fetch exception';
    lastAdminQueueError = { message: errMsg };
    console.error('[ADMIN QUEUE ERROR]', err);
    return { requests: [], isSupabase: false, error: { message: errMsg } };
  }
}

/**
 * Subscribes to Supabase Realtime changes on song_requests table.
 * Uses channel 'admin-song-requests'. Strictly single subscription instance with clean teardown.
 */
export function subscribeToSongRequests(callbacks: {
  onInsert?: (newReq: SongRequest) => void;
  onUpdate?: (updatedReq: SongRequest) => void;
  onDelete?: (deletedId: string) => void;
  onSyncAll?: (requests: SongRequest[]) => void;
}): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  // Remove existing channel if already active to prevent duplicates
  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch {}
    realtimeChannel = null;
  }

  const channel = client
    .channel('admin-song-requests')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'song_requests'
      },
      (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          console.log('[SUPABASE] realtime INSERT:', payload.new.id);
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onInsert?.(req);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          console.log('[SUPABASE] realtime UPDATE:', payload.new.id, payload.new.status);
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onUpdate?.(req);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          console.log('[SUPABASE] realtime DELETE:', payload.old.id);
          callbacks.onDelete?.(payload.old.id);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[SUPABASE] realtime connected');
        // Initial fetch on connection to guarantee no stale queue state
        fetchSongRequestsFromDb().then(({ requests }) => {
          callbacks.onSyncAll?.(requests);
        });
      }
      if (err) {
        console.warn('[SUPABASE] realtime error:', err);
      }
    });

  realtimeChannel = channel;

  return () => {
    if (realtimeChannel) {
      try {
        client.removeChannel(realtimeChannel);
      } catch {}
      realtimeChannel = null;
    }
  };
}

/**
 * Inserts a new song request into Supabase song_requests.
 * Follows strict Supabase Auth verification & INSERT error logging.
 */
export async function insertSongRequest(data: {
  studentName: string;
  className: string;
  songTitle: string;
  artist: string;
  targetPerson: string;
  message: string;
  mood: string;
  coverUrl?: string;
  previewUrl?: string;
  youtubeVideoId?: string;
}): Promise<{ success: boolean; request?: SongRequest; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    console.error('[REQUEST SUPABASE ERROR]', { message: 'Supabase client is not configured' });
    return { success: false, error: 'Supabase client not configured.' };
  }

  const normTitle = data.songTitle.trim();
  const normArtist = data.artist.trim();
  const cleanVideoId = data.youtubeVideoId && data.youtubeVideoId.trim().length === 11 ? data.youtubeVideoId.trim() : (data.youtubeVideoId?.trim() || '');

  console.log('[REQUEST] submit started');

  try {
    // 1. Get user via Supabase Auth
    let currentUser: any = null;
    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (!userError && userData?.user?.id) {
        currentUser = userData.user;
      }
    } catch {}

    // 2. If userError or user doesn't exist, try getSession()
    if (!currentUser) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session?.user?.id) {
          currentUser = sessionData.session.user;
        }
      } catch {}
    }

    // 3. If session does not exist, signInAnonymously()
    if (!currentUser) {
      try {
        if (typeof client.auth.signInAnonymously === 'function') {
          const { error: anonErr } = await client.auth.signInAnonymously();
          if (anonErr) {
            console.error('[REQUEST SUPABASE ERROR]', {
              code: anonErr.code,
              message: anonErr.message,
              details: (anonErr as any).details,
              hint: (anonErr as any).hint
            });
          }
        }
      } catch (err: any) {
        console.error('[REQUEST SUPABASE ERROR]', { message: err?.message });
      }

      // Re-fetch user
      try {
        const { data: refreshedUser } = await client.auth.getUser();
        if (refreshedUser?.user?.id) {
          currentUser = refreshedUser.user;
        }
      } catch {}
    }

    // 4. If currentUser is still not available, FAIL the request
    if (!currentUser || !currentUser.id) {
      console.error('[REQUEST SUPABASE ERROR]', {
        message: 'Gagal mendapatkan currentUser.id dari Supabase Auth'
      });
      console.log('[REQUEST] INSERT ERROR', {
        message: 'Current user session missing'
      });
      return { success: false, error: 'Request gagal: Sesi pengguna Supabase tidak valid.' };
    }

    // Debug logging as specified in Section 6
    console.log(`[REQUEST] Supabase session:\n${Boolean(currentUser)}`);
    console.log(`[REQUEST] user id:\n${currentUser.id}`);
    console.log(`[REQUEST] video id:\n${cleanVideoId || 'none'}`);
    console.log('[REQUEST] inserting into:\npublic.song_requests');

    // 5. Pre-check duplicate validation against 'pending' and 'playing'
    try {
      let query = client
        .from('song_requests')
        .select('id, video_id, title, channel_title, status')
        .in('status', ['pending', 'playing']);

      if (cleanVideoId) {
        query = query.or(`video_id.eq.${cleanVideoId},and(title.ilike.${normTitle},channel_title.ilike.${normArtist})`);
      } else {
        query = query.ilike('title', normTitle).ilike('channel_title', normArtist);
      }

      const { data: existingRows } = await query;
      if (existingRows && existingRows.length > 0) {
        const isPlaying = existingRows.some(r => r.status === 'playing');
        const errorMsg = isPlaying ? 'Lagu sedang diputar.' : 'Lagu tersebut sudah ada di antrean.';
        console.warn(`[REQUEST] Duplicate rejected: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch {}

    // 6. Direct INSERT into public.song_requests with exact database mapping
    const insertPayload: any = {
      user_id: currentUser.id,
      video_id: cleanVideoId,
      title: normTitle,
      channel_title: normArtist || null,
      thumbnail_url: data.coverUrl || (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : null),
      requester_name: data.studentName.trim(),
      class_name: data.className ? data.className.trim() : null,
      target_person: data.targetPerson ? data.targetPerson.trim() : null,
      message: data.message ? data.message.trim() : null,
      mood: data.mood || null,
      status: 'pending'
    };

    const { data: inserted, error: insertErr } = await client
      .from('song_requests')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error('[REQUEST SUPABASE ERROR]', {
        code: insertErr.code,
        message: insertErr.message,
        details: (insertErr as any).details,
        hint: (insertErr as any).hint
      });
      console.log('[REQUEST] INSERT ERROR', {
        code: insertErr.code,
        message: insertErr.message
      });

      // Handle duplicate error from unique constraint/index
      if (
        insertErr.code === '23505' ||
        insertErr.message?.toLowerCase().includes('duplicate') ||
        insertErr.message?.toLowerCase().includes('already exists')
      ) {
        return { success: false, error: 'Lagu tersebut sudah ada di antrean.' };
      }

      return {
        success: false,
        error: `Request gagal dikirim ke server. ${insertErr.message || ''}`.trim()
      };
    }

    if (!inserted || !inserted.id) {
      console.error('[REQUEST SUPABASE ERROR]', { message: 'Database did not return inserted record' });
      console.log('[REQUEST] INSERT ERROR', { message: 'No inserted ID returned' });
      return { success: false, error: 'Request gagal dikirim ke server.' };
    }

    console.log(`[REQUEST] INSERT SUCCESS\n${inserted.id}`);

    const mapped = mapDbRequestToSongRequest(inserted as DbSongRequest);
    return { success: true, request: mapped };
  } catch (err: any) {
    console.error('[REQUEST SUPABASE ERROR]', {
      message: err?.message || 'Unexpected exception during insert',
      stack: err?.stack
    });
    console.log('[REQUEST] INSERT ERROR', { message: err?.message });
    return { success: false, error: 'Request gagal dikirim ke server.' };
  }
}

/**
 * Updates request status atomically in Supabase.
 * When status becomes 'playing', marks any previously playing track as 'played'.
 */
export async function updateDbRequestStatus(
  requestId: string,
  newStatus: 'Queued' | 'Playing' | 'Played' | 'pending' | 'playing' | 'played'
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  let dbStatus: 'pending' | 'playing' | 'played' = 'pending';
  if (newStatus === 'Playing' || newStatus === 'playing') dbStatus = 'playing';
  else if (newStatus === 'Played' || newStatus === 'played') dbStatus = 'played';
  else dbStatus = 'pending';

  try {
    const nowIso = new Date().toISOString();

    if (dbStatus === 'playing') {
      // 1. Mark any active 'playing' rows as 'played'
      await client
        .from('song_requests')
        .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
        .eq('status', 'playing');

      // 2. Set this track to 'playing'
      const { error } = await client
        .from('song_requests')
        .update({ status: 'playing', played_at: null, updated_at: nowIso })
        .eq('id', requestId);

      if (error) {
        console.warn('[SUPABASE] Update status to playing error:', error.message);
        return { success: false, error: error.message };
      }
    } else if (dbStatus === 'played') {
      const { error } = await client
        .from('song_requests')
        .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
        .eq('id', requestId);

      if (error) {
        console.warn('[SUPABASE] Update status to played error:', error.message);
        return { success: false, error: error.message };
      }
    } else {
      const { error } = await client
        .from('song_requests')
        .update({ status: 'pending', played_at: null, updated_at: nowIso })
        .eq('id', requestId);

      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[SUPABASE] Exception updating status:', err);
    return { success: false, error: err.message };
  }
}

export async function updateDbRequestVideoId(requestId: string, videoId: string): Promise<{ success: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: false };

  try {
    await client
      .from('song_requests')
      .update({ video_id: videoId, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function likeDbSongRequest(requestId: string): Promise<{ success: boolean; newLikes: number }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, newLikes: 1 };

  try {
    const { data } = await client
      .from('song_requests')
      .select('likes')
      .eq('id', requestId)
      .single();

    const currentLikes = data?.likes || 0;
    const nextLikes = currentLikes + 1;

    await client
      .from('song_requests')
      .update({ likes: nextLikes, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    return { success: true, newLikes: nextLikes };
  } catch {
    return { success: false, newLikes: 1 };
  }
}

export async function deleteDbSongRequest(requestId: string): Promise<{ success: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: false };

  try {
    const { error } = await client
      .from('song_requests')
      .delete()
      .eq('id', requestId);
    return { success: !error };
  } catch {
    return { success: false };
  }
}

export async function clearAllDbSongRequests(): Promise<{ success: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { success: false };

  try {
    const { error } = await client
      .from('song_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    return { success: !error };
  } catch {
    return { success: false };
  }
}
