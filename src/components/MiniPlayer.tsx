import React from 'react';
import { useRadioEngine, formatTime } from '../contexts/RadioEngineContext';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Disc } from 'lucide-react';
import { SongRequest } from '../types';

interface MiniPlayerProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  requests?: SongRequest[];
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ activeTab, setActiveTab, requests = [] }) => {
  const {
    userRole,
    ytPlayerState,
    ytCurrentTime,
    ytDuration,
    ytVideoId,
    activeTrackMetadata,
    radioState,
    togglePlayPause,
    handleNextRequest,
    handlePreviousRequest
  } = useRadioEngine();

  // Hide if not admin or if already on the dedicated Radio Player page on desktop
  if (userRole !== 'admin') return null;
  if (activeTab === 'player') return null;

  const activePlayingId = (radioState && (radioState.status === 'playing' || radioState.status === 'paused'))
    ? radioState.current_request_id
    : (requests.find((r) => r.status === 'Playing' || r.status === 'playing')?.id || null);

  const playingTrack = activePlayingId
    ? requests.find((r) => r.id === activePlayingId) || (radioState?.current_title ? {
        id: activePlayingId,
        songTitle: radioState.current_title,
        artist: radioState.current_channel_title || 'EMKA FM',
        coverUrl: radioState.current_thumbnail_url || undefined,
        youtubeVideoId: radioState.current_video_id || undefined,
        status: radioState?.status === 'paused' ? 'Paused' : 'Playing'
      } as SongRequest : undefined)
    : requests.find((r) => r.status === 'Playing' || r.status === 'playing');

  const isPlaying = ytPlayerState === 1 || radioState?.status === 'playing';
  const isBuffering = ytPlayerState === 3;

  const displayTitle = activeTrackMetadata?.title || radioState?.current_title || playingTrack?.songTitle || 'EMKA Radio Standby';
  const displayArtist = activeTrackMetadata?.channelTitle || radioState?.current_channel_title || playingTrack?.artist || 'Radiomu Multi Karya';
  const displayCover = activeTrackMetadata?.thumbnail || radioState?.current_thumbnail_url || (ytVideoId ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg` : playingTrack?.coverUrl);

  const progressPercent = ytDuration > 0 ? Math.min(100, (ytCurrentTime / ytDuration) * 100) : 0;

  return (
    <div className="fixed bottom-3 left-4 right-4 md:left-68 md:right-6 bg-card border-2 border-primary rounded-3xl p-3 sm:p-4 shadow-pop-dark flex items-center justify-between gap-4 z-40 transition-all duration-300">
      {/* Left: Track Art & Info */}
      <div className="flex items-center space-x-3 min-w-0 flex-1 sm:max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-black overflow-hidden flex-shrink-0 relative border border-subtle">
          {displayCover ? (
            <img
              src={displayCover}
              alt={displayTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#B6FF00] flex items-center justify-center font-display font-black text-black text-xs">
              EMKA
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Disc className="w-5 h-5 text-[#B6FF00] animate-spin" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-black text-primary truncate font-sans">
            {displayTitle}
          </p>
          <p className="text-[11px] text-secondary font-medium truncate flex items-center gap-2">
            {playingTrack ? `${displayArtist} • ${playingTrack.studentName}` : displayArtist}
            {isBuffering && <span className="text-[#B6FF00] animate-pulse">Memuat...</span>}
          </p>
        </div>
      </div>

      {/* Center: Equalizer & Playback Controls */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Animated Equalizer */}
        <div className="hidden lg:flex items-end space-x-0.5 h-6 px-2.5 py-1 rounded-xl bg-elevated border border-subtle">
          <span className={`w-0.5 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-1' : isBuffering ? 'animate-pulse h-1' : 'h-1'}`}></span>
          <span className={`w-0.5 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-2' : isBuffering ? 'animate-pulse h-2 delay-75' : 'h-2'}`}></span>
          <span className={`w-0.5 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-3' : isBuffering ? 'animate-pulse h-1 delay-150' : 'h-4'}`}></span>
          <span className={`w-0.5 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-4' : isBuffering ? 'animate-pulse h-2.5 delay-200' : 'h-2.5'}`}></span>
          <span className={`w-0.5 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-5' : isBuffering ? 'animate-pulse h-1.5 delay-300' : 'h-5'}`}></span>
        </div>

        <button
          onClick={handlePreviousRequest}
          className="w-9 h-9 rounded-full bg-elevated hover:bg-secondary text-primary flex items-center justify-center border border-subtle transition active:scale-95 hidden sm:flex"
          title="Lagu Sebelumnya"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Big Circular Play/Pause */}
        <button
          onClick={togglePlayPause}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#B6FF00] text-[#0B0B0B] flex items-center justify-center border-2 border-black shadow-sm active:scale-95 transition hover:brightness-105 ${isPlaying ? 'is-playing scale-105' : ''}`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-black text-black" />
          ) : (
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          )}
        </button>

        <button
          onClick={handleNextRequest}
          className="w-9 h-9 rounded-full bg-elevated hover:bg-secondary text-primary flex items-center justify-center border border-subtle transition active:scale-95"
          title="Lagu Berikutnya"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Progress & Buka Player Button */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <div className="hidden xl:flex flex-col w-32 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-secondary">
            <span>{formatTime(ytCurrentTime)}</span>
            <span>{ytDuration > 0 ? formatTime(ytDuration) : '--:--'}</span>
          </div>
          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#B6FF00] h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('player')}
          className="px-3.5 py-2 rounded-2xl bg-[#0B0B0B] dark:bg-elevated hover:bg-slate-800 text-[#B6FF00] border border-black dark:border-subtle text-xs font-black flex items-center space-x-1.5 active:scale-95 transition shadow-sm"
          title="Buka Halaman Radio Player Lengkap"
        >
          <span className="hidden sm:inline">Buka</span>
          <span>Player</span>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
