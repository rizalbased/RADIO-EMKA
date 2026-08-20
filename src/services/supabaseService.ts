import {
  getSupabaseClient,
  isSupabaseConfigured,
  ensureAnonymousSession,
  getAdminSessionStatus,
  loginAdminWithServerPin,
  loginAdminToSupabase,
  logoutAdminFromSupabase
} from '../lib/supabaseClient';
import { SongRequest, DbSongRequest, DbRadioState, mapDbRequestToSongRequest, MoodTag } from '../types';

export {
  ensureAnonymousSession,
  getAdminSessionStatus,
  loginAdminWithServerPin,
  loginAdminToSupabase,
  logoutAdminFromSupabase
};

let songRequestsChannel: any = null;
let radioStateChannel: any = null;
let lastAdminQueueError: { code?: string; message: string } | null = null;

export function getLastAdminQueueError() {
  return lastAdminQueueError;
}

/**
 * Helper to execute Supabase database operations with automatic recovery
 * for clock skew / future JWT errors (PGRST303: "JWT issued at future").
 */
async function executeWithJwtRetry<T = any>(
  operation: () => PromiseLike<{ data?: T | null; error?: any }>
): Promise<{ data?: T | null; error?: any }> {
  let result = await operation();
  const err = result.error;

  if (
    err &&
    (err.code === 'PGRST303' ||
     (typeof err.message === 'string' &&
      (err.message.includes('JWT issued at future') ||
       err.message.includes('invalid JWT') ||
       err.message.includes('JWT expired'))))
  ) {
    console.warn('[SUPABASE JWT RECOVERY] Detected PGRST303 (JWT issued at future). Clearing invalid session token and retrying query...');
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (signOutErr) {
        console.warn('[SUPABASE JWT RECOVERY] signOut warning:', signOutErr);
      }
    }
    // Retry query after clearing invalid session token
    result = await operation();
  }

  return result;
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

    console.log('[EMKA USER]', userId);
    console.log(`[ADMIN AUTH] session exists: ${sessionExists}`);
    console.log(`[ADMIN AUTH] user id: ${userId}`);
    console.log(`[ADMIN AUTH] is anonymous: ${isAnonymous}`);
    console.log(`[ADMIN AUTH] role: ${role}`);
    console.log('[ADMIN QUEUE] fetching requests...');

    // 2. Fetch song_requests ordered by created_at ascending (FIFO) with id tie-breaker
    const { data, error } = await executeWithJwtRetry<DbSongRequest[]>(async () =>
      await client
        .from('song_requests')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    );

    console.log('[EMKA ADMIN FETCH]', data, error);

    if (error) {
      lastAdminQueueError = { code: error.code, message: error.message };
      console.error(`[EMKA ADMIN QUERY ERROR]\ncode: ${error.code}\nmessage: ${error.message}\ndetails: ${(error as any).details || null}\nhint: ${(error as any).hint || null}`);
      return { requests: [], isSupabase: true, error: { code: error.code, message: error.message } };
    }

    lastAdminQueueError = null;
    const requestCount = data ? data.length : 0;
    console.log(`[EMKA ADMIN QUERY SUCCESS]\nrows: ${requestCount}`);
    console.log('[QUEUE LOAD]', requestCount);

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
 * Fetches current radio state from public.radio_state (row id = 1).
 */
export async function fetchRadioStateFromDb(): Promise<{
  state: DbRadioState | null;
  error?: { code?: string; message: string };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { state: null };
  }

  try {
    const { data, error } = await executeWithJwtRetry<DbRadioState>(async () =>
      await client
        .from('radio_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
    );

    if (error) {
      console.warn('[RADIO STATE] fetch error:', error);
      return { state: null, error: { code: error.code, message: error.message } };
    }

    return { state: data as DbRadioState | null };
  } catch (err: any) {
    console.warn('[RADIO STATE] fetch exception:', err);
    return { state: null, error: { message: err?.message } };
  }
}

/**
 * Updates public.radio_state for row id = 1.
 */
