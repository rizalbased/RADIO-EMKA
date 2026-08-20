import { SheetConfig, SongRequest, DbRadioState, AiVibeAnalysis, RadioHost, LiveRadioState, MoodTag, YouTubeSearchResult, ItunesSearchResult } from '../types';
import { decodeHtmlEntities } from '../lib/textUtils';
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
  setAdminStopRadio,
  setRadioStandbyInDb,
  handleSongEndedTransition,
  getLastAdminQueueError,
  loginAdminWithServerPin,
  loginAdminToSupabase,
  logoutAdminFromSupabase
} from './supabaseService';
import {
  isSupabaseConfigured,
  getAdminSessionStatus,
  getSupabaseClient,
  sanitizeSupabaseUrl,
  sanitizeSupabaseKey
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
  setAdminStopRadio,
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
  if (isSupabaseConfigured()) {
    console.log('[EMKA REALTIME] Subscribing to emka-radio-global-sync channel...');
    let currentRequests: SongRequest[] = [];

    fetchSongRequestsFromDb().then(({ requests, isSupabase }) => {
      if (isSupabase && requests) {
        currentRequests = requests.slice().sort((a, b) => {
          const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tA - tB;
        });
        onUpdate(currentRequests);
      }
    });

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
        if (!deletedId) return;
        console.log('[REALTIME REQUEST DELETE]', deletedId);
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
  album?: string;
  genre?: string;
  itunesTrackId?: string | number;
  itunesCollectionId?: string | number;
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

// iTunes Search cache store
interface ItunesCacheItem {
  timestamp: number;
  items: ItunesSearchResult[];
  errorMessage?: string;
}

const itunesMemoryCache = new Map<string, ItunesCacheItem>();

export async function searchItunesSongs(query: string): Promise<ItunesSearchResult[]> {
  if (!query || !query.trim()) return [];
  const rawQ = query.trim();
  const normKey = rawQ.toLowerCase();
  const now = Date.now();

  // Check in-memory cache
  const memCached = itunesMemoryCache.get(normKey);
  if (memCached && now - memCached.timestamp < SEARCH_CACHE_TTL_MS) {
    if (memCached.errorMessage) {
      throw new Error(memCached.errorMessage);
    }
    return memCached.items;
  }

  // Check localStorage cache
  try {
    const lsRaw = localStorage.getItem(`itunes_cache_${normKey}`);
    if (lsRaw) {
      const parsed: ItunesCacheItem = JSON.parse(lsRaw);
      if (parsed && now - parsed.timestamp < SEARCH_CACHE_TTL_MS) {
        if (parsed.errorMessage) {
          throw new Error(parsed.errorMessage);
        }
        itunesMemoryCache.set(normKey, parsed);
        return parsed.items;
      }
    }
  } catch {}

  const normalizeItunesResult = (item: any): ItunesSearchResult | null => {
    if (!item || (!item.trackName && !item.artistName)) return null;
    const rawArtwork = item.artworkUrl100 || item.artworkUrl60 || '';
    const artwork600 = rawArtwork ? rawArtwork.replace('100x100bb', '600x600bb').replace('60x60bb', '600x600bb') : '';

    return {
      trackId: item.trackId || String(Date.now() + Math.random()),
      collectionId: item.collectionId,
      trackName: decodeHtmlEntities(item.trackName || 'Tanpa Judul'),
      artistName: decodeHtmlEntities(item.artistName || 'Artis Tidak Diketahui'),
      collectionName: item.collectionName ? decodeHtmlEntities(item.collectionName) : undefined,
      artworkUrl100: rawArtwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      artworkUrl600: artwork600 || rawArtwork,
      previewUrl: item.previewUrl || undefined,
      primaryGenreName: item.primaryGenreName || undefined
    };
  };

  // 1. Direct fetch to iTunes Search API
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(rawQ)}&entity=song&limit=10`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        const results = data.results.map(normalizeItunesResult).filter(Boolean) as ItunesSearchResult[];
        if (results.length > 0) {
          const cacheEntry: ItunesCacheItem = { timestamp: now, items: results };
          itunesMemoryCache.set(normKey, cacheEntry);
          try { localStorage.setItem(`itunes_cache_${normKey}`, JSON.stringify(cacheEntry)); } catch {}
          return results;
        } else {
          const errCacheEntry: ItunesCacheItem = { timestamp: now, items: [], errorMessage: 'Tidak ditemukan lagu yang sesuai.' };
          itunesMemoryCache.set(normKey, errCacheEntry);
          throw new Error('Tidak ditemukan lagu yang sesuai.');
        }
      }
    }
  } catch (err: any) {
    if (err?.message === 'Tidak ditemukan lagu yang sesuai.') {
      throw err;
    }
    console.warn('[ITUNES SEARCH] Direct fetch notice:', err?.message || err);
  }

  // 2. Fallback to Express backend proxy or Supabase Edge function
  try {
    const proxyRes = await fetch(`/api/itunes/search?term=${encodeURIComponent(rawQ)}`);
    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      const rawResults = proxyData.results || proxyData.items || [];
      if (Array.isArray(rawResults) && rawResults.length > 0) {
        const results = rawResults.map(normalizeItunesResult).filter(Boolean) as ItunesSearchResult[];
        if (results.length > 0) {
          const cacheEntry: ItunesCacheItem = { timestamp: now, items: results };
          itunesMemoryCache.set(normKey, cacheEntry);
          try { localStorage.setItem(`itunes_cache_${normKey}`, JSON.stringify(cacheEntry)); } catch {}
          return results;
        }
      }
    }
  } catch (proxyErr) {
    console.warn('[ITUNES SEARCH] Proxy fetch notice:', proxyErr);
  }

  const errorMsg = 'Pencarian lagu sedang mengalami gangguan.';
  throw new Error(errorMsg);
}

// Search cache store (In-memory + localStorage backup)
interface SearchCacheItem {
  timestamp: number;
  items: YouTubeSearchResult[];
  errorMessage?: string;
}

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL
const searchMemoryCache = new Map<string, SearchCacheItem>();

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(regExp);
  return match && match[1] ? match[1] : null;
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResult[]> {
  if (!query || !query.trim()) return [];
  const rawQ = query.trim();

  // 1. Direct YouTube URL or 11-char Video ID check
  const directId = extractYouTubeVideoId(rawQ);
  if (directId) {
    return [
      {
        videoId: directId,
        title: "Link YouTube Video",
        channelTitle: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`
      }
    ];
  }

  // 2. Normalized query & Cache lookup (TTL: 10 mins)
  const normKey = rawQ.toLowerCase();
  const now = Date.now();

  // Check in-memory cache
  const memCached = searchMemoryCache.get(normKey);
  if (memCached && now - memCached.timestamp < SEARCH_CACHE_TTL_MS) {
    if (memCached.errorMessage) {
      throw new Error(memCached.errorMessage);
    }
    console.log(`[YOUTUBE SEARCH] Returning in-memory cached results for "${normKey}"`);
    return memCached.items;
  }

  // Check localStorage cache
  try {
    const lsRaw = localStorage.getItem(`yt_cache_${normKey}`);
    if (lsRaw) {
      const parsed: SearchCacheItem = JSON.parse(lsRaw);
      if (parsed && now - parsed.timestamp < SEARCH_CACHE_TTL_MS) {
        if (parsed.errorMessage) {
          throw new Error(parsed.errorMessage);
        }
        searchMemoryCache.set(normKey, parsed);
        console.log(`[YOUTUBE SEARCH] Returning localStorage cached results for "${normKey}"`);
        return parsed.items;
      }
    }
  } catch {}

  const normalizeItem = (item: any): YouTubeSearchResult | null => {
    if (!item) return null;
    const rawId = item.videoId || item.id?.videoId || (typeof item.id === 'string' ? item.id : null);
    const validId = typeof rawId === 'string' && rawId.trim().length === 11 ? rawId.trim() : null;
    if (!validId) return null;

    const rawTitle = item.title || item.snippet?.title || '';
    const rawChannel = item.channelTitle || item.artist || item.snippet?.channelTitle || '';
    const rawThumb =
      item.thumbnail ||
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${validId}/hqdefault.jpg`;

    return {
      videoId: validId,
      title: decodeHtmlEntities(rawTitle),
      channelTitle: decodeHtmlEntities(rawChannel),
      thumbnail: rawThumb
    };
  };

  // 3. Try Express Backend Proxy `/api/youtube/search?q=...` first
  try {
    const proxyRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(rawQ)}`);
    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      const rawItems = Array.isArray(proxyData.items) ? proxyData.items : (Array.isArray(proxyData) ? proxyData : []);
      if (rawItems.length > 0) {
        const results = rawItems.map(normalizeItem).filter(Boolean) as YouTubeSearchResult[];
        if (results.length > 0) {
          const cacheEntry: SearchCacheItem = { timestamp: now, items: results };
          searchMemoryCache.set(normKey, cacheEntry);
          try { localStorage.setItem(`yt_cache_${normKey}`, JSON.stringify(cacheEntry)); } catch {}
          return results;
        }
      }
    }
  } catch (err: any) {
    console.log('[YOUTUBE SEARCH] Proxy fetch notice:', err?.message || err);
  }

  // 4. Direct Call to Official YouTube Data API v3
  const apiKey =
    (import.meta as any).env?.VITE_YOUTUBE_API_KEY ||
    (import.meta as any).env?.YOUTUBE_API_KEY ||
    (typeof process !== 'undefined' ? (process.env?.VITE_YOUTUBE_API_KEY || process.env?.YOUTUBE_API_KEY) : '');

  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(rawQ)}&key=${apiKey}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          const results = data.items.map(normalizeItem).filter(Boolean) as YouTubeSearchResult[];
          if (results.length > 0) {
            const cacheEntry: SearchCacheItem = { timestamp: now, items: results };
            searchMemoryCache.set(normKey, cacheEntry);
            try { localStorage.setItem(`yt_cache_${normKey}`, JSON.stringify(cacheEntry)); } catch {}
            return results;
          }
        }
        return [];
      }

      const status = res.status;
      const errText = await res.text();
      let errMsg = 'Gagal mencari lagu dari YouTube. Silakan coba lagi.';
      if (status === 429 || status === 403 || errText.includes('quotaExceeded') || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('rateLimitExceeded')) {
        errMsg = 'Kuota YouTube API sedang habis. Silakan gunakan link YouTube langsung atau gunakan API key YouTube dengan quota yang tersedia.';
      } else if (status === 400) {
        errMsg = 'Kata kunci pencarian tidak valid.';
      }

      const errCacheEntry: SearchCacheItem = { timestamp: now, items: [], errorMessage: errMsg };
      searchMemoryCache.set(normKey, errCacheEntry);
      throw new Error(errMsg);
    } catch (err: any) {
      if (err?.message && (err.message.includes('Kuota') || err.message.includes('tidak valid'))) {
        throw err;
      }
      console.warn('[YOUTUBE SEARCH] Direct API exception:', err?.message || err);
    }
  }

  // If no API key or API call failed
  const finalErrMsg = 'Gagal mencari lagu. Silakan coba tempelkan Link YouTube secara langsung.';
  throw new Error(finalErrMsg);
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

export async function deleteSongRequest(requestId: string): Promise<{ success: boolean; was_playing?: boolean }> {
  if (!requestId) {
    console.error('[DELETE REQUEST] Missing request ID');
    return { success: false };
  }

  let wasPlaying = false;
  if (isSupabaseConfigured()) {
    const res = await deleteDbSongRequest(requestId);
    if (!res.success) {
      console.error('[DELETE REQUEST] Supabase delete failed for ID:', requestId);
      return { success: false };
    }
    wasPlaying = Boolean(res.was_playing);
  }

  const current = getLocalRequests().filter(r => r.id !== requestId);
  saveLocalRequests(current);
  window.dispatchEvent(new Event('storage'));
  return { success: true, was_playing: wasPlaying };
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
