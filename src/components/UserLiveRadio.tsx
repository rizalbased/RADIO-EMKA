import React, { useState, useEffect, useRef } from 'react';
import { Radio, Volume2, AlertCircle, Disc, Music } from 'lucide-react';
import { useRadioEngine } from '../contexts/RadioEngineContext';

export const UserLiveRadio: React.FC = () => {
  const {
    radioState,
    activeTrackMetadata,
    ytPlayerState,
    ytVolume,
    ytMuted,
    ytCurrentTime,
    ytDuration,
    setYtVolume,
    toggleMute,
    startRadioPlayback
  } = useRadioEngine();

  const [isListeningLive, setIsListeningLive] = useState<boolean>(false);
  const [showVideo, setShowVideo] = useState<boolean>(false);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isIdle = !radioState || radioState.status === 'standby' || !radioState.current_video_id;
  const isPlaying = radioState?.status === 'playing' || ytPlayerState === 1;

  const currentTitle = radioState?.current_title || activeTrackMetadata?.title || 'EMKA Radio Standby';
  const currentArtist = radioState?.current_channel_title || activeTrackMetadata?.channelTitle || 'EMKA FM Sekolah';
  const currentThumbnail = radioState?.current_thumbnail_url || activeTrackMetadata?.thumbnail;

  const handleListenClick = async () => {
    setIsListeningLive(true);
    await startRadioPlayback();
  };

  return (
    <div className="bg-card border-2 border-primary rounded-[28px] p-5 sm:p-6 shadow-soft relative overflow-hidden transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left part: On Air Badge & Track Info */}
        <div className="space-y-3 min-w-0 flex-1">
          <div className="flex items-center space-x-3">
            <span className="flex h-3.5 w-3.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isIdle ? 'bg-secondary' : 'bg-neon'}`}></span>
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isIdle ? 'bg-secondary' : 'bg-neon'}`}></span>
            </span>
            <span className={`text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider font-display border ${
              isIdle 
                ? 'bg-elevated text-secondary border-subtle' 
                : 'bg-neon text-black border-black/20'
            }`}>
              {isIdle ? '📻 RADIO STANDBY' : '🔴 SIARAN LANGSUNG EMKA RADIO'}
            </span>
          </div>

          {isIdle ? (
            <div className="space-y-1">
              <h3 className="text-lg font-black text-primary font-display uppercase">
                Penyiar sedang menyiapkan antrean musik berikutnya...
              </h3>
              <p className="text-xs text-secondary font-medium">
                Kirim request lagu favoritmu lewat tombol Request Lagu di atas!
              </p>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              {currentThumbnail && (
                <img
                  src={currentThumbnail}
                  alt={currentTitle}
                  className={`w-14 h-14 rounded-2xl object-cover border-2 border-black shadow-md flex-shrink-0 ${isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '12s' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                  }}
                />
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-lg font-black text-primary truncate flex items-center gap-2 font-display uppercase">
                  <Music className="w-4 h-4 text-pink flex-shrink-0" />
                  <span className="truncate">{currentTitle}</span>
                </h3>
                <p className="text-sm font-bold text-pink truncate">{currentArtist}</p>
                
                {isPlaying && (
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold text-secondary pt-1">
                    <span>{formatTime(ytCurrentTime)}</span>
                    <span className="text-secondary/50">/</span>
                    <span>{formatTime(ytDuration)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right part: Streaming / Autoplay Controller */}
        <div className="flex flex-col items-stretch md:items-end gap-3 flex-shrink-0 w-full md:w-auto">
          {!isListeningLive ? (
            <button
              onClick={handleListenClick}
              disabled={isIdle}
              className={`w-full md:w-auto flex items-center justify-center space-x-2.5 px-6 py-4 rounded-2xl font-black text-xs transition active:scale-95 border-2 ${
                isIdle 
                  ? 'bg-elevated text-secondary/50 border-subtle cursor-not-allowed' 
                  : 'bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-neon dark:text-black border-black shadow-pop-dark'
              }`}
            >
              <Volume2 className="w-5 h-5 text-neon dark:text-black" />
              <span>DENGARKAN LIVE RADIO 🔊</span>
            </button>
          ) : (
            <div className="space-y-3 w-full md:w-48">
              <div className="flex items-center justify-between md:justify-end space-x-3 bg-elevated p-2.5 rounded-2xl border border-subtle">
                <button 
                  onClick={toggleMute}
                  className="p-1.5 rounded-xl hover:bg-secondary text-pink transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={ytVolume}
                  onChange={(e) => setYtVolume(parseInt(e.target.value, 10))}
                  className="w-24 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-pink"
                />
                <span className="text-[10px] font-bold text-primary font-mono w-6 text-right">
                  {ytMuted ? 'Mute' : `${ytVolume}%`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-pink px-1 font-bold">
                <span className="flex items-center gap-1 text-primary">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Terhubung Live
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