export async function updateRadioStateInDb(
  patch: Partial<DbRadioState>
): Promise<{ success: boolean; state?: DbRadioState; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client not configured' };
  }

  try {
    const nowIso = new Date().toISOString();
    const payload: any = {
      ...patch,
      updated_at: nowIso
    };

    // 1. First attempt direct UPDATE on row id = 1
    // This strictly updates provided columns in payload, leaving ALL current_* fields untouched.
    const { data: updateData, error: updateErr } = await executeWithJwtRetry<DbRadioState>(async () =>
      await client
        .from('radio_state')
        .update(payload)
        .eq('id', 1)
        .select()
        .maybeSingle()
    );

    if (!updateErr && updateData) {
      console.log('[RADIO STATE] updated successfully via UPDATE:', patch.status, updateData.current_title);
      return { success: true, state: updateData as DbRadioState };
    }

    // 2. Fallback if row id = 1 does not exist yet
    payload.id = 1;
    const { data: upsertData, error: upsertErr } = await executeWithJwtRetry<DbRadioState>(async () =>
      await client
        .from('radio_state')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle()
    );

    if (upsertErr) {
      console.warn('[RADIO STATE] update error:', upsertErr.message);
      return { success: false, error: upsertErr.message };
    }

    console.log('[RADIO STATE] updated successfully via UPSERT:', patch.status);
    return { success: true, state: upsertData as DbRadioState };
  } catch (err: any) {
    console.error('[RADIO STATE] update exception:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Admin action: Play a song request.
 * Updates song_requests (status = playing) and radio_state (id = 1, status = playing).
 * Stores request.id to radio_state.current_request_id.
 */
export async function setAdminPlaySong(req: {
  id: string;
  video_id?: string;
  youtubeVideoId?: string;
  title?: string;
  songTitle?: string;
  channel_title?: string;
  artist?: string;
  thumbnail_url?: string;
  coverUrl?: string;
  preview_url?: string;
  previewUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[PLAY REQUEST]', req.id);
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not configured' };

  try {
    const nowIso = new Date().toISOString();
    const videoId = req.video_id || req.youtubeVideoId || '';
    const title = req.title || req.songTitle || '';
    const artist = req.channel_title || req.artist || '';
    const thumbnail = req.thumbnail_url || req.coverUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
    const previewUrl = req.preview_url || req.previewUrl || '';

    // 1. Update song_requests: mark previously playing requests as 'played'
    await client
      .from('song_requests')
      .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
      .eq('status', 'playing');

    // 2. Mark target request as 'playing'
    await client
      .from('song_requests')
      .update({ status: 'playing', played_at: null, updated_at: nowIso })
      .eq('id', req.id);

    // 3. Update radio_state (id = 1)
    const { error: stateErr } = await client
      .from('radio_state')
      .upsert({
        id: 1,
        status: 'playing',
        current_request_id: req.id,
        current_video_id: videoId || null,
        current_title: title || null,
        current_channel_title: artist || null,
        current_thumbnail_url: thumbnail || null,
        current_preview_url: previewUrl || null,
        started_at: nowIso,
        updated_at: nowIso
      }, { onConflict: 'id' });

    if (stateErr) {
      console.warn('[RADIO STATE] Play state update warning:', stateErr.message);
    } else {
      console.log('[CURRENT REQUEST]', req.id);
      console.log('[RADIO STATE] playing');
    }

    return { success: true };
  } catch (err: any) {
    console.error('[RADIO STATE] setAdminPlaySong error:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Admin action: Pause radio.
 */
export async function setAdminPauseRadio(currentTime?: number): Promise<{ success: boolean; error?: string }> {
  console.log('[RADIO PAUSE]', currentTime !== undefined ? `at time ${currentTime}` : '');
  console.log('[RADIO STATE] paused');
  const patch: Partial<DbRadioState> = { status: 'paused' };
  if (currentTime !== undefined && !isNaN(currentTime)) {
    patch.current_time = currentTime;
  }
  return await updateRadioStateInDb(patch);
}

/**
 * Admin action: Resume radio.
 */
export async function setAdminResumeRadio(): Promise<{ success: boolean; error?: string }> {
  console.log('[RADIO STATE] playing');
  return await updateRadioStateInDb({ status: 'playing' });
}

/**
 * Admin action: Stop radio / set Standby.
 */
export async function setAdminStopRadio(): Promise<{ success: boolean; error?: string }> {
  console.log('[RADIO STATE] standby');
  return await setRadioStandbyInDb();
}

/**
 * Standby state when no song is playing.
 */
export async function setRadioStandbyInDb(): Promise<{ success: boolean; error?: string }> {
  console.log('[RADIO STATE] standby');
  return await updateRadioStateInDb({
    status: 'standby',
    current_request_id: null,
    current_video_id: null,
    current_title: null,
    current_channel_title: null,
    current_thumbnail_url: null,
    started_at: null
  });
}

// Concurrency lock to prevent duplicate/race transitions
let isAdvancingLock = false;
let lastAdvanceTime = 0;

/**
 * Atomic FIFO transition to next song request:
 * 1. Idempotency lock prevents concurrent race conditions (e.g. YT ENDED + Admin Skip).
 * 2. Marks currently playing request(s) as 'played'.
 * 3. Finds next pending request strictly by `created_at ASC, id ASC`.
 * 4. Atomically marks chosen request as 'playing' and updates radio_state (row id = 1).
 * 5. If no requests remain in queue, transitions radio_state to 'standby'.
 */
export async function advanceToNextSongRequest(currentRequestId?: string | null): Promise<{
  success: boolean;
  nextRequest?: SongRequest | null;
  error?: string;
}> {
  const now = Date.now();
  if (isAdvancingLock || (now - lastAdvanceTime < 1200)) {
    console.log('[ADVANCE QUEUE] Skipped duplicate/concurrent advance request');
    return { success: true, nextRequest: null };
  }

  isAdvancingLock = true;
  lastAdvanceTime = now;
  console.log('[QUEUE NEXT] Advancing FIFO queue to next song...');

  const client = getSupabaseClient();
  if (!client) {
    isAdvancingLock = false;
    return { success: false, nextRequest: null, error: 'Supabase client not configured' };
  }

  try {
    const nowIso = new Date().toISOString();

    // Step A: Check if custom PostgreSQL RPC is configured in Supabase
    try {
      const { data: rpcData, error: rpcErr } = await client.rpc('advance_to_next_song_request', {
        p_current_request_id: currentRequestId || null
      });
      if (!rpcErr && rpcData) {
        console.log('[ADVANCE RPC] Executed via Supabase RPC:', rpcData);
        if (rpcData.id) {
          return { success: true, nextRequest: mapDbRequestToSongRequest(rpcData) };
        } else {
          return { success: true, nextRequest: null };
        }
      }
    } catch {}

    // Step B: Robust transactional sequence
    // 1. Mark target request and any stray 'playing' requests as 'played'
    if (currentRequestId) {
      await client
        .from('song_requests')
        .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
        .eq('id', currentRequestId);
    }

    // Clean up any other rows marked 'playing' to enforce single active playing request rule
    await client
      .from('song_requests')
      .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
      .eq('status', 'playing');

    // 2. Fetch next pending request directly from Supabase (Strict FIFO: created_at ASC, id ASC)
    const { data: nextRows, error: nextErr } = await executeWithJwtRetry<DbSongRequest[]>(async () =>
      await client
        .from('song_requests')
        .select('*')
        .in('status', ['pending', 'queued'])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(1)
    );

    if (nextErr) {
      console.warn('[ADVANCE FIFO] Query next request warning:', nextErr.message);
    }

    const nextDb = (nextRows && nextRows.length > 0) ? (nextRows[0] as DbSongRequest) : null;

    if (nextDb) {
      console.log('[PLAY REQUEST]', nextDb.id);
      // 3. Update next request to 'playing'
      await client
        .from('song_requests')
        .update({ status: 'playing', played_at: null, updated_at: nowIso })
        .eq('id', nextDb.id);

      // 4. Update radio_state with next track
      const nextThumb = nextDb.thumbnail_url || (nextDb.video_id ? `https://i.ytimg.com/vi/${nextDb.video_id}/hqdefault.jpg` : null);
      await client
        .from('radio_state')
        .upsert({
          id: 1,
          status: 'playing',
          current_request_id: nextDb.id,
          current_video_id: nextDb.video_id || null,
          current_title: nextDb.title || null,
          current_channel_title: nextDb.channel_title || null,
          current_thumbnail_url: nextThumb,
          started_at: nowIso,
          updated_at: nowIso
        }, { onConflict: 'id' });

      console.log('[CURRENT REQUEST]', nextDb.id);
      console.log('[RADIO STATE] playing');

      const mapped = mapDbRequestToSongRequest(nextDb);
      return { success: true, nextRequest: mapped };
    } else {
      // 5. Standby mode
      console.log('[ADVANCE FIFO] No pending requests in queue. Entering standby.');
      await setRadioStandbyInDb();
      return { success: true, nextRequest: null };
    }
  } catch (err: any) {
    console.error('[ADVANCE FIFO] Transition exception:', err);
    return { success: false, error: err?.message, nextRequest: null };
  } finally {
    setTimeout(() => {
      isAdvancingLock = false;
    }, 1000);
  }
}

/**
 * Backward compatibility alias for handleSongEndedTransition
 */
export async function handleSongEndedTransition(currentRequestId?: string | null): Promise<{
  success: boolean;
  nextRequest?: SongRequest | null;
  error?: string;
}> {
  return await advanceToNextSongRequest(currentRequestId);
}

/**
 * Subscribes to Supabase Realtime changes on public.song_requests and public.radio_state.
 * Uses dedicated channels for each table with proper lifecycle management.
 */
export function subscribeToSongRequests(callbacks: {
  onInsert?: (newReq: SongRequest) => void;
  onUpdate?: (updatedReq: SongRequest) => void;
  onDelete?: (deletedId: string) => void;
  onSyncAll?: (requests: SongRequest[]) => void;
  onRadioStateChange?: (state: DbRadioState) => void;
}): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  // Remove existing channels if already active to prevent duplicate listeners
  if (songRequestsChannel) {
    try {
      client.removeChannel(songRequestsChannel);
    } catch {}
    songRequestsChannel = null;
  }
  if (radioStateChannel) {
    try {
      client.removeChannel(radioStateChannel);
    } catch {}
    radioStateChannel = null;
  }

  console.log('[REALTIME] Subscribing to song-requests-realtime and radio-state-realtime...');

  // 1. Channel for song_requests
  songRequestsChannel = client
    .channel('song-requests-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'song_requests'
      },
      async (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          console.log('[REALTIME REQUEST] SONG REQUEST INSERT', payload.new);
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onInsert?.(req);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          console.log('[REALTIME REQUEST] SONG REQUEST UPDATE', payload.new);
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onUpdate?.(req);
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          console.log(`[REALTIME REQUEST] SONG REQUEST DELETE id=${deletedId}`);
          if (deletedId) {
            callbacks.onDelete?.(deletedId);
          }
        }

        // Always sync queue directly with Supabase to ensure absolute consistency
        try {
          const { requests } = await fetchSongRequestsFromDb();
          console.log('[REALTIME REQUEST] QUEUE SYNC count =', requests?.length);
          callbacks.onSyncAll?.(requests);
        } catch (e) {
          console.error('[REALTIME REQUEST] Error refreshing queue after event:', e);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[REALTIME REQUEST] Status:', status);
      if (status === 'SUBSCRIBED') {
        fetchSongRequestsFromDb().then(({ requests }) => {
          callbacks.onSyncAll?.(requests);
        });
      }
      if (err) {
        console.error('[REALTIME REQUEST] Error:', err);
      }
    });

  // 2. Channel for radio_state
  radioStateChannel = client
    .channel('radio-state-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'radio_state'
      },
      (payload) => {
        console.log('[RADIO STATE] Realtime update:', payload.new);
        const rawNew = payload.new as any;
        if (rawNew && rawNew.id === 1) {
          console.log('[RADIO STATE] Status:', rawNew.status, 'Title:', rawNew.current_title);
          callbacks.onRadioStateChange?.(rawNew as DbRadioState);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[RADIO STATE] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        fetchRadioStateFromDb().then(({ state }) => {
          if (state) {
            console.log('[RADIO STATE] Initial state:', state.status, state.current_title);
            callbacks.onRadioStateChange?.(state);
          }
        });
      }
      if (err) {
        console.error('[RADIO STATE] Realtime error:', err);
      }
    });

  return () => {
    if (songRequestsChannel) {
      try {
        client.removeChannel(songRequestsChannel);
      } catch {}
      songRequestsChannel = null;
    }
    if (radioStateChannel) {
      try {
        client.removeChannel(radioStateChannel);
      } catch {}
      radioStateChannel = null;
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
  album?: string;
  genre?: string;
  itunesTrackId?: string | number;
  itunesCollectionId?: string | number;
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

  console.log('[EMKA REQUEST]\nINSERT START');

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
            console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: ${anonErr.code}\nmessage: ${anonErr.message}\ndetails: ${(anonErr as any).details || null}\nhint: ${(anonErr as any).hint || null}`);
          }
        }
      } catch (err: any) {
        console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: EXCEPTION\nmessage: ${err?.message || 'Anon auth exception'}`);
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
      console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: NO_USER\nmessage: Gagal mendapatkan currentUser.id dari Supabase Auth\ndetails: null\nhint: null`);
      return { success: false, error: 'Request gagal: Sesi pengguna Supabase tidak valid.' };
    }

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
        console.warn(`[EMKA REQUEST] Duplicate rejected: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch {}

    console.log('[REQUEST INSERT] Preparing payload for song request:', { title: normTitle, artist: normArtist, videoId: cleanVideoId });

    // 6. Direct INSERT into public.song_requests with exact database mapping
    const insertPayload: any = {
      user_id: currentUser.id,
      video_id: cleanVideoId || null,
      title: normTitle,
      channel_title: normArtist || null,
      thumbnail_url: data.coverUrl || (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : null),
      preview_url: data.previewUrl || null,
      album: data.album || null,
      genre: data.genre || null,
      itunes_track_id: data.itunesTrackId ? String(data.itunesTrackId) : null,
      itunes_collection_id: data.itunesCollectionId ? String(data.itunesCollectionId) : null,
      requester_name: data.studentName.trim(),
      class_name: data.className ? data.className.trim() : null,
      target_person: data.targetPerson ? data.targetPerson.trim() : null,
      message: data.message ? data.message.trim() : null,
      mood: data.mood || null,
      status: 'pending'
    };

    let inserted: any = null;
    let insertErr: any = null;

    // Retry loop stripping missing columns if Postgres table schema cache doesn't have optional columns (PGRST204)
    for (let attempt = 0; attempt < 10; attempt++) {
      const res = await client
        .from('song_requests')
        .insert(insertPayload)
        .select()
        .single();

      if (!res.error) {
        inserted = res.data;
        insertErr = null;
        break;
      }

      insertErr = res.error;
      const code = insertErr.code;
      const msg = insertErr.message || '';

      // Handle duplicate error from unique constraint/index
      if (
        code === '23505' ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('already exists')
      ) {
        return { success: false, error: 'Lagu tersebut sudah ada di antrean.' };
      }

      // Handle missing column in schema cache (PGRST204)
      if (code === 'PGRST204' || msg.includes('Could not find the') || msg.includes('column of')) {
        const match = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column ['"]?([^'"]+)['"]?/i);
        if (match && match[1] && insertPayload.hasOwnProperty(match[1])) {
          console.warn(`[REQUEST INSERT] Schema missing column '${match[1]}'. Stripping column and retrying insert...`);
          delete insertPayload[match[1]];
          continue;
        }
      }

      break;
    }

    if (insertErr) {
      console.error(`[REQUEST INSERT ERROR]\ncode: ${insertErr.code}\nmessage: ${insertErr.message}\ndetails: ${(insertErr as any).details || null}\nhint: ${(insertErr as any).hint || null}`);

      return {
        success: false,
        error: `Request gagal dikirim ke server. ${insertErr.message || ''}`.trim()
      };
    }

    if (!inserted || !inserted.id) {
      console.error(`[REQUEST INSERT ERROR]\ncode: NO_ID\nmessage: Database did not return inserted record\ndetails: null\nhint: null`);
      return { success: false, error: 'Request gagal dikirim ke server.' };
    }

    console.log(`[REQUEST INSERT SUCCESS] ID: ${inserted.id}`);

    // Step 5: Database Verification - Immediately SELECT back
    const { data: verified, error: verifyErr } = await client
      .from('song_requests')
      .select('*')
      .eq('id', inserted.id)
      .single();

    if (verifyErr || !verified) {
      console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: ${verifyErr?.code || 'VERIFICATION_FAILED'}\nmessage: ${verifyErr?.message || 'Data tidak ditemukan setelah insert'}\ndetails: ${(verifyErr as any)?.details || null}\nhint: ${(verifyErr as any)?.hint || null}`);
      return { success: false, error: 'Request gagal: Verifikasi database tidak menemukan data lagu.' };
    }

    const mapped = mapDbRequestToSongRequest(verified as DbSongRequest);
    // Preserve local fields if DB schema did not store them
    if (!mapped.message && data.message) mapped.message = data.message;
    if (!mapped.targetPerson && data.targetPerson) mapped.targetPerson = data.targetPerson;
    if (!mapped.previewUrl && data.previewUrl) mapped.previewUrl = data.previewUrl;
    if (!mapped.coverUrl && data.coverUrl) mapped.coverUrl = data.coverUrl;

    return { success: true, request: mapped };
  } catch (err: any) {
    console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: EXCEPTION\nmessage: ${err?.message || 'Unexpected exception during insert'}\ndetails: null\nhint: null`);
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

export async function deleteDbSongRequest(requestId: string): Promise<{ success: boolean; was_playing?: boolean }> {
  if (!requestId) {
    console.error('[REQUEST DELETE] Missing request ID');
    return { success: false };
  }

  console.log(`[REQUEST DELETE]\nrequestId=${requestId}`);

  const client = getSupabaseClient();
  if (!client) {
    console.error('[REQUEST DELETE] Supabase client not available');
    return { success: false };
  }

  try {
    // 1. Check if the deleted song is the current track in radio_state
    const { state } = await fetchRadioStateFromDb();
    const wasPlaying = Boolean(state && state.current_request_id === requestId);

    if (wasPlaying) {
      console.log(`[RADIO STATE] Clearing current song because active request is being deleted: ${requestId}`);
      await updateRadioStateInDb({
        status: 'paused',
        current_request_id: null,
        current_video_id: null,
        current_title: null,
        current_channel_title: null,
        current_thumbnail_url: null,
        started_at: null
      });
    }

    // 2. Perform direct delete using primary key ID
    const { error: directErr } = await executeWithJwtRetry(async () =>
      await client
        .from('song_requests')
        .delete()
        .eq('id', requestId)
    );

    if (directErr) {
      console.warn('[REQUEST DELETE] Direct delete error, trying RPC fallback:', directErr.message);
      // RPC fallback if RLS or triggers require RPC
      const { data: rpcData, error: rpcErr } = await client.rpc('delete_song_request', {
        p_request_id: requestId
      });
      if (rpcErr && directErr) {
        console.error('[REQUEST DELETE] Delete failed:', directErr.message || rpcErr.message);
        return { success: false, was_playing: wasPlaying };
      }
    }

    // 3. Database verification: Pastikan row benar-benar hilang dari database
    const { data: verifyData } = await client
      .from('song_requests')
      .select('id')
      .eq('id', requestId);

    if (verifyData && verifyData.length > 0) {
      console.error('[REQUEST DELETE] Database row still exists after delete:', requestId);
      return { success: false, was_playing: wasPlaying };
    }

    console.log(`[REQUEST DELETE SUCCESS]\nrequestId=${requestId}`);
    return { success: true, was_playing: wasPlaying };
  } catch (err: any) {
    console.error('[REQUEST DELETE] Exception during delete:', err);
    return { success: false };
  }
}

export async function clearAllDbSongRequests(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    console.error('[CLEAR QUEUE] Supabase client not available');
    return false;
  }

  try {
    const { data, error } = await executeWithJwtRetry<any[]>(async () =>
      await client
        .from('song_requests')
        .delete()
        .eq('status', 'pending')
        .select()
    );

    if (error) {
      console.error('[CLEAR QUEUE] Supabase DELETE failed:', error);
      return false;
    }

    console.log('[CLEAR QUEUE] Cleared pending requests:', data);
    return true;
  } catch (err) {
    console.error('[CLEAR QUEUE] Exception during clear:', err);
    return false;
  }
}
