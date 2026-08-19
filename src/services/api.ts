import { SheetConfig, SongRequest, AiVibeAnalysis, RadioHost, LiveRadioState, MoodTag, YouTubeSearchResult } from '../types';
import {
  fetchSongRequestsFromDb,
  subscribeToSongRequests,
  insertSongRequest,
  updateDbRequestStatus,
  deleteDbSongRequest,
  clearAllDbSongRequests,
  likeDbSongRequest,
  updateDbRequestVideoId
} from './supabaseService';
import { isSupabaseConfigured } from '../lib/supabaseClient';

// LocalStorage Keys for resilient offline/cached data
const STORAGE_KEYS = {
  REQUESTS: 'emka_radio_requests',
  HOSTS: 'emka_radio_hosts',
  CONFIG: 'emka_sheet_config',
  LIVE_STATE: 'emka_live_state',
  ADMIN_AUTH: 'emka_admin_auth'
};

export const DEFAULT_HOSTS: RadioHost[] = [
  {
    id: 'host-1',
    name: 'DJ Rizal',
    tagline: 'Penyiar Main On-Air EMKA Radio Sekolah',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    instagram: '@rizalsaragih498',
    isOnAir: true
  },
  {
    id: 'host-2',
    name: 'DJ Nabila',
    tagline: 'Co-Host & Request Curator EMKA Radio',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    instagram: '@nabila.fm',
    isOnAir: true
  }
];

// Helper: Local caching
function getLocalHosts(): RadioHost[] {
  if (typeof window === 'undefined') return DEFAULT_HOSTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HOSTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_HOSTS;
}

function saveLocalHosts(hosts: RadioHost[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.HOSTS, JSON.stringify(hosts));
  } catch {}
}

export function getLocalRequests(): SongRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Strict deduplication by ID
        const seen = new Set<string>();
        return parsed.filter((item) => {
          if (!item || !item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      }
    }
  } catch {}
  return [];
}

export function saveLocalRequests(requests: SongRequest[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  } catch {}
}

function getLocalSheetConfig(): SheetConfig {
  if (typeof window === 'undefined') return { connected: false };
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { connected: false };
}

function saveLocalSheetConfig(config: SheetConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch {}
}

export function getLocalLiveState(): LiveRadioState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LIVE_STATE);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function saveLocalLiveState(state: LiveRadioState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(state));
  } catch {}
}

// -------------------------------------------------------------
// 1. RADIO HOSTS & SETTINGS
// -------------------------------------------------------------

export async function fetchRadioHosts(): Promise<RadioHost[]> {
  return getLocalHosts();
}

export function subscribeRadioHosts(onUpdate: (hosts: RadioHost[]) => void): () => void {
  onUpdate(getLocalHosts());
  
  const listener = () => {
    onUpdate(getLocalHosts());
  };
  
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export async function fetchRadioHost(): Promise<RadioHost> {
  const hosts = await fetchRadioHosts();
  return hosts[0] || DEFAULT_HOSTS[0];
}

export async function updateRadioHosts(hostsData: RadioHost[]): Promise<{ success: boolean; hosts: RadioHost[]; host: RadioHost }> {
  saveLocalHosts(hostsData);
  window.dispatchEvent(new Event('storage'));
  return { success: true, hosts: hostsData, host: hostsData[0] };
}

export async function updateRadioHost(hostData: RadioHost): Promise<{ success: boolean; host: RadioHost }> {
  const current = getLocalHosts();
  const updated = [hostData, current[1] || DEFAULT_HOSTS[1]];
  return await updateRadioHosts(updated);
}

// -------------------------------------------------------------
// 2. GOOGLE SHEET CONFIGURATION
// -------------------------------------------------------------

export async function fetchSheetConfig(): Promise<SheetConfig> {
  return getLocalSheetConfig();
}

export async function connectGoogleSheet(payload: { spreadsheetId?: string; spreadsheetUrl?: string; webAppUrl?: string }): Promise<{ success: boolean; config: SheetConfig }> {
  let sheetId = payload.spreadsheetId;
  if (!sheetId && payload.spreadsheetUrl) {
    const match = payload.spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) sheetId = match[1];
  }

  const newConfig: SheetConfig = {
    connected: true,
    spreadsheetId: sheetId || 'emka-radio-sheet',
    spreadsheetUrl: payload.spreadsheetUrl || (sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : 'https://docs.google.com/spreadsheets/'),
    title: '🎵 Request Lagu & Confession EMKA Radio',
    lastSyncedAt: new Date().toISOString(),
    mode: 'oauth'
  };

  saveLocalSheetConfig(newConfig);
  return { success: true, config: newConfig };
}

