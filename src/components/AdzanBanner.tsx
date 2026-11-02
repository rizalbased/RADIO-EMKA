import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Square,
  Sparkles,
  Settings,
  Bell,
  Clock,
  MapPin,
  ChevronRight,
  Radio,
  Play
} from 'lucide-react';
import { PrayerKey, PRAYER_DISPLAY_NAMES } from '../services/adzanService';
import { useAdzanScheduler } from '../hooks/useAdzanScheduler';

interface AdzanBannerProps {
  onOpenSettings?: () => void;
  userRole?: 'user' | 'admin';
  scheduler: ReturnType<typeof useAdzanScheduler>;
}

export const AdzanBanner: React.FC<AdzanBannerProps> = ({
  onOpenSettings,
  userRole = 'user',
  scheduler
}) => {
  const {
    settings,
    schedule,
    currentTimeStr,
    isBroadcastingAdzan,
    activePrayer,
    nextPrayer,
    audioProgress,
    audioDuration,
    audioCurrentTime,
    isAudioMuted,
    autoplayBlocked,
    stopAdzan,
    unlockAudio,
    toggleAudioMute
  } = scheduler;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!schedule) return null;

  const prayers: { key: PrayerKey; name: string; time: string }[] = [
    { key: 'subuh', name: PRAYER_DISPLAY_NAMES.subuh, time: schedule.subuh },
    { key: 'dzuhur', name: PRAYER_DISPLAY_NAMES.dzuhur, time: schedule.dzuhur },
    { key: 'ashar', name: PRAYER_DISPLAY_NAMES.ashar, time: schedule.ashar },
    { key: 'maghrib', name: PRAYER_DISPLAY_NAMES.maghrib, time: schedule.maghrib },
    { key: 'isya', name: PRAYER_DISPLAY_NAMES.isya, time: schedule.isya }
  ];

  const formatAudioTime = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full mb-5 space-y-2 select-none">
      {/* 1. ON-AIR ADZAN BROADCAST BANNER (Appears when Adzan is broadcasting) */}
      {isBroadcastingAdzan && (
        <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/90 border-2 border-emerald-500/70 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Left: Broadcast Notice & Waveform */}
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <div className="relative flex-shrink-0">
                <span className="flex h-3 w-3 absolute -top-1 -right-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-black">
                    SIARAN ADZAN
                  </span>
                  <span className="text-xs font-black text-emerald-300 tracking-wide">
                    {activePrayer ? PRAYER_DISPLAY_NAMES[activePrayer] : 'Sholat'} • Kota Medan
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 font-medium mt-0.5">
                  Radio dijeda otomatis dan akan lanjut berputar setelah adzan selesai berkumandang.
                </p>
              </div>
            </div>

            {/* Right: Audio Playback Controls */}
            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
              {/* Soundwaves */}
              <div className="flex items-center space-x-1 h-5 px-2 bg-black/40 rounded-lg border border-emerald-500/20">
                <span className="w-1 bg-emerald-400 rounded-full h-2 animate-pulse"></span>
                <span className="w-1 bg-emerald-400 rounded-full h-4 animate-pulse delay-75"></span>
                <span className="w-1 bg-emerald-400 rounded-full h-3 animate-pulse delay-150"></span>
                <span className="w-1 bg-emerald-400 rounded-full h-5 animate-pulse delay-100"></span>
                <span className="w-1 bg-emerald-400 rounded-full h-2 animate-pulse delay-200"></span>
              </div>

              {/* Time display */}
              <span className="text-xs font-mono font-bold text-emerald-200 whitespace-nowrap">
                {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
              </span>

              {/* Mute button */}
              <button
                onClick={toggleAudioMute}
                className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 transition border border-emerald-700/40"
                title={isAudioMuted ? 'Bunyikan' : 'Senyapkan'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Stop button */}
              <button
                onClick={stopAdzan}
                className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                title="Hentikan adzan dan lanjutkan radio sekarang"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Lewati</span>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-3 border border-emerald-500/20">
            <div
              className="bg-gradient-to-r from-emerald-500 to-lime-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, audioProgress))}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. AUTOPLAY UNLOCK ALERT (Shows only if browser blocked audio gesture) */}
      {autoplayBlocked && (
        <div className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 px-4 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-amber-400 animate-bounce flex-shrink-0" />
            <span>Browser membatasi audio otomatis. Klik tombol ini agar adzan bersuara:</span>
          </div>
          <button
            onClick={unlockAudio}
            className="px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs hover:bg-amber-400 transition flex items-center space-x-1"
          >
            <Play className="w-3 h-3 fill-black" />
            <span>Aktifkan Audio</span>
          </button>
        </div>
      )}

      {/* 3. MAIN PRAYER SCHEDULE STRIP (Modern, Unboxed, Responsive) */}
      <div className="w-full rounded-2xl bg-card border border-subtle p-3 sm:p-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Left: Location & Clock */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-primary flex-shrink-0">
              <MapPin className="w-4 h-4 text-[#B6FF00]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary font-display">
                  {settings?.city_name || 'Kota Medan'}
                </span>
                <span className="text-secondary text-[10px]">&bull;</span>
                <span className="text-[10px] font-bold text-secondary">
                  WIB (UTC+7)
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-secondary">
                <Clock className="w-3 h-3 text-secondary" />
                <span>{currentTimeStr || '00:00:00'}</span>
                <span className="text-[10px] text-zinc-400 font-sans hidden sm:inline">
                  ({schedule.tanggal})
                </span>
              </div>
            </div>
          </div>

          {/* Center: 5 Prayer Times with clean tabular layout */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 w-full lg:w-auto flex-1 lg:max-w-2xl px-0 lg:px-4">
            {prayers.map((p) => {
              const isNext = nextPrayer?.key === p.key;
              const isActive = activePrayer === p.key && isBroadcastingAdzan;

              return (
                <div
                  key={p.key}
                  className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                      : isNext
                      ? 'bg-[#B6FF00]/10 border border-[#B6FF00]/40 text-primary'
                      : 'bg-elevated/70 border border-subtle/60 text-secondary'
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold tracking-tight ${
                    isActive ? 'text-emerald-400' : isNext ? 'text-[#B6FF00]' : 'text-secondary'
                  }`}>
                    {p.name}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black tracking-tight mt-0.5 text-primary">
                    {p.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: Next Prayer Countdown Badge + Admin Settings Button */}
          <div className="flex items-center justify-between lg:justify-end space-x-2 w-full lg:w-auto flex-shrink-0">
            {nextPrayer && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-elevated border border-subtle text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B6FF00] animate-pulse"></span>
                <span className="font-semibold text-secondary">
                  Menuju <span className="font-bold text-primary">{nextPrayer.name}</span>:
                </span>
                <span className="font-mono font-black text-[#B6FF00]">
                  {nextPrayer.formattedCountdown}
                </span>
              </div>
            )}

            {userRole === 'admin' && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-elevated hover:bg-secondary text-secondary hover:text-primary border border-subtle transition flex items-center space-x-1 text-xs font-bold"
                title="Pengaturan Siaran Adzan Kota Medan"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Set Adzan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
