import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SongRequest, DbRadioState } from '../types';
import {
  fetchRadioStateFromDb,
  updateRadioStateInDb,
  setAdminPlaySong,
  setAdminPauseRadio,
  setAdminResumeRadio,
  setRadioStandbyInDb,
  handleSongEndedTransition,
  updateRequestYoutubeVideoId,
  searchYouTubeVideos
} from '../services/api';

// Declare standard YouTube IFrame API window type
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface ActiveTrackMetadata {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: number;
  currentTime: number;
  studentName?: string;
  className?: string;
  targetPerson?: string;
  mood?: string;
}

/**
 * Validates and extracts a clean 11-character YouTube video ID.
 * Returns null if input is invalid or not an 11-char videoId.
 */
export function extractValidYouTubeId(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  // Direct 11-character alphanumeric YouTube Video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  // Extract from full YouTube or shortened URLs
  const urlMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) {
    return urlMatch[1];
  }
  return null;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

interface RadioEngineContextProps {
  isMasterTab: boolean;
  userRole: 'admin' | 'user';
  ytPlayer: any;
  playerReady: boolean;
  youtubeApiReady: boolean;
  pendingVideoId: string | null;
  playerError: string | null;
  ytPlayerState: number; // 1 = playing, 2 = paused, 0 = ended, 3 = buffering, -1 = unstarted, 5 = cued
  ytVolume: number;
  ytMuted: boolean;
  ytDuration: number;
  ytCurrentTime: number;
  ytVideoId: string | null;
  radioState: DbRadioState | null;
  activeTrackMetadata: ActiveTrackMetadata | null;
  isSearchingYt: boolean;
  isAutoplayBlocked: boolean;
  autoPlay: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  setAutoPlay: (val: boolean) => void;
  toggleAutoPlay: () => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  togglePlayPause: () => Promise<void>;
  toggleMute: () => void;
  startRadioPlayback: () => Promise<void>;
  handleSeekChange: (val: number) => void;
  handleNextRequest: () => Promise<void>;
  handlePreviousRequest: () => Promise<void>;
  playQueueTrack: (request: SongRequest) => Promise<void>;
  setYtVolume: (val: number) => void;
  updateLiveStateOnServer: (statusOverride?: string, positionOverride?: number) => Promise<void>;
  setCustomVideoIdForTrack: (trackId: string, videoId: string) => Promise<void>;
}

const RadioEngineContext = createContext<RadioEngineContextProps | null>(null);

export const useRadioEngine = () => {
  const ctx = useContext(RadioEngineContext);
  if (!ctx) throw new Error('useRadioEngine must be used within RadioEngineProvider');
  return ctx;
};