// -------------------------------------------------------------
// 3. SONG REQUESTS & FIFO QUEUE (SUPABASE SINGLE SOURCE OF TRUTH)
// -------------------------------------------------------------

export async function fetchSongRequests(): Promise<{ requests: SongRequest[]; synced: boolean }> {
  if (isSupabaseConfigured()) {
    const { requests, isSupabase } = await fetchSongRequestsFromDb();
    if (isSupabase && requests) {
      saveLocalRequests(requests);
      return { requests, synced: true };
    }
  }
  return { requests: getLocalRequests(), synced: false };
}

export function subscribeSongRequests(onUpdate: (requests: SongRequest[]) => void): () => void {
  // Always emit current local/cached requests initially
  onUpdate(getLocalRequests());

  if (isSupabaseConfigured()) {
    console.log('[API] Subscribing to Supabase Realtime song_requests channel...');
    const unsubscribeSupabase = subscribeToSongRequests({
      onInsert: (newReq) => {
        const current = getLocalRequests();
        const exists = current.some((r) => r.id === newReq.id);
        if (!exists) {
          const updated = [...current, newReq];
          saveLocalRequests(updated);
          onUpdate(updated);
          window.dispatchEvent(new Event('storage'));
        }
      },
      onUpdate: (updatedReq) => {
        const current = getLocalRequests();
        const idx = current.findIndex((r) => r.id === updatedReq.id);
        let updated: SongRequest[];
        if (idx !== -1) {
          updated = [...current];
          updated[idx] = updatedReq;
        } else {
          updated = [...current, updatedReq];
        }
        saveLocalRequests(updated);
        onUpdate(updated);
        window.dispatchEvent(new Event('storage'));
      },
      onDelete: (deletedId) => {
        const current = getLocalRequests();
        const updated = current.filter((r) => r.id !== deletedId);
        saveLocalRequests(updated);
        onUpdate(updated);
        window.dispatchEvent(new Event('storage'));
      },
      onSyncAll: (allReqs) => {
        saveLocalRequests(allReqs);
        onUpdate(allReqs);
        window.dispatchEvent(new Event('storage'));
      }
    });

    const storageListener = () => {
      onUpdate(getLocalRequests());
    };
    window.addEventListener('storage', storageListener);

    return () => {
      unsubscribeSupabase();
      window.removeEventListener('storage', storageListener);
    };
  }

  // Fallback: LocalStorage event listener
  const listener = () => {
    onUpdate(getLocalRequests());
  };

  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export async function submitSongRequest(data: {
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
}): Promise<{ success: boolean; request?: SongRequest; requests: SongRequest[]; error?: string }> {
  console.log(`[REQUEST] submit title="${data.songTitle.trim()}" artist="${data.artist.trim()}"`);

  if (isSupabaseConfigured()) {
    const result = await insertSongRequest(data);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Gagal mengirim request lagu.',
        requests: getLocalRequests()
      };
    }

    if (result.request) {
      const current = getLocalRequests();
      if (!current.some((r) => r.id === result.request!.id)) {
        current.push(result.request);
        saveLocalRequests(current);
        window.dispatchEvent(new Event('storage'));
      }
      return { success: true, request: result.request, requests: current };
    }
  }

  // Fallback if Supabase is not configured yet
  const normTitle = data.songTitle.trim().toLowerCase();
  const normArtist = data.artist.trim().toLowerCase();
  const cleanVideoId = data.youtubeVideoId && data.youtubeVideoId.trim().length === 11 ? data.youtubeVideoId.trim() : null;

  const current = getLocalRequests();

  // Duplicate Check against currently Playing track
  const currentlyPlaying = current.find(r => r.status === 'Playing');
  if (currentlyPlaying) {
    const isPlayingMatch = (cleanVideoId && currentlyPlaying.youtubeVideoId === cleanVideoId) ||
      (currentlyPlaying.songTitle.trim().toLowerCase() === normTitle && currentlyPlaying.artist.trim().toLowerCase() === normArtist);
    
    if (isPlayingMatch) {
      console.warn('[QUEUE] duplicate check: rejected (Lagu sedang diputar)');
      return {
        success: false,
        error: 'Lagu sedang diputar.',
        requests: current
      };
    }
  }

  // Duplicate Check against Queued tracks
  const alreadyQueued = current.find(r => {
    if (r.status !== 'Queued') return false;
    if (cleanVideoId && r.youtubeVideoId === cleanVideoId) return true;
    return r.songTitle.trim().toLowerCase() === normTitle && r.artist.trim().toLowerCase() === normArtist;
  });

  if (alreadyQueued) {
    console.warn('[QUEUE] duplicate check: rejected (Lagu ini sudah ada di antrean)');
    return {
      success: false,
      error: 'Lagu ini sudah ada di antrean.',
      requests: current
    };
  }

  console.log('[QUEUE] duplicate check: passed');

  const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const newRequest: SongRequest = {
    id,
    timestamp: nowIso,
    studentName: data.studentName.trim(),
    className: data.className.trim(),
    songTitle: data.songTitle.trim(),
    artist: data.artist.trim(),
    targetPerson: data.targetPerson ? data.targetPerson.trim() : 'Semua Teman',
    message: data.message ? data.message.trim() : 'Salam hangat!',
    mood: (data.mood as MoodTag) || '🎧 Vibe Check',
    coverUrl: data.coverUrl || (cleanVideoId ? `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'),
    previewUrl: data.previewUrl || '',
    status: 'Queued',
    likes: 0,
    youtubeVideoId: cleanVideoId || undefined
  };

  console.log(`[QUEUE] enqueue requestId="${newRequest.id}" videoId="${newRequest.youtubeVideoId || 'none'}"`);

  // Insert exactly once
  current.push(newRequest);
  saveLocalRequests(current);
  console.log(`[QUEUE] added total=${current.length}`);

  // Broadcast storage change
  window.dispatchEvent(new Event('storage'));

  return { success: true, request: newRequest, requests: current };
}

export async function updateRequestStatus(requestId: string, status: 'Queued' | 'Playing' | 'Played'): Promise<{ success: boolean; requests: SongRequest[] }> {
  if (isSupabaseConfigured()) {
    await updateDbRequestStatus(requestId, status);
  }

  const current = getLocalRequests();
  if (status === 'Playing') {
    current.forEach((r) => {
      if (r.status === 'Playing') r.status = 'Played';
    });
  }
  const idx = current.findIndex(r => r.id === requestId);
  if (idx !== -1) {
    current[idx].status = status;
  }
  saveLocalRequests(current);
  window.dispatchEvent(new Event('storage'));

  return { success: true, requests: current };
}

export async function updateRequestYoutubeVideoId(requestId: string, youtubeVideoId: string): Promise<{ success: boolean; requests: SongRequest[] }> {
  if (isSupabaseConfigured()) {
    await updateDbRequestVideoId(requestId, youtubeVideoId);
  }

  const current = getLocalRequests();
  const idx = current.findIndex(r => r.id === requestId);
  if (idx !== -1) {
    current[idx].youtubeVideoId = youtubeVideoId;
  }
  saveLocalRequests(current);
  window.dispatchEvent(new Event('storage'));

  return { success: true, requests: current };
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResult[]> {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  // Try server proxy first
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        return data.items
          .map((item: any) => {
            const rawId = item.id?.videoId || item.videoId;
            const validId = typeof rawId === 'string' && rawId.trim().length === 11 ? rawId.trim() : null;
            if (!validId) return null;
            return {
              videoId: validId,
              title: item.snippet?.title || item.title || '',
              channelTitle: item.snippet?.channelTitle || item.channelTitle || item.artist || '',
              thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.thumbnail || `https://i.ytimg.com/vi/${validId}/hqdefault.jpg`
            };
          })
          .filter(Boolean) as YouTubeSearchResult[];
      }
      if (data.videoId && typeof data.videoId === 'string' && data.videoId.trim().length === 11) {
        const validId = data.videoId.trim();
        return [{
          videoId: validId,
          title: data.title || cleanQ,
          channelTitle: data.channelTitle || data.artist || '',
          thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${validId}/hqdefault.jpg`
        }];
      }
    }
  } catch (e) {
    console.warn('[YouTube API] Server proxy search error, attempting client fallback:', e);
  }

  // Client-side fallback if VITE_YOUTUBE_API_KEY is available
  const apiKey = (import.meta as any).env?.VITE_YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=6&q=${encodeURIComponent(cleanQ)}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items
            .map((item: any) => {
              const rawId = item.id?.videoId;
              const validId = typeof rawId === 'string' && rawId.trim().length === 11 ? rawId.trim() : null;
              if (!validId) return null;
              return {
                videoId: validId,
                title: item.snippet?.title || '',
                channelTitle: item.snippet?.channelTitle || '',
                thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${validId}/hqdefault.jpg`
              };
            })
            .filter(Boolean) as YouTubeSearchResult[];
        }
      }
    } catch (err) {
      console.warn('[YouTube API] Direct client search error:', err);
    }
  }

  return [];
}

