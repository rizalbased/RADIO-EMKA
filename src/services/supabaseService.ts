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

    console.log('[EMKA USER]', userId);
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

    console.log('[EMKA ADMIN FETCH]', data, error);

    if (error) {
      lastAdminQueueError = { code: error.code, message: error.message };
      console.error(`[EMKA ADMIN QUERY ERROR]\ncode: ${error.code}\nmessage: ${error.message}\ndetails: ${(error as any).details || null}\nhint: ${(error as any).hint || null}`);
      return { requests: [], isSupabase: true, error: { code: error.code, message: error.message } };
    }

    lastAdminQueueError = null;
    const requestCount = data ? data.length : 0;
    console.log(`[EMKA ADMIN QUERY SUCCESS]\nrows: ${requestCount}`);

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
    const { data, error } = await client
      .from('radio_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

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
      id: 1,
      updated_at: nowIso
    };

    const { data, error } = await client
      .from('radio_state')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[RADIO STATE] update error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[RADIO STATE] updated successfully:', patch.status, patch.current_title);
    return { success: true, state: data as DbRadioState };
  } catch (err: any) {
    console.error('[RADIO STATE] update exception:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Admin action: Play a song request.
 * Updates song_requests (status = playing) and radio_state (id = 1, status = playing).
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
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not configured' };

  try {
    const nowIso = new Date().toISOString();
    const videoId = req.video_id || req.youtubeVideoId || '';
    const title = req.title || req.songTitle || '';
    const artist = req.channel_title || req.artist || '';
    const thumbnail = req.thumbnail_url || req.coverUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

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
        started_at: nowIso,
        updated_at: nowIso
      }, { onConflict: 'id' });

    if (stateErr) {
      console.warn('[RADIO STATE] Play state update warning:', stateErr.message);
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
export async function setAdminPauseRadio(): Promise<{ success: boolean; error?: string }> {
  return await updateRadioStateInDb({ status: 'paused' });
}

/**
 * Admin action: Resume radio.
 */
export async function setAdminResumeRadio(): Promise<{ success: boolean; error?: string }> {
  return await updateRadioStateInDb({ status: 'playing' });
}

/**
 * Standby state when no song is playing.
 */
export async function setRadioStandbyInDb(): Promise<{ success: boolean; error?: string }> {
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

/**
 * Handles track completion (YT.PlayerState.ENDED).
 * 1. Marks current track as 'played'.
 * 2. Fetches next pending request ordered by created_at ASC.
 * 3. If found, sets status = 'playing' in song_requests and updates radio_state.
 * 4. If none found, sets radio_state status = 'standby'.
 */
export async function handleSongEndedTransition(currentRequestId?: string | null): Promise<{
  success: boolean;
  nextRequest?: SongRequest | null;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) return { success: false, nextRequest: null };

  try {
    const nowIso = new Date().toISOString();

    // 1. Mark current request as 'played'
    if (currentRequestId) {
      await client
        .from('song_requests')
        .update({ status: 'played', played_at: nowIso, updated_at: nowIso })
        .eq('id', currentRequestId);
    }

    // 2. Fetch next pending request (FIFO)
    const { data: nextRows, error: nextErr } = await client
      .from('song_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (nextErr) {
      console.warn('[RADIO STATE] Query next request warning:', nextErr.message);
    }

    const nextDb = (nextRows && nextRows.length > 0) ? (nextRows[0] as DbSongRequest) : null;

    if (nextDb) {
      // 3. Update next request to 'playing'
      await client
        .from('song_requests')
        .update({ status: 'playing', played_at: null, updated_at: nowIso })
        .eq('id', nextDb.id);

      // 4. Update radio_state with next track
      await client
        .from('radio_state')
        .upsert({
          id: 1,
          status: 'playing',
          current_request_id: nextDb.id,
          current_video_id: nextDb.video_id || null,
          current_title: nextDb.title || null,
          current_channel_title: nextDb.channel_title || null,
          current_thumbnail_url: nextDb.thumbnail_url || (nextDb.video_id ? `https://i.ytimg.com/vi/${nextDb.video_id}/hqdefault.jpg` : null),
          started_at: nowIso,
          updated_at: nowIso
        }, { onConflict: 'id' });

      const mapped = mapDbRequestToSongRequest(nextDb);
      return { success: true, nextRequest: mapped };
    } else {
      // 5. Standby mode
      await setRadioStandbyInDb();
      return { success: true, nextRequest: null };
    }
  } catch (err: any) {
    console.error('[RADIO STATE] Song ended transition exception:', err);
    return { success: false, error: err?.message, nextRequest: null };
  }
}

/**
 * Subscribes to Supabase Realtime changes on both public.song_requests and public.radio_state.
 * Strictly single subscription instance with clean teardown.
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

  // Remove existing channel if already active to prevent duplicates
  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch {}
    realtimeChannel = null;
  }

  console.log('[EMKA REALTIME]\nSUBSCRIBING');

  const channel = client
    .channel('emka-radio-song-requests')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'song_requests'
      },
      (payload) => {
        console.log('[EMKA REALTIME]', payload);
        if (payload.eventType === 'INSERT' && payload.new) {
          console.log('[EMKA REALTIME INSERT]', payload.new);
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onInsert?.(req);
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onUpdate?.(req);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          callbacks.onDelete?.(payload.old.id);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'radio_state'
      },
      (payload) => {
        const rawNew = payload.new as any;
        if (rawNew && rawNew.id === 1) {
          callbacks.onRadioStateChange?.(rawNew as DbRadioState);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[EMKA REALTIME STATUS]', status);
      if (status === 'SUBSCRIBED') {
        fetchSongRequestsFromDb().then(({ requests }) => {
          callbacks.onSyncAll?.(requests);
        });
        fetchRadioStateFromDb().then(({ state }) => {
          if (state) {
            callbacks.onRadioStateChange?.(state);
          }
        });
      }
      if (err) {
        console.error('[EMKA REALTIME ERROR]', err);
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

    // 6. Direct INSERT into public.song_requests with exact database mapping matching existing columns
    const insertPayload: any = {
      user_id: currentUser.id,
      video_id: cleanVideoId,
      title: normTitle,
      channel_title: normArtist || null,
      thumbnail_url: data.coverUrl || (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : null),
      requester_name: data.studentName.trim(),
      class_name: data.className ? data.className.trim() : null,
      status: 'pending'
    };

    const { data: inserted, error: insertErr } = await client
      .from('song_requests')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: ${insertErr.code}\nmessage: ${insertErr.message}\ndetails: ${(insertErr as any).details || null}\nhint: ${(insertErr as any).hint || null}`);

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
      console.error(`[EMKA REQUEST]\nINSERT ERROR\ncode: NO_ID\nmessage: Database did not return inserted record\ndetails: null\nhint: null`);
      return { success: false, error: 'Request gagal dikirim ke server.' };
    }

    console.log(`[EMKA REQUEST]\nINSERT SUCCESS\nid: ${inserted.id}`);

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