export const RadioEngineProvider: React.FC<{
  children: React.ReactNode;
  requests: SongRequest[];
  radioStateProp?: DbRadioState | null;
  onUpdateStatus: (id: string, status: 'Queued' | 'Playing' | 'Played') => Promise<void>;
  userRole: 'admin' | 'user';
}> = ({ children, requests, radioStateProp, onUpdateStatus, userRole }) => {
  // Strict FIFO queue sorting: oldest arrival timestamp first
  const queuedRequests = requests
    .filter((r) => r.status === 'Queued' || r.status === 'pending')
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

  const playingTrack = requests.find((r) => r.status === 'Playing' || r.status === 'playing');

  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem('fm_admin_autoplay');
      return val !== null ? val === 'true' : true;
    }
    return true;
  });

  const [youtubeApiReady, setYoutubeApiReady] = useState<boolean>(false);
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [radioState, setRadioState] = useState<DbRadioState | null>(radioStateProp || null);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [ytPlayerState, setYtPlayerState] = useState<number>(-1);
  const [ytVolume, setYtVolume] = useState<number>(85);
  const [ytMuted, setYtMuted] = useState<boolean>(false);
  const [ytDuration, setYtDuration] = useState<number>(0);
  const [ytCurrentTime, setYtCurrentTime] = useState<number>(0);
  const [activeTrackMetadata, setActiveTrackMetadata] = useState<ActiveTrackMetadata | null>(null);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // =========================================================================
  // REFS for Persistent Single YT.Player & Immune to Stale Closures
  // =========================================================================
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const isCreatingPlayerRef = useRef<boolean>(false);
  const currentLoadedIdRef = useRef<string | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  const radioStateRef = useRef<DbRadioState | null>(radioState);
  const autoPlayRef = useRef<boolean>(autoPlay);
  const queuedRequestsRef = useRef<SongRequest[]>(queuedRequests);
  const playingTrackRef = useRef<SongRequest | undefined>(playingTrack);
  const ytVideoIdRef = useRef<string | null>(ytVideoId);
  const ytPlayerStateRef = useRef<number>(-1);
  const ytCurrentTimeRef = useRef<number>(0);
  const ytVolumeRef = useRef<number>(ytVolume);
  const ytMutedRef = useRef<boolean>(ytMuted);
  const isRepeatRef = useRef<boolean>(isRepeat);
  const isShuffleRef = useRef<boolean>(isShuffle);
  const onUpdateStatusRef = useRef(onUpdateStatus);
  const requestsRef = useRef(requests);

  const [isMasterTab, setIsMasterTab] = useState(true);
  const isMasterTabRef = useRef(true);

  // Synchronize dynamic refs on every render
  useEffect(() => { isMasterTabRef.current = isMasterTab; }, [isMasterTab]);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => { queuedRequestsRef.current = queuedRequests; }, [queuedRequests]);
  useEffect(() => { playingTrackRef.current = playingTrack; }, [playingTrack]);
  useEffect(() => { ytVideoIdRef.current = ytVideoId; }, [ytVideoId]);
  useEffect(() => { ytPlayerStateRef.current = ytPlayerState; }, [ytPlayerState]);
  useEffect(() => { ytCurrentTimeRef.current = ytCurrentTime; }, [ytCurrentTime]);
  useEffect(() => { ytVolumeRef.current = ytVolume; }, [ytVolume]);
  useEffect(() => { ytMutedRef.current = ytMuted; }, [ytMuted]);
  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { onUpdateStatusRef.current = onUpdateStatus; }, [onUpdateStatus]);
  useEffect(() => { requestsRef.current = requests; }, [requests]);

  // Sync prop changes for radioState
  useEffect(() => {
    if (radioStateProp) {
      setRadioState(radioStateProp);
      radioStateRef.current = radioStateProp;
    }
  }, [radioStateProp]);

  // 1. Initial Load of radio_state from Supabase
  useEffect(() => {
    async function loadInitialRadioState() {
      try {
        const { state } = await fetchRadioStateFromDb();
        if (state) {
          console.log('[RADIO STATE] Initial load:', state.status, state.current_title);
          setRadioState(state);
          radioStateRef.current = state;
          if (state.current_video_id) {
            const validId = extractValidYouTubeId(state.current_video_id);
            if (validId) {
              setYtVideoId(validId);
              setActiveTrackMetadata({
                videoId: validId,
                title: state.current_title || 'EMKA Radio Standby',
                channelTitle: state.current_channel_title || 'EMKA FM',
                thumbnail: state.current_thumbnail_url || `https://i.ytimg.com/vi/${validId}/hqdefault.jpg`,
                duration: 0,
                currentTime: 0
              });
            }
          }
        }
      } catch (e) {
        console.warn('[RADIO STATE] Initial fetch error:', e);
      }
    }
    loadInitialRadioState();
  }, []);

  // 2. Load YouTube IFrame API script ONCE globally
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      setYoutubeApiReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }

      window.onYouTubeIframeAPIReady = () => {
        setYoutubeApiReady(true);
      };
    } else {
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setYoutubeApiReady(true);
          clearInterval(checkInterval);
        }
      }, 150);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Centralized helper to play a video in the single YT.Player instance
  const playTrackVideoId = useCallback((validId: string) => {
    if (!validId || validId.length !== 11) {
      console.warn(`[PLAYER] INVALID YOUTUBE VIDEO ID: ${validId}`);
      setPlayerError('Video YouTube tidak valid.');
      return;
    }

    setYtVideoId(validId);
    ytVideoIdRef.current = validId;
    currentLoadedIdRef.current = validId;
    setPlayerError(null);
    setIsAutoplayBlocked(false);

    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      try {
        console.log(`[PLAYER] LOAD videoId=${validId}`);
        player.loadVideoById(validId);
        player.setVolume(ytVolumeRef.current);
        if (ytMutedRef.current) player.mute();
        else player.unMute();
      } catch (err) {
        console.warn('[PLAYER] loadVideoById error:', err);
      }
    } else {
      console.log(`[PLAYER] Player not ready yet, queued pending videoId=${validId}`);
      pendingVideoIdRef.current = validId;
    }
  }, []);

  // Admin Play: Play track from queue
  const playQueueTrack = useCallback(async (request: SongRequest) => {
    console.log(`[ADMIN PLAY] Play: "${request.songTitle}" by ${request.artist}`);

    // Resolve or find YouTube Video ID if needed
    let validId = extractValidYouTubeId(request.youtubeVideoId);
    let resolvedTitle = request.songTitle;
    let resolvedArtist = request.artist;
    let resolvedThumb = request.coverUrl;

    if (!validId) {
      setIsSearchingYt(true);
      const searchQuery = `${request.songTitle} ${request.artist} official audio`;
      const results = await searchYouTubeVideos(searchQuery);
      if (results && results.length > 0) {
        validId = extractValidYouTubeId(results[0].videoId);
        resolvedTitle = results[0].title;
        resolvedArtist = results[0].channelTitle;
        resolvedThumb = results[0].thumbnail;
        if (validId) {
          await updateRequestYoutubeVideoId(request.id, validId);
        }
      }
      setIsSearchingYt(false);
    }

    // 1. Update Supabase song_requests & radio_state
    await setAdminPlaySong({
      id: request.id,
      video_id: validId || '',
      title: resolvedTitle,
      channel_title: resolvedArtist,
      thumbnail_url: resolvedThumb
    });

    // 2. Load into player without reload
    if (validId) {
      playTrackVideoId(validId);
    }
  }, [playTrackVideoId]);

  // Autoplay progression when track ends (Triggered on YT.PlayerState.ENDED)
  const handleTrackEnded = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    try {
      console.log('[PLAYER] YT.PlayerState.ENDED');
      const currentReqId = radioStateRef.current?.current_request_id || playingTrackRef.current?.id || null;

      // Handle transition in Supabase (marks current as played, picks next pending, updates radio_state)
      const transitionResult = await handleSongEndedTransition(currentReqId);

      if (transitionResult.nextRequest) {
        const nextReq = transitionResult.nextRequest;
        console.log(`[QUEUE] Next track: "${nextReq.songTitle}" by ${nextReq.artist}`);
        const nextVid = extractValidYouTubeId(nextReq.youtubeVideoId);
        if (nextVid) {
          playTrackVideoId(nextVid);
        } else {
          // Resolve video ID
          const searchQuery = `${nextReq.songTitle} ${nextReq.artist} official audio`;
          const results = await searchYouTubeVideos(searchQuery);
          if (results && results.length > 0) {
            const foundId = extractValidYouTubeId(results[0].videoId);
            if (foundId) {
              await updateRequestYoutubeVideoId(nextReq.id, foundId);
              playTrackVideoId(foundId);
            }
          }
        }
      } else {
        console.log('[PLAYER] No next request. Entering standby.');
        setYtVideoId(null);
        setActiveTrackMetadata(null);
        setYtCurrentTime(0);
        setYtDuration(0);
        currentLoadedIdRef.current = null;
        if (playerRef.current && playerReadyRef.current) {
          try { playerRef.current.pauseVideo(); } catch {}
        }
      }
    } catch (e) {
      console.error('[PLAYER] Error during track transition:', e);
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [playTrackVideoId]);

  // Keep a ref to handleTrackEnded so YouTube callbacks are never stale
  const handleTrackEndedRef = useRef(handleTrackEnded);
  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
  }, [handleTrackEnded]);

  // 3. SINGLE YOUTUBE PLAYER INSTANTIATION (Mounts ONCE into #admin-youtube-player-iframe)
  useEffect(() => {
    if (!youtubeApiReady) return;
    if (playerRef.current || isCreatingPlayerRef.current) return;

    let initTimer: any = null;

    const tryInitPlayer = () => {
      if (playerRef.current || isCreatingPlayerRef.current) return;

      const iframeTarget = document.getElementById('admin-youtube-player-iframe');
      if (!iframeTarget) {
        initTimer = setTimeout(tryInitPlayer, 100);
        return;
      }

      isCreatingPlayerRef.current = true;
      console.log('[PLAYER] CREATE');

      try {
        new window.YT.Player('admin-youtube-player-iframe', {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            playsinline: 1
          },
          events: {
            onReady: (event: any) => {
              console.log('[PLAYER] READY');
              playerRef.current = event.target;
              playerReadyRef.current = true;
              setPlayerReady(true);
              setPlayerError(null);
              setIsAutoplayBlocked(false);

              event.target.setVolume(ytVolumeRef.current);
              if (ytMutedRef.current) event.target.mute();
              else event.target.unMute();

              const targetVideoId = pendingVideoIdRef.current || ytVideoIdRef.current;
              if (targetVideoId) {
                const validId = extractValidYouTubeId(targetVideoId);
                if (validId) {
                  try {
                    console.log(`[PLAYER] LOAD videoId=${validId}`);
                    event.target.loadVideoById(validId);
                    currentLoadedIdRef.current = validId;
                    pendingVideoIdRef.current = null;
                  } catch (e) {
                    console.warn('[PLAYER] Initial load onReady error:', e);
                  }
                }
              }
            },
            onStateChange: (event: any) => {
              const state = event.data;
              setYtPlayerState(state);
              ytPlayerStateRef.current = state;
              console.log(`[PLAYER] STATE: ${state}`);

              switch (state) {
                case -1: // UNSTARTED
                  break;
                case 3: // BUFFERING
                  break;
                case 5: // CUED
                  if (event.target.getDuration) {
                    const cuedDur = event.target.getDuration();
                    if (cuedDur > 0) setYtDuration(cuedDur);
                  }
                  break;
                case 1: { // PLAYING
                  setIsAutoplayBlocked(false);
                  setPlayerError(null);

                  let dur = 0;
                  let cur = 0;

                  if (event.target.getDuration) {
                    dur = event.target.getDuration();
                    if (dur > 0) setYtDuration(dur);
                  }
                  if (event.target.getCurrentTime) {
                    cur = event.target.getCurrentTime();
                    setYtCurrentTime(cur);
                  }

                  if (event.target.getVideoData) {
                    const vData = event.target.getVideoData();
                    const currentVid = vData?.video_id || ytVideoIdRef.current || '';
                    if (currentVid) {
                      setActiveTrackMetadata(prev => ({
                        videoId: currentVid,
                        title: vData?.title || prev?.title || playingTrackRef.current?.songTitle || 'YouTube Video',
                        channelTitle: vData?.author || prev?.channelTitle || playingTrackRef.current?.artist || 'YouTube Channel',
                        thumbnail: `https://img.youtube.com/vi/${currentVid}/hqdefault.jpg`,
                        duration: dur,
                        currentTime: cur,
                        studentName: prev?.studentName || playingTrackRef.current?.studentName,
                        className: prev?.className || playingTrackRef.current?.className,
                        targetPerson: prev?.targetPerson || playingTrackRef.current?.targetPerson,
                        mood: prev?.mood || playingTrackRef.current?.mood
                      }));
                    }
                  }
                  break;
                }
                case 2: // PAUSED
                  if (event.target.getCurrentTime) {
                    const cur = event.target.getCurrentTime();
                    setYtCurrentTime(cur);
                  }
                  break;
                case 0: // ENDED
                  handleTrackEndedRef.current();
                  break;
              }
            },
            onError: (event: any) => {
              const code = event.data;
              const currentVid = ytVideoIdRef.current || '';
              console.warn(`[PLAYER] ERROR code=${code} videoId=${currentVid}`);

              let errorMsg = 'Video tidak dapat diputar.';
              switch (code) {
                case 2: errorMsg = 'Video ID tidak valid.'; break;
                case 5: errorMsg = 'Video tidak dapat diputar oleh YouTube Player.'; break;
                case 100: errorMsg = 'Video sudah tidak tersedia.'; break;
                case 101:
                case 150: errorMsg = 'Video ini tidak mengizinkan pemutaran di website.'; break;
                default: errorMsg = `Gagal memutar video YouTube (Kode: ${code}).`; break;
              }

              setPlayerError(errorMsg);

              if (autoPlayRef.current && queuedRequestsRef.current.length > 0) {
                console.log('[PLAYER] Auto-skipping to next queue item in 3s due to player error...');
                setTimeout(() => {
                  handleTrackEndedRef.current();
                }, 3000);
              }
            },
            onAutoplayBlocked: () => {
              console.warn('[PLAYER] AUTOPLAY BLOCKED by browser');
              setIsAutoplayBlocked(true);
            }
          }
        });
      } catch (err) {
        console.error('[PLAYER] Error instantiating YT.Player:', err);
        isCreatingPlayerRef.current = false;
      }
    };

    tryInitPlayer();

    return () => {
      if (initTimer) clearTimeout(initTimer);
    };
  }, [youtubeApiReady]);

  // Progress Interval during PLAYING
  useEffect(() => {
    if (!playerReady || !playerRef.current || ytPlayerState !== 1) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        if (typeof player.getCurrentTime === 'function') {
          const cur = player.getCurrentTime();
          setYtCurrentTime(cur);
        }
        if (typeof player.getDuration === 'function') {
          const dur = player.getDuration();
          if (dur > 0) {
            setYtDuration(dur);
          }
        }
      } catch (e) {}
    }, 250);

    return () => clearInterval(interval);
  }, [playerReady, ytPlayerState]);

  // Admin Play / Pause toggle with Supabase radio_state synchronization
  const togglePlayPause = async () => {
    const player = playerRef.current;
    const isPlaying = ytPlayerStateRef.current === 1 || radioStateRef.current?.status === 'playing';

    console.log('[ADMIN PLAY/PAUSE CLICK] Current isPlaying:', isPlaying);

    if (isPlaying) {
      // 1. Update Supabase radio_state -> paused
      await setAdminPauseRadio();
      // 2. Pause YouTube Player
      if (player && playerReadyRef.current) {
        try { player.pauseVideo(); } catch {}
      }
    } else {
      // 1. Update Supabase radio_state -> playing
      await setAdminResumeRadio();
      // 2. Resume YouTube Player
      if (player && playerReadyRef.current) {
        try {
          player.playVideo();
          setIsAutoplayBlocked(false);
        } catch {}
      } else if (radioStateRef.current?.current_video_id) {
        playTrackVideoId(radioStateRef.current.current_video_id);
      } else if (queuedRequestsRef.current.length > 0) {
        await playQueueTrack(queuedRequestsRef.current[0]);
      }
    }
  };

  const startRadioPlayback = async () => {
    await togglePlayPause();
  };

  const handleSeekChange = (val: number) => {
    setYtCurrentTime(val);
    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      try {
        player.seekTo(val, true);
        const newTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : val;
        setYtCurrentTime(newTime);
      } catch (e) {}
    }
  };

  const setCustomYtVolume = (val: number) => {
    setYtVolume(val);
    ytVolumeRef.current = val;
    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      try {
        player.setVolume(val);
      } catch {}
    }
  };

  const toggleMute = () => {
    const nextMute = !ytMutedRef.current;
    setYtMuted(nextMute);
    ytMutedRef.current = nextMute;
    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      try {
        if (nextMute) {
          player.mute();
        } else {
          player.unMute();
          player.setVolume(ytVolumeRef.current);
        }
      } catch {}
    }
  };

  const toggleAutoPlay = async () => {
    const next = !autoPlayRef.current;
    setAutoPlay(next);
    autoPlayRef.current = next;
    try {
      localStorage.setItem('fm_admin_autoplay', String(next));
    } catch {}
  };

  const toggleShuffle = () => setIsShuffle(!isShuffle);
  const toggleRepeat = () => setIsRepeat(!isRepeat);

  const handleNextRequest = async () => {
    if (isTransitioningRef.current) return;
    console.log('[PLAYER] Next track clicked');
    await handleTrackEndedRef.current();
  };

  const handlePreviousRequest = async () => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    try {
      console.log('[PLAYER] Previous: seeking to start');
      player.seekTo(0, true);
      setYtCurrentTime(0);
    } catch (e) {}
  };

  const setCustomVideoIdForTrack = async (trackId: string, inputId: string) => {
    const validId = extractValidYouTubeId(inputId);
    if (!validId) {
      console.warn(`[PLAYER] INVALID YOUTUBE VIDEO ID: ${inputId}`);
      setPlayerError('Video ID tidak valid.');
      return;
    }

    await updateRequestYoutubeVideoId(trackId, validId);

    if (playingTrackRef.current && playingTrackRef.current.id === trackId) {
      playTrackVideoId(validId);
    }
  };

  const updateLiveStateOnServer = async () => {};

  return (
    <RadioEngineContext.Provider value={{
      isMasterTab,
      userRole,
      ytPlayer: playerRef.current,
      playerReady,
      youtubeApiReady,
      pendingVideoId: pendingVideoIdRef.current,
      playerError,
      ytPlayerState,
      ytVolume,
      ytMuted,
      ytDuration,
      ytCurrentTime,
      ytVideoId,
      radioState,
      activeTrackMetadata,
      isSearchingYt,
      isAutoplayBlocked,
      autoPlay,
      isShuffle,
      isRepeat,
      setAutoPlay,
      toggleAutoPlay,
      toggleShuffle,
      toggleRepeat,
      togglePlayPause,
      toggleMute,
      startRadioPlayback,
      handleSeekChange,
      handleNextRequest,
      handlePreviousRequest,
      playQueueTrack,
      setYtVolume: setCustomYtVolume,
      updateLiveStateOnServer,
      setCustomVideoIdForTrack
    }}>
      {children}
    </RadioEngineContext.Provider>
  );
};