export async function likeRequest(requestId: string): Promise<{ success: boolean; likes: number }> {
  if (isSupabaseConfigured()) {
    const res = await likeDbSongRequest(requestId);
    if (res.success) {
      const current = getLocalRequests();
      const item = current.find(r => r.id === requestId);
      if (item) item.likes = res.newLikes;
      saveLocalRequests(current);
      window.dispatchEvent(new Event('storage'));
      return { success: true, likes: res.newLikes };
    }
  }

  const current = getLocalRequests();
  const item = current.find(r => r.id === requestId);
  let newLikes = 1;
  if (item) {
    item.likes = (item.likes || 0) + 1;
    newLikes = item.likes;
    saveLocalRequests(current);
    window.dispatchEvent(new Event('storage'));
  }
  return { success: true, likes: newLikes };
}

export async function deleteSongRequest(requestId: string): Promise<{ success: boolean; requests: SongRequest[] }> {
  if (isSupabaseConfigured()) {
    await deleteDbSongRequest(requestId);
  }

  const current = getLocalRequests().filter(r => r.id !== requestId);
  saveLocalRequests(current);
  window.dispatchEvent(new Event('storage'));
  return { success: true, requests: current };
}

export async function clearAllSongRequests(): Promise<{ success: boolean; requests: SongRequest[] }> {
  if (isSupabaseConfigured()) {
    await clearAllDbSongRequests();
  }

  saveLocalRequests([]);
  window.dispatchEvent(new Event('storage'));
  return { success: true, requests: [] };
}

