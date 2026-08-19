import { getSupabaseClient, isSupabaseConfigured, ensureAnonymousSession } from '../lib/supabaseClient';
import { SongRequest, DbSongRequest, mapDbRequestToSongRequest, MoodTag } from '../types';

let realtimeChannel: any = null;

export async function fetchSongRequestsFromDb(): Promise<{ requests: SongRequest[]; isSupabase: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { requests: [], isSupabase: false };
  }

  try {
    const { data, error } = await client
      .from('song_requests')
      .select('*')
      .order('created_at', { ascending: true }); // Strict FIFO

    if (error) {
      console.warn('[SUPABASE] Fetch song_requests error:', error.message);
      return { requests: [], isSupabase: true };
    }

    const mapped = (data || []).map((row: DbSongRequest) => mapDbRequestToSongRequest(row));
    return { requests: mapped, isSupabase: true };
  } catch (err) {
    console.warn('[SUPABASE] Fetch exception:', err);
    return { requests: [], isSupabase: false };
  }
}

/**
 * Subscribes to Supabase Realtime changes on song_requests table.
 * Strictly single subscription instance with clean teardown.
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

  // Remove existing channel if already active
  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch {}
    realtimeChannel = null;
  }

  const channel = client
    .channel('public:song_requests')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'song_requests' },
      (payload) => {
        console.log('[SUPABASE REALTIME] INSERT detected:', payload.new?.id);
        if (payload.new) {
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onInsert?.(req);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'song_requests' },
      (payload) => {
        console.log('[SUPABASE REALTIME] UPDATE detected:', payload.new?.id, payload.new?.status);
        if (payload.new) {
          const req = mapDbRequestToSongRequest(payload.new as DbSongRequest);
          callbacks.onUpdate?.(req);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'song_requests' },
      (payload) => {
        console.log('[SUPABASE REALTIME] DELETE detected:', payload.old?.id);
        if (payload.old?.id) {
          callbacks.onDelete?.(payload.old.id);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[SUPABASE REALTIME] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        // Refresh entire list on initial subscription or reconnection
        fetchSongRequestsFromDb().then(({ requests }) => {
          callbacks.onSyncAll?.(requests);
        });
      }
      if (err) {
        console.warn('[SUPABASE REALTIME] Subscription error:', err);
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
 * Performs duplicate validation: rejects if same song is in 'pending' or 'playing'.
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
    return { success: false, error: 'Supabase client not configured.' };
  }

  const normTitle = data.songTitle.trim();
  const normArtist = data.artist.trim();
  const cleanVideoId = data.youtubeVideoId && data.youtubeVideoId.trim().length === 11 ? data.youtubeVideoId.trim() : null;

  console.log(`[SUPABASE REQUEST] Submitting: "${normTitle}" by "${normArtist}" (videoId=${cleanVideoId || 'none'})`);

  try {
    // 1. Ensure anonymous user session
    const userId = await ensureAnonymousSession();

    // 2. Duplicate validation against 'pending' and 'playing'
    let query = client
      .from('song_requests')
      .select('id, video_id, title, channel_title, status')
      .in('status', ['pending', 'playing']);

    if (cleanVideoId) {
      query = query.or(`video_id.eq.${cleanVideoId},and(title.ilike.${normTitle},channel_title.ilike.${normArtist})`);
    } else {
      query = query.ilike('title', normTitle).ilike('channel_title', normArtist);
    }

    const { data: existingRows, error: checkErr } = await query;
    if (!checkErr && existingRows && existingRows.length > 0) {
      const isPlaying = existingRows.some(r => r.status === 'playing');
      const errorMsg = isPlaying ? 'Lagu sedang diputar.' : 'Lagu tersebut sudah ada di antrean.';
      console.warn(`[SUPABASE REQUEST] Duplicate rejected: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 3. Single INSERT into song_requests
    const rowToInsert: Partial<DbSongRequest> = {
      user_id: userId || undefined,
      video_id: cleanVideoId || '',
      title: normTitle,
      channel_title: normArtist,
      thumbnail_url: data.coverUrl || (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : null),
      requester_name: data.studentName.trim(),
      class_name: data.className.trim(),
      target_person: data.targetPerson ? data.targetPerson.trim() : 'Semua Teman',
      message: data.message ? data.message.trim() : 'Salam hangat!',
      mood: data.mood || '🎧 Vibe Check',
      likes: 0,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await client
      .from('song_requests')
      .insert(rowToInsert)
      .select()
      .single();

    if (insertErr) {
      console.error('[SUPABASE REQUEST] Insert error:', insertErr.message);
      return { success: false, error: insertErr.message || 'Gagal mengirim request lagu. Silakan coba lagi.' };
    }

    const mapped = mapDbRequestToSongRequest(inserted as DbSongRequest);
    console.log('[SUPABASE REQUEST] Insert successful:', mapped.id);
    return { success: true, request: mapped };
  } catch (err: any) {
    console.error('[SUPABASE REQUEST] Exception during insert:', err);
    return { success: false, error: 'Gagal mengirim request lagu. Silakan coba lagi.' };
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
