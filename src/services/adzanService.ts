import { getSupabaseClient } from '../lib/supabaseClient';

export type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

export interface PrayerSchedule {
  tanggal: string;
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  date: string;
}

export interface AdzanSettings {
  id: number;
  city_name: string;
  city_id: string;
  is_active: boolean;
  audio_subuh: string | null;
  audio_dzuhur: string | null;
  audio_ashar: string | null;
  audio_maghrib: string | null;
  audio_isya: string | null;
  updated_at?: string;
}

// High-quality default Adzan audio streams with fallback mirrors
export const DEFAULT_ADZAN_AUDIO: Record<PrayerKey, string> = {
  // Subuh includes 'Ash-shalatu khairum minan-naum'
  subuh: 'https://ia800204.us.archive.org/11/items/AdzanSubuh/AdzanSubuh.mp3',
  dzuhur: 'https://ia800301.us.archive.org/15/items/AdzanMakkah/Adzan%20Makkah.mp3',
  ashar: 'https://ia800301.us.archive.org/15/items/AdzanMakkah/Adzan%20Makkah.mp3',
  maghrib: 'https://ia800301.us.archive.org/15/items/AdzanMakkah/Adzan%20Makkah.mp3',
  isya: 'https://ia800301.us.archive.org/15/items/AdzanMakkah/Adzan%20Makkah.mp3'
};

export const PRAYER_DISPLAY_NAMES: Record<PrayerKey, string> = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya'
};

const DEFAULT_SETTINGS: AdzanSettings = {
  id: 1,
  city_name: 'Kota Medan',
  city_id: '0228',
  is_active: true,
  audio_subuh: null,
  audio_dzuhur: null,
  audio_ashar: null,
  audio_maghrib: null,
  audio_isya: null
};

const LOCAL_STORAGE_SETTINGS_KEY = 'emka_adzan_settings';
const LOCAL_STORAGE_SCHEDULE_KEY_PREFIX = 'emka_adzan_schedule_';

/**
 * Fetch Adzan settings from Supabase (adzan_settings table),
 * falling back gracefully to localStorage or default config.
 */
export async function getAdzanSettings(): Promise<AdzanSettings> {
  const supabase = getSupabaseClient();
  let localBackup: AdzanSettings = DEFAULT_SETTINGS;

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (saved) {
      localBackup = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('[ADZAN] Error reading local settings backup:', err);
  }

  if (!supabase) {
    return localBackup;
  }

  try {
    const { data, error } = await supabase
      .from('adzan_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.warn('[ADZAN] Supabase adzan_settings table query warning:', error.message);
      return localBackup;
    }

    if (data) {
      const merged: AdzanSettings = {
        id: 1,
        city_name: data.city_name || 'Kota Medan',
        city_id: data.city_id || '0228',
        is_active: data.is_active ?? true,
        audio_subuh: data.audio_subuh || null,
        audio_dzuhur: data.audio_dzuhur || null,
        audio_ashar: data.audio_ashar || null,
        audio_maghrib: data.audio_maghrib || null,
        audio_isya: data.audio_isya || null,
        updated_at: data.updated_at
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }

    // Row id=1 doesn't exist yet, insert default
    await supabase.from('adzan_settings').insert([DEFAULT_SETTINGS]);
    return localBackup;
  } catch (err) {
    console.warn('[ADZAN] Fetch settings exception, using fallback:', err);
    return localBackup;
  }
}

/**
 * Update Adzan settings in Supabase and cache locally.
 */
export async function updateAdzanSettings(updates: Partial<AdzanSettings>): Promise<AdzanSettings> {
  const current = await getAdzanSettings();
  const next: AdzanSettings = {
    ...current,
    ...updates,
    id: 1,
    updated_at: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(next));
  } catch {}

  const supabase = getSupabaseClient();
  if (!supabase) {
    return next;
  }

  try {
    const { error } = await supabase
      .from('adzan_settings')
      .upsert({
        id: 1,
        city_name: next.city_name,
        city_id: next.city_id,
        is_active: next.is_active,
        audio_subuh: next.audio_subuh,
        audio_dzuhur: next.audio_dzuhur,
        audio_ashar: next.audio_ashar,
        audio_maghrib: next.audio_maghrib,
        audio_isya: next.audio_isya,
        updated_at: next.updated_at
      });

    if (error) {
      console.warn('[ADZAN] Error upserting adzan_settings in Supabase:', error.message);
    }
  } catch (err) {
    console.warn('[ADZAN] Update settings exception:', err);
  }

  return next;
}

