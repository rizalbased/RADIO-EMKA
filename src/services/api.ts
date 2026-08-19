import { SheetConfig, SongRequest, DbRadioState, AiVibeAnalysis, RadioHost, LiveRadioState, MoodTag, YouTubeSearchResult } from '../types';
import {
  fetchSongRequestsFromDb,
  subscribeToSongRequests,
  insertSongRequest,
  updateDbRequestStatus,
  deleteDbSongRequest,
  clearAllDbSongRequests,
  likeDbSongRequest,
  updateDbRequestVideoId,
  fetchRadioStateFromDb,
  updateRadioStateInDb,
  setAdminPlaySong,
  setAdminPauseRadio,
  setAdminResumeRadio,
  setRadioStandbyInDb,
  handleSongEndedTransition,
  getLastAdminQueueError,
  loginAdminWithServerPin,
  loginAdminToSupabase,
  logoutAdminFromSupabase
} from './supabaseService';
import {
  isSupabaseConfigured,
  getAdminSessionStatus
} from '../lib/supabaseClient';

export {
  getLastAdminQueueError,
  getAdminSessionStatus,
  loginAdminToSupabase,
  logoutAdminFromSupabase,
  loginAdminWithServerPin,
  fetchRadioStateFromDb,
  updateRadioStateInDb,
  setAdminPlaySong,
  setAdminPauseRadio,
  setAdminResumeRadio,
  setRadioStandbyInDb,
  handleSongEndedTransition
};

// LocalStorage Keys for UI preferences and local caching
const STORAGE_KEYS = {
  REQUESTS: 'emka_radio_requests',
  HOSTS: 'emka_radio_hosts',
  CONFIG: 'emka_sheet_config',
  LIVE_STATE: 'emka_live_state',
  ADMIN_AUTH: 'emka_admin_auth'
};

// In-memory global state cache for synchronized UI
let globalRequestsMemory: SongRequest[] = [];

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
  return globalRequestsMemory;
}

export function saveLocalRequests(requests: SongRequest[]) {
  globalRequestsMemory = requests;
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
    if (isSupabase) {
      return { requests: requests || [], synced: true };
    }
  }
  return { requests: [], synced: false };
}

export function subscribeSongRequests(
  onUpdate: (requests: SongRequest[]) => void,
  onRadioStateChange?: (state: DbRadioState) => void
): () => void {
  // 1. Fetch initial data from Supabase immediately on mount
  if (isSupabaseConfigured()) {
    fetchSongRequestsFromDb().then(({ requests, isSupabase }) => {
      if (isSupabase) {
        onUpdate(requests || []);
      }
    });
  } else {
    onUpdate([]);
  }

  if (isSupabaseConfigured()) {
    console.log('[EMKA REALTIME] Subscribing to emka-radio-global-sync channel...');
    let currentRequests: SongRequest[] = [];

    const unsubscribeSupabase = subscribeToSongRequests({
      onInsert: (newReq) => {
        if (!currentRequests.some((r) => r.id === newReq.id)) {
          currentRequests = [...currentRequests, newReq].sort((a, b) => {
            const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tA - tB;
          });
          onUpdate(currentRequests);
        }
      },
      onUpdate: (updatedReq) => {
        const idx = currentRequests.findIndex((r) => r.id === updatedReq.id);
        if (idx !== -1) {
          currentRequests[idx] = updatedReq;
        } else {
          currentRequests.push(updatedReq);
        }
        currentRequests.sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tA - tB;
        });
        onUpdate(currentRequests);
      },
      onDelete: (deletedId) => {
        currentRequests = currentRequests.filter((r) => r.id !== deletedId);
        onUpdate(currentRequests);
      },
      onSyncAll: (allReqs) => {
        currentRequests = (allReqs || []).slice().sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tA - tB;
        });
        onUpdate(currentRequests);
      },
      onRadioStateChange: (state) => {
        if (onRadioStateChange) {
          onRadioStateChange(state);
        }
      }
    });

    return () => {
      unsubscribeSupabase();
    };
  }

  return () => {};
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
  console.log(`[EMKA REQUEST] submit title="${data.songTitle.trim()}" artist="${data.artist.trim()}"`);

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase tidak dikonfigurasi.', requests: [] };
  }

  const result = await insertSongRequest(data);
  if (!result.success || !result.request) {
    return {
      success: false,
      error: result.error || 'Gagal mengirim request lagu ke database Supabase.',
      requests: []
    };
  }

  // Fetch latest requests from Supabase DB to ensure state is in sync
  const { requests } = await fetchSongRequestsFromDb();
  return { success: true, request: result.request, requests: requests || [result.request] };
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

  const apiKey = (import.meta as any).env?.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[YouTube API] VITE_YOUTUBE_API_KEY is not configured');
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(cleanQ)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) {
        console.error('[YouTube API Error 400] Bad request or invalid API key.');
      } else if (res.status === 403) {
        console.error('[YouTube API Error 403] Quota exceeded or API key restricted/unauthorized.');
      } else if (res.status === 429) {
        console.error('[YouTube API Error 429] Rate limit exceeded.');
      } else {
        console.error(`[YouTube API Error ${res.status}] Failed to search videos.`);
      }
      return [];
    }

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
  } catch (err) {
    console.warn('[YouTube API] Direct client search exception:', err);
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

export async function loginAdmin(
  pinOrEmail: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  // If email and password provided, log in directly to Supabase Auth
  if (password !== undefined) {
    const res = await loginAdminToSupabase(pinOrEmail, password);
    if (res.success) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
      }
      return { success: true };
    }
    return { success: false, error: res.error || 'Login admin gagal.' };
  }

  // Server-side PIN verification (zero hardcoded PIN on frontend)
  const res = await loginAdminWithServerPin(pinOrEmail);
  if (res.success) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
    }
    return { success: true };
  }

  return { success: false, error: res.error || 'Tidak dapat masuk. PIN salah.' };
}

export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
  logoutAdminFromSupabase().catch(() => {});
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