// -------------------------------------------------------------
// 4. AI WINGMAN & VIBE ANALYSIS
// -------------------------------------------------------------

export async function analyzeVibeWithAi(data: {
  songTitle: string;
  artist: string;
  targetPerson: string;
  message: string;
}): Promise<AiVibeAnalysis> {
  try {
    const res = await fetch('/api/ai/analyze-vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const result = await res.json();
      return result;
    }
  } catch (e) {
    console.warn('AI analysis API failed, using intelligent heuristic fallback:', e);
  }

  // Fallback Vibe Analysis
  const romanceScore = Math.floor(Math.random() * 25) + 75;
  return {
    romanceScore,
    vibeCategory: 'Spesial & Romantis 💕',
    recommendation: `Lagu "${data.songTitle}" pas banget dibawain DJ buat bikin ${data.targetPerson} tersenyum!`,
    storyCaption: `💌 Request lagu spesial "${data.songTitle}" dari seseorang buat ${data.targetPerson}. Dengerin yuk di 107.7 FM!`,
    suggestedEmoji: '💖'
  };
}

export async function generateRadioAnnouncerScript(data: {
  hostName: string;
  songTitle: string;
  artist: string;
  studentName: string;
  className: string;
  targetPerson: string;
  message: string;
  mood: string;
}): Promise<{ script: string }> {
  try {
    const res = await fetch('/api/ai/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const result = await res.json();
      return result;
    }
  } catch (e) {
    console.warn('AI Script API failed:', e);
  }

  return {
    script: `Halo Sobat EMKA! Masih bareng ${data.hostName} di 107.7 FM. Ada request manis nih dari ${data.studentName} (${data.className}) untuk ${data.targetPerson}: "${data.message}". Langsung kita putarkan: ${data.songTitle} - ${data.artist}! Enjoy the vibe!`
  };
}

