import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AdzanSettings,
  PrayerSchedule,
  PrayerKey,
  PRAYER_DISPLAY_NAMES,
  getAdzanSettings,
  fetchMedanPrayerSchedule,
  getPrayerAudioUrl
} from '../services/adzanService';
import { useRadioEngine } from '../contexts/RadioEngineContext';

export interface NextPrayerInfo {
  key: PrayerKey;
  name: string;
  time: string;
  diffMinutes: number;
  diffSeconds: number;
  formattedCountdown: string;
}

export function useAdzanScheduler() {
  const { pauseForAdzan, resumeAfterAdzan } = useRadioEngine();

  const [settings, setSettings] = useState<AdzanSettings | null>(null);
  const [schedule, setSchedule] = useState<PrayerSchedule | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [isBroadcastingAdzan, setIsBroadcastingAdzan] = useState<boolean>(false);
  const [activePrayer, setActivePrayer] = useState<PrayerKey | null>(null);
  const [nextPrayer, setNextPrayer] = useState<NextPrayerInfo | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(1);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasRadioPlayingRef = useRef<boolean>(false);
  const playedTodayRef = useRef<Set<string>>(new Set());
  const activePrayerRef = useRef<PrayerKey | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);
  const settingsRef = useRef<AdzanSettings | null>(null);

  // Keep ref synchronized
  useEffect(() => {
    activePrayerRef.current = activePrayer;
  }, [activePrayer]);

  useEffect(() => {
    isBroadcastingRef.current = isBroadcastingAdzan;
  }, [isBroadcastingAdzan]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load initial settings and prayer schedule
  const reloadSettings = useCallback(async () => {
    try {
      const s = await getAdzanSettings();
      setSettings(s);
      settingsRef.current = s;
    } catch (err) {
      console.warn('[ADZAN HOOK] Error loading settings:', err);
    }
  }, []);

  const refreshSchedule = useCallback(async () => {
    try {
      const sch = await fetchMedanPrayerSchedule();
      setSchedule(sch);
    } catch (err) {
      console.warn('[ADZAN HOOK] Error fetching schedule:', err);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
    refreshSchedule();
    setIsLoaded(true);
  }, [reloadSettings, refreshSchedule]);

  // Setup independent HTML5 Audio Element for Adzan
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration && audio.duration > 0) {
        setAudioCurrentTime(audio.currentTime);
        setAudioDuration(audio.duration);
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      console.log('[ADZAN HOOK] Adzan playback ended naturally.');
      setIsBroadcastingAdzan(false);
      setActivePrayer(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);

      // Restore radio if it was playing beforehand
      if (wasRadioPlayingRef.current) {
        console.log('[ADZAN HOOK] Resuming radio playback after Adzan...');
        resumeAfterAdzan();
        wasRadioPlayingRef.current = false;
      }
    };

    const handleError = (e: any) => {
      console.warn('[ADZAN HOOK] Audio element playback error:', e);
      setIsBroadcastingAdzan(false);
      setActivePrayer(null);
      if (wasRadioPlayingRef.current) {
        resumeAfterAdzan();
        wasRadioPlayingRef.current = false;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, [resumeAfterAdzan]);

  // Stop current Adzan broadcast
  const stopAdzan = useCallback(() => {
    console.log('[ADZAN HOOK] Stop Adzan triggered');
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setIsBroadcastingAdzan(false);
    setActivePrayer(null);
    setAudioProgress(0);
    setAudioCurrentTime(0);

    if (wasRadioPlayingRef.current) {
      console.log('[ADZAN HOOK] Resuming radio after manual stop...');
      resumeAfterAdzan();
      wasRadioPlayingRef.current = false;
    }
  }, [resumeAfterAdzan]);

  // Play Adzan audio for specific prayer
  const playAdzan = useCallback((prayer: PrayerKey, isPreview: boolean = false) => {
    const curSettings = settingsRef.current;
    if (!curSettings) return;

    if (!isPreview && !curSettings.is_active) {
      console.log('[ADZAN HOOK] Adzan is currently disabled in settings.');
      return;
    }

    console.log(`[ADZAN BROADCAST] Starting Adzan broadcast for ${prayer.toUpperCase()} (Medan)`);

    // 1. Check if radio is playing and pause it
    const wasPlaying = pauseForAdzan();
    if (wasPlaying) {
      wasRadioPlayingRef.current = true;
    }

    // 2. Resolve audio URL
    const audioUrl = getPrayerAudioUrl(curSettings, prayer);

    if (audioRef.current) {
      const audio = audioRef.current;
      audio.src = audioUrl;
      audio.volume = audioVolume;
      audio.muted = isAudioMuted;

      setIsBroadcastingAdzan(true);
      setActivePrayer(prayer);
      setAutoplayBlocked(false);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[ADZAN HOOK] Autoplay prevented by browser policy:', err);
          setAutoplayBlocked(true);
        });
      }
    }
  }, [audioVolume, isAudioMuted, pauseForAdzan]);

  // Unlock audio context for browsers that require user gesture
  const unlockAudio = useCallback(() => {
    if (audioRef.current) {
      setAutoplayBlocked(false);
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const toggleAudioMute = useCallback(() => {
    if (audioRef.current) {
      const nextMuted = !isAudioMuted;
      audioRef.current.muted = nextMuted;
      setIsAudioMuted(nextMuted);
    }
  }, [isAudioMuted]);

  const setCustomAudioVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setAudioVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  // 1-second interval scheduler: checks current time & triggers Adzan
  useEffect(() => {
    if (!schedule) return;

    const interval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const currentHHmm = `${hours}:${minutes}`;
      const currentHHmmss = `${hours}:${minutes}:${seconds}`;
      setCurrentTimeStr(currentHHmmss);

      const todayStr = schedule.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Calculate next prayer countdown
      const prayerList: { key: PrayerKey; name: string; time: string }[] = [
        { key: 'subuh', name: PRAYER_DISPLAY_NAMES.subuh, time: schedule.subuh },
        { key: 'dzuhur', name: PRAYER_DISPLAY_NAMES.dzuhur, time: schedule.dzuhur },
        { key: 'ashar', name: PRAYER_DISPLAY_NAMES.ashar, time: schedule.ashar },
        { key: 'maghrib', name: PRAYER_DISPLAY_NAMES.maghrib, time: schedule.maghrib },
        { key: 'isya', name: PRAYER_DISPLAY_NAMES.isya, time: schedule.isya }
      ];

      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      const currentTotalSeconds = currentTotalMinutes * 60 + now.getSeconds();

      let nextFound: NextPrayerInfo | null = null;

      for (const p of prayerList) {
        const [pHour, pMin] = p.time.split(':').map(Number);
        const pTotalMinutes = pHour * 60 + pMin;
        const pTotalSeconds = pTotalMinutes * 60;

        if (pTotalSeconds > currentTotalSeconds) {
          const diffSec = pTotalSeconds - currentTotalSeconds;
          const diffMin = Math.floor(diffSec / 60);
          const remSec = diffSec % 60;
          const formatted = diffMin > 60
            ? `${Math.floor(diffMin / 60)}j ${diffMin % 60}m`
            : `${diffMin}m ${remSec}s`;

          nextFound = {
            key: p.key,
            name: p.name,
            time: p.time,
            diffMinutes: diffMin,
            diffSeconds: diffSec,
            formattedCountdown: formatted
          };
          break;
        }
      }

      // If all prayers today passed, next is tomorrow's Subuh
      if (!nextFound) {
        const [sHour, sMin] = schedule.subuh.split(':').map(Number);
        const tomorrowSubuhSeconds = (24 * 60 * 60) - currentTotalSeconds + (sHour * 60 + sMin) * 60;
        const diffMin = Math.floor(tomorrowSubuhSeconds / 60);
        const remSec = tomorrowSubuhSeconds % 60;
        const formatted = diffMin > 60
          ? `${Math.floor(diffMin / 60)}j ${diffMin % 60}m`
          : `${diffMin}m ${remSec}s`;

        nextFound = {
          key: 'subuh',
          name: PRAYER_DISPLAY_NAMES.subuh,
          time: schedule.subuh,
          diffMinutes: diffMin,
          diffSeconds: tomorrowSubuhSeconds,
          formattedCountdown: formatted
        };
      }

      setNextPrayer(nextFound);

      // 2. Trigger automatic Adzan if time matches and enabled
      if (settingsRef.current?.is_active && !isBroadcastingRef.current) {
        for (const p of prayerList) {
          if (p.time === currentHHmm) {
            const playKey = `${todayStr}_${p.key}`;
            if (!playedTodayRef.current.has(playKey)) {
              playedTodayRef.current.add(playKey);
              playAdzan(p.key);
              break;
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [schedule, playAdzan]);

  return {
    settings,
    schedule,
    isLoaded,
    currentTimeStr,
    isBroadcastingAdzan,
    activePrayer,
    nextPrayer,
    audioProgress,
    audioDuration,
    audioCurrentTime,
    isAudioMuted,
    audioVolume,
    autoplayBlocked,
    playAdzan,
    stopAdzan,
    unlockAudio,
    toggleAudioMute,
    setAudioVolume: setCustomAudioVolume,
    reloadSettings,
    refreshSchedule
  };
}