/**
 * Upload Adzan audio file to Supabase Storage bucket 'adzan-audio'.
 * Returns public URL. If storage bucket fails or not configured, falls back
 * to a local Object URL or Data URL and informs caller.
 */
export async function uploadAdzanAudioFile(prayer: PrayerKey, file: File): Promise<{ url: string; isStoredRemotely: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const fileExt = file.name.split('.').pop() || 'mp3';
  const filePath = `${prayer}_${Date.now()}.${fileExt}`;

  if (!supabase) {
    // Generate object URL for immediate session preview
    const localUrl = URL.createObjectURL(file);
    return { url: localUrl, isStoredRemotely: false, error: 'Supabase client belum terhubung.' };
  }

  try {
    // Upload to bucket 'adzan-audio'
    const { error: uploadError } = await supabase.storage
      .from('adzan-audio')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'audio/mpeg'
      });

    if (uploadError) {
      console.warn('[ADZAN STORAGE] Upload error to bucket adzan-audio:', uploadError.message);
      // Fallback to local DataURL or ObjectURL so admin can still use it immediately
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            url: reader.result as string,
            isStoredRemotely: false,
            error: `Bucket 'adzan-audio' belum dibuat di Supabase Storage (${uploadError.message}). Audio disimpan sementara di browser.`
          });
        };
        reader.onerror = () => {
          resolve({
            url: URL.createObjectURL(file),
            isStoredRemotely: false,
            error: uploadError.message
          });
        };
        reader.readAsDataURL(file);
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('adzan-audio')
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      isStoredRemotely: true
    };
  } catch (err: any) {
    console.warn('[ADZAN STORAGE] Exception during audio upload:', err);
    return {
      url: URL.createObjectURL(file),
      isStoredRemotely: false,
      error: err?.message || 'Gagal mengunggah file ke Supabase Storage.'
    };
  }
}

/**
 * Fetch prayer times for Kota Medan (Kode 0228) via MyQuran API v2
 * Endpoint: https://api.myquran.com/v2/sholat/jadwal/0228/{year}/{month}/{day}
 */
export async function fetchMedanPrayerSchedule(targetDate: Date = new Date()): Promise<PrayerSchedule> {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;
  const cacheKey = `${LOCAL_STORAGE_SCHEDULE_KEY_PREFIX}${dateKey}`;

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as PrayerSchedule;
      if (parsed && parsed.subuh && parsed.dzuhur) {
        return parsed;
      }
    }
  } catch {}

  const apiUrl = `https://api.myquran.com/v2/sholat/jadwal/0228/${year}/${month}/${day}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      if (json && json.status && json.data && json.data.jadwal) {
        const j = json.data.jadwal;
        const schedule: PrayerSchedule = {
          tanggal: j.tanggal || `${day}/${month}/${year}`,
          imsak: j.imsak || '04:55',
          subuh: j.subuh || '05:05',
          terbit: j.terbit || '06:18',
          dhuha: j.dhuha || '06:46',
          dzuhur: j.dzuhur || '12:25',
          ashar: j.ashar || '15:45',
          maghrib: j.maghrib || '18:25',
          isya: j.isya || '19:35',
          date: dateKey
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(schedule));
        } catch {}

        return schedule;
      }
    }
  } catch (err) {
    console.warn('[ADZAN API] MyQuran API request error, using standard Medan timings:', err);
  }

  // Realistic fallback schedule for Medan
  const fallbackSchedule: PrayerSchedule = {
    tanggal: targetDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    imsak: '04:55',
    subuh: '05:05',
    terbit: '06:18',
    dhuha: '06:45',
    dzuhur: '12:25',
    ashar: '15:45',
    maghrib: '18:25',
    isya: '19:35',
    date: dateKey
  };

  return fallbackSchedule;
}

/**
 * Helper to determine which audio URL to use for a given prayer
 */
export function getPrayerAudioUrl(settings: AdzanSettings, prayer: PrayerKey): string {
  const custom = settings[`audio_${prayer}` as keyof AdzanSettings];
  if (custom && typeof custom === 'string' && custom.trim().length > 0) {
    return custom;
  }
  return DEFAULT_ADZAN_AUDIO[prayer];
}