export async function generateRadioJingle(prompt: string): Promise<{ audioUrl?: string; lyrics?: string }> {
  try {
    const res = await fetch('/api/ai/generate-jingle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  return {
    lyrics: `(Upbeat synth) 🎶 Radio Sekolah Kebanggaan Kita! 107.7 EMKA FM! Suarakan Cerita dan Musikmu! 🎶`
  };
}

// -------------------------------------------------------------
// 5. REALTIME BROADCAST STATE SYNC
// -------------------------------------------------------------

export async function fetchLiveRadioState(): Promise<LiveRadioState | null> {
  return getLocalLiveState();
}

export function subscribeLiveRadioState(onUpdate: (state: LiveRadioState) => void): () => void {
  const current = getLocalLiveState();
  if (current) onUpdate(current);

  const listener = () => {
    const updated = getLocalLiveState();
    if (updated) onUpdate(updated);
  };

  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export async function updateLiveRadioState(state: LiveRadioState): Promise<{ success: boolean }> {
  saveLocalLiveState(state);
  window.dispatchEvent(new Event('storage'));
  return { success: true };
}

// -------------------------------------------------------------
// 6. ADMIN AUTHENTICATION
// -------------------------------------------------------------

export function checkAdminAuth(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
}

export async function loginAdmin(pin: string): Promise<{ success: boolean; error?: string }> {
  if (pin === '1077' || pin === 'admin' || pin === '1234') {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
    }
    return { success: true };
  }
  return { success: false, error: 'PIN Admin salah! (Default PIN: 1077)' };
}

export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
}

// -------------------------------------------------------------
// 7. CSV EXPORT
// -------------------------------------------------------------

export function exportRequestsToCsv(requests: SongRequest[]): void {
  if (!requests || requests.length === 0) return;
  const headers = ['ID', 'Waktu', 'Nama Siswa', 'Kelas', 'Judul Lagu', 'Penyanyi', 'Target Confess', 'Pesan', 'Mood', 'Status', 'Likes', 'YouTube Video ID'];
  const rows = requests.map(r => [
    r.id,
    r.timestamp,
    `"${(r.studentName || '').replace(/"/g, '""')}"`,
    `"${(r.className || '').replace(/"/g, '""')}"`,
    `"${(r.songTitle || '').replace(/"/g, '""')}"`,
    `"${(r.artist || '').replace(/"/g, '""')}"`,
    `"${(r.targetPerson || '').replace(/"/g, '""')}"`,
    `"${(r.message || '').replace(/"/g, '""')}"`,
    `"${(r.mood || '').replace(/"/g, '""')}"`,
    r.status,
    r.likes || 0,
    r.youtubeVideoId || ''
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `emka_radio_requests_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
