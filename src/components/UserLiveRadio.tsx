import React, { useState, useEffect, useRef } from 'react';
import { Radio, Volume2, AlertCircle, Disc, Music } from 'lucide-react';
import { LiveRadioState } from '../types';
import { fetchLiveRadioState, subscribeLiveRadioState } from '../services/api';

export const UserLiveRadio: React.FC = () => {
  const [liveState, setLiveState] = useState<LiveRadioState | null>(null);
  const [isListeningLive, setIsListeningLive] = useState<boolean>(false);
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [ytReady, setYtReady] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(true);

  const prevVideoIdRef = useRef<string>('');
  const sequenceRef = useRef<number>(-1);

  // Load YouTube IFrame API on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  }, []);

  // Real-time Firestore onSnapshot listener for live radio broadcast state
  useEffect(() => {
    // Initial fetch
    fetchLiveRadioState().then((state) => {
      if (state && state.sequence >= sequenceRef.current) {
        sequenceRef.current = state.sequence;
        setLiveState(state);
      }
    }).catch(() => {});

    // Realtime Firestore subscription
    const unsubscribe = subscribeLiveRadioState((state) => {
      if (state && state.sequence >= sequenceRef.current) {
        sequenceRef.current = state.sequence;
        setLiveState(state);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync player when liveState changes or isListeningLive toggled
  useEffect(() => {
    if (!liveState || !isListeningLive || !ytReady || !ytPlayer) return;

    const { videoId, status, position, updatedAt } = liveState;

    try {
      if (videoId && videoId !== prevVideoIdRef.current) {
        prevVideoIdRef.current = videoId;
        const elapsed = (Date.now() - updatedAt) / 1000;
        const startPos = Math.max(0, position + elapsed);
        
        if (status === 'PLAYING') {
          ytPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: startPos
          });
        } else {
          ytPlayer.cueVideoById({
            videoId: videoId,
            startSeconds: position
          });
        }
        return;
      }

      if (!videoId || status === 'IDLE') {
        ytPlayer.pauseVideo();
        prevVideoIdRef.current = '';
        return;
      }

      const currentVideoId = ytPlayer.getVideoData?.()?.video_id || '';
      if (currentVideoId === videoId) {
        const playerTime = ytPlayer.getCurrentTime() || 0;
        
        if (status === 'PLAYING') {
          const elapsed = (Date.now() - updatedAt) / 1000;
          const targetTime = Math.max(0, position + elapsed);
          
          if (Math.abs(playerTime - targetTime) > 3.5) {
            ytPlayer.seekTo(targetTime, true);
          }
          if (ytPlayer.getPlayerState() !== (window as any).YT.PlayerState.PLAYING) {
            ytPlayer.playVideo();
          }
        } else if (status === 'PAUSED') {
          if (ytPlayer.getPlayerState() === (window as any).YT.PlayerState.PLAYING) {
            ytPlayer.pauseVideo();
          }
        }
      }
    } catch (e: any) {
      console.warn('Error syncing player:', e);
    }
  }, [liveState, isListeningLive, ytReady, ytPlayer]);

  // Track progress & duration
  useEffect(() => {
    if (!isListeningLive || !ytPlayer || !ytReady) return;

    const timer = setInterval(() => {
      try {
        if (ytPlayer.getCurrentTime) {
          setCurrentTime(ytPlayer.getCurrentTime());
        }
        if (ytPlayer.getDuration) {
          const dur = ytPlayer.getDuration();
          if (dur > 0) setDuration(dur);
        }
      } catch (e) {}
    }, 500);

    return () => clearInterval(timer);
  }, [isListeningLive, ytPlayer, ytReady]);

  const initPlayer = () => {
    if (ytPlayer || !(window as any).YT || !(window as any).YT.Player) return;

    const el = document.getElementById('user-youtube-player-iframe');
    if (!el) return;

    const player = new (window as any).YT.Player('user-youtube-player-iframe', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: (event: any) => {
          setYtPlayer(event.target);
          setYtReady(true);
          event.target.setVolume(volume);
          if (liveState && liveState.videoId && liveState.status === 'PLAYING') {
            const elapsed = (Date.now() - liveState.updatedAt) / 1000;
            event.target.loadVideoById({
              videoId: liveState.videoId,
              startSeconds: Math.max(0, liveState.position + elapsed)
            });
          }
        },
        onError: (err: any) => {
          console.warn('YouTube live player error:', err);
          setErrorMsg('Lagu live tidak dapat diputar otomatis (mungkin dibatasi hak cipta)');
        }
      }
    });
  };

  const handleListenClick = () => {
    setIsListeningLive(true);
    setTimeout(() => {
      initPlayer();
    }, 200);
  };

  const handleLocalVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (ytPlayer) {
      ytPlayer.setVolume(val);
      if (val > 0 && isMuted) {
        setIsMuted(false);
        ytPlayer.unMute();
      }
    }
  };

  const toggleLocalMute = () => {
    if (!ytPlayer) return;
    if (isMuted) {
      ytPlayer.unMute();
      setIsMuted(false);
    } else {
      ytPlayer.mute();
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isIdle = !liveState || liveState.status === 'IDLE' || !liveState.videoId;

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
                Penyiar sedang menyiapkan track berikutnya...
              </h3>
              <p className="text-xs text-secondary font-medium">
                Klik dengarkan di bawah untuk langsung terhubung saat siaran musik dimulai.
              </p>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              {liveState.coverUrl && (
                <img
                  src={liveState.coverUrl}
                  alt={liveState.songTitle}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-black shadow-md flex-shrink-0 animate-spin"
                  style={{ animationDuration: '12s' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                  }}
                />
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-lg font-black text-primary truncate flex items-center gap-2 font-display uppercase">
                  <Music className="w-4 h-4 text-pink flex-shrink-0" />
                  <span className="truncate">{liveState.songTitle}</span>
                </h3>
                <p className="text-sm font-bold text-pink truncate">{liveState.artist}</p>
                
                {isListeningLive && (
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold text-secondary pt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-secondary/50">/</span>
                    <span>{formatTime(duration || liveState.position)}</span>
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
                  onClick={toggleLocalMute}
                  className="p-1.5 rounded-xl hover:bg-secondary text-pink transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleLocalVolumeChange}
                  className="w-24 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-pink"
                />
                <span className="text-[10px] font-bold text-primary font-mono w-6 text-right">
                  {isMuted ? 'Mute' : `${volume}%`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-pink px-1 font-bold">
                <span className="flex items-center gap-1 text-primary">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Terhubung Live
                </span>
                <button 
                  onClick={() => setShowVideo(!showVideo)}
                  className="text-[10px] underline hover:text-primary transition"
                >
                  {showVideo ? 'Sembunyikan Video' : 'Tampilkan Video'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* YouTube Player Container */}
      {isListeningLive && !isIdle && (
        <div className={`mt-5 border border-subtle bg-elevated rounded-2xl overflow-hidden transition-all duration-300 ${showVideo ? 'max-h-[240px] opacity-100 p-2' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="aspect-video w-full max-w-[420px] mx-auto rounded-xl overflow-hidden bg-black border-2 border-black">
            <div id="user-youtube-player-iframe" className="w-full h-full"></div>
          </div>
          {errorMsg && (
            <div className="mt-2 text-center text-xs text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
