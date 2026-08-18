import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SongRequest } from '../types';
import { updateLiveRadioState, updateRequestYoutubeVideoId, searchYouTubeVideos } from '../services/api';

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
  onUpdateStatus: (id: string, status: 'Queued' | 'Playing' | 'Played') => Promise<void>;
  userRole: 'admin' | 'user';
}> = ({ children, requests, onUpdateStatus, userRole }) => {
  // Strict FIFO queue sorting: oldest arrival timestamp first
  const queuedRequests = requests
    .filter((r) => r.status === 'Queued')
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

  const playingTrack = requests.find((r) => r.status === 'Playing');

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

  const autoPlayRef = useRef<boolean>(autoPlay);
  const queuedRequestsRef = useRef<SongRequest[]>(queuedRequests);
  const playingTrackRef = useRef<SongRequest | undefined>(playingTrack);
  const ytVideoIdRef = useRef<string | null>(ytVideoId);
  const ytPlayerStateRef = useRef<number>(-1);
  const ytCurrentTimeRef = useRef<number>(0);
  const ytVolumeRef = useRef<number>(ytVolume);
  const ytMutedRef = useRef<boolean>(ytMuted);
  const sequenceRef = useRef<number>(1);
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

  // Master tab coordination
  useEffect(() => {
    const TAB_ID = Math.random().toString(36).substring(2, 9);
    let heartbeatInterval: any;

    const checkMaster = () => {
      const now = Date.now();
      const masterStr = localStorage.getItem('fm_radio_master');
      let masterData = masterStr ? JSON.parse(masterStr) : null;

      if (!masterData || now - masterData.timestamp > 4000) {
        masterData = { id: TAB_ID, timestamp: now };
        localStorage.setItem('fm_radio_master', JSON.stringify(masterData));
        setIsMasterTab(true);
      } else if (masterData.id === TAB_ID) {
        masterData.timestamp = now;
        localStorage.setItem('fm_radio_master', JSON.stringify(masterData));
        setIsMasterTab(true);
      } else {
        setIsMasterTab(false);
      }
    };

    checkMaster();
    heartbeatInterval = setInterval(checkMaster, 1500);

    const handleUnload = () => {
      const masterStr = localStorage.getItem('fm_radio_master');
      if (masterStr) {
        try {
          const masterData = JSON.parse(masterStr);
          if (masterData.id === TAB_ID) {
            localStorage.removeItem('fm_radio_master');
          }
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  // 1. Load YouTube IFrame API script ONCE globally
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

  const updateLiveStateOnServer = useCallback(async (statusOverride?: string, positionOverride?: number) => {
    const currentPlayingTrack = playingTrackRef.current;
    if (!currentPlayingTrack) {
      try {
        const nextSeq = sequenceRef.current + 1;
        sequenceRef.current = nextSeq;
        await updateLiveRadioState({
          videoId: '',
          trackId: '',
          songTitle: 'EMKA RADIO',
          artist: 'Standby / Rehat',
          artworkUrl: '',
          status: 'IDLE',
          position: 0,
          updatedAt: Date.now(),
          queueIndex: 0,
          sequence: nextSeq
        });
      } catch (e) {}
      return;
    }

    try {
      const nextSeq = sequenceRef.current + 1;
      sequenceRef.current = nextSeq;
      let currentStatus: 'PLAYING' | 'PAUSED' | 'IDLE' | 'STOPPED' = 'IDLE';
      if (statusOverride) {
        currentStatus = statusOverride as any;
      } else {
        const player = playerRef.current;
        let stateVal = ytPlayerStateRef.current;
        if (player && typeof player.getPlayerState === 'function') {
          try { stateVal = player.getPlayerState(); } catch {}
        }
        if (stateVal === 1) currentStatus = 'PLAYING';
        else if (stateVal === 2) currentStatus = 'PAUSED';
        else if (stateVal === 0) currentStatus = 'STOPPED';
      }

      const currentPos = positionOverride !== undefined ? positionOverride : ytCurrentTimeRef.current;
      const qIndex = requestsRef.current.findIndex(r => r.id === currentPlayingTrack.id);

      await updateLiveRadioState({
        videoId: currentPlayingTrack.youtubeVideoId || ytVideoIdRef.current || '',
        trackId: currentPlayingTrack.id,
        songTitle: currentPlayingTrack.songTitle,
        artist: currentPlayingTrack.artist,
        artworkUrl: currentPlayingTrack.coverUrl || (ytVideoIdRef.current ? `https://img.youtube.com/vi/${ytVideoIdRef.current}/hqdefault.jpg` : ''),
        status: currentStatus,
        position: currentPos,
        updatedAt: Date.now(),
        queueIndex: Math.max(0, qIndex),
        sequence: nextSeq
      });
    } catch (e) {}
  }, []);

  // Autoplay progression when track ends (ONLY triggered on YT.PlayerState.ENDED)
  const handleTrackEnded = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    try {
      const currentTrack = playingTrackRef.current;
      const currentQueue = queuedRequestsRef.current;

      console.log('[PLAYER] ENDED');

      if (isRepeatRef.current && currentTrack) {
        if (playerRef.current && playerReadyRef.current) {
          playerRef.current.seekTo(0, true);
          playerRef.current.playVideo();
          setYtCurrentTime(0);
        }
        return;
      }

      const nextQueue = currentQueue && currentQueue.length > 0 
        ? (isShuffleRef.current ? currentQueue[Math.floor(Math.random() * currentQueue.length)] : currentQueue[0])
        : null;

      if (autoPlayRef.current && nextQueue) {
        console.log(`[QUEUE] Autoplay next: "${nextQueue.songTitle}" by ${nextQueue.artist}`);
        setYtCurrentTime(0);
        setYtDuration(0);
        await onUpdateStatusRef.current(nextQueue.id, 'Playing');
      } else {
        if (currentTrack) {
          await onUpdateStatusRef.current(currentTrack.id, 'Played');
        }
        setYtVideoId(null);
        setActiveTrackMetadata(null);
        setYtCurrentTime(0);
        setYtDuration(0);
        currentLoadedIdRef.current = null;
        if (playerRef.current && playerReadyRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch {}
        }
        updateLiveStateOnServer('IDLE', 0);
      }
    } catch (e) {
      console.error('[PLAYER] Error during track transition:', e);
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [updateLiveStateOnServer]);

  // Keep a ref to handleTrackEnded so YouTube callbacks are never stale
  const handleTrackEndedRef = useRef(handleTrackEnded);
  useEffect(() => {
    handleTrackEndedRef.current = handleTrackEnded;
  }, [handleTrackEnded]);

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

  // Direct queue play function with 0 reload & instant playback
  const playQueueTrack = useCallback(async (request: SongRequest) => {
    console.log(`[QUEUE] PLAY: "${request.songTitle}" by ${request.artist}`);
    
    // Atomically set this track as Playing
    await onUpdateStatusRef.current(request.id, 'Playing');

    // If request already has valid videoId, start loading immediately
    const validId = extractValidYouTubeId(request.youtubeVideoId);
    if (validId) {
      playTrackVideoId(validId);
    }
  }, [playTrackVideoId]);

  // 2. CENTRALIZED TRACK RESOLVER & DISPATCHER
  const playingTrackId = playingTrack?.id;
  const playingTrackTitle = playingTrack?.songTitle;
  const playingTrackArtist = playingTrack?.artist;
  const playingTrackVideoId = playingTrack?.youtubeVideoId;

  useEffect(() => {
    if (!playingTrackId) {
      if (ytVideoIdRef.current) {
        setYtVideoId(null);
        ytVideoIdRef.current = null;
        currentLoadedIdRef.current = null;
        setActiveTrackMetadata(null);
        setYtCurrentTime(0);
        setYtDuration(0);
        if (playerRef.current && playerReadyRef.current) {
          try { playerRef.current.pauseVideo(); } catch {}
        }
        updateLiveStateOnServer('IDLE', 0);
      }
      return;
    }

    let isCancelled = false;

    const resolveAndPlay = async () => {
      try {
        let validId = extractValidYouTubeId(playingTrackVideoId);
        let fetchedTitle = playingTrackTitle || 'Music';
        let fetchedChannel = playingTrackArtist || 'Artist';
        let fetchedThumb = playingTrackRef.current?.coverUrl || '';

        // If no valid 11-char videoId stored, search YouTube Data API
        if (!validId) {
          setIsSearchingYt(true);
          const searchQuery = `${playingTrackTitle} ${playingTrackArtist} official audio`;
          console.log(`[PLAYER] Searching YouTube Data API for: "${searchQuery}"`);
          const results = await searchYouTubeVideos(searchQuery);

          if (results && results.length > 0) {
            const foundId = extractValidYouTubeId(results[0].videoId);
            if (foundId) {
              validId = foundId;
              fetchedTitle = results[0].title;
              fetchedChannel = results[0].channelTitle;
              fetchedThumb = results[0].thumbnail;
              await updateRequestYoutubeVideoId(playingTrackId, validId);
            }
          }
        }

        if (isCancelled) return;
        setIsSearchingYt(false);

        if (!validId || validId.length !== 11) {
          console.warn('[PLAYER] INVALID YOUTUBE VIDEO ID for track:', playingTrackTitle);
          setPlayerError('Video YouTube tidak valid.');
          if (autoPlayRef.current && queuedRequestsRef.current.length > 0) {
            setTimeout(() => {
              handleTrackEndedRef.current();
            }, 2500);
          }
          return;
        }

        // Set active metadata
        setActiveTrackMetadata({
          videoId: validId,
          title: fetchedTitle,
          channelTitle: fetchedChannel,
          thumbnail: fetchedThumb || `https://img.youtube.com/vi/${validId}/hqdefault.jpg`,
          duration: 0,
          currentTime: 0,
          studentName: playingTrackRef.current?.studentName,
          className: playingTrackRef.current?.className,
          targetPerson: playingTrackRef.current?.targetPerson,
          mood: playingTrackRef.current?.mood
        });

        // Load into player if not already loaded
        if (currentLoadedIdRef.current !== validId) {
          playTrackVideoId(validId);
        }
      } catch (err) {
        console.error('[PLAYER] Resolve and play error:', err);
        if (!isCancelled) {
          setIsSearchingYt(false);
        }
      }
    };

    resolveAndPlay();

    return () => {
      isCancelled = true;
    };
  }, [playingTrackId, playingTrackTitle, playingTrackArtist, playingTrackVideoId, playTrackVideoId, updateLiveStateOnServer]);

  // 3. SINGLE YOUTUBE PLAYER INSTANTIATION (Mounts ONCE into #admin-youtube-player-iframe)
  useEffect(() => {
    if (!youtubeApiReady) return;
    if (playerRef.current || isCreatingPlayerRef.current) return;

    let initTimer: any = null;

    const tryInitPlayer = () => {
      if (playerRef.current || isCreatingPlayerRef.current) return;

      const iframeTarget = document.getElementById('admin-youtube-player-iframe');
      if (!iframeTarget) {
        // DOM element not mounted yet, retry in 100ms
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
                    updateLiveStateOnServer('PLAYING', cur);
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
                    updateLiveStateOnServer('PAUSED', cur);
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
                case 2:
                  errorMsg = 'Video ID tidak valid.';
                  break;
                case 5:
                  errorMsg = 'Video tidak dapat diputar oleh YouTube Player.';
                  break;
                case 100:
                  errorMsg = 'Video sudah tidak tersedia.';
                  break;
                case 101:
                case 150:
                  errorMsg = 'Video ini tidak mengizinkan pemutaran di website.';
                  break;
                default:
                  errorMsg = `Gagal memutar video YouTube (Kode: ${code}).`;
                  break;
              }

              setPlayerError(errorMsg);

              // If queue has more items and autoplay is enabled, advance to next track in 3 seconds
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
  }, [youtubeApiReady, updateLiveStateOnServer]);

  // 4. SINGLE PROGRESS INTERVAL: only active during PLAYING (ytPlayerState === 1)
  useEffect(() => {
    if (!playerReady || !playerRef.current || ytPlayerState !== 1) return;

    let syncCounter = 0;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        if (typeof player.getCurrentTime === 'function') {
          const cur = player.getCurrentTime();
          setYtCurrentTime(cur);

          syncCounter++;
          if (syncCounter % 4 === 0) {
            updateLiveStateOnServer('PLAYING', cur);
          }
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
  }, [playerReady, ytPlayerState, updateLiveStateOnServer]);

  // Direct, Realtime Play / Pause toggle with YouTube Player as source of truth
  const togglePlayPause = async () => {
    const player = playerRef.current;
    const exists = !!player && playerReadyRef.current;

    console.log('[PLAYER] PLAY/PAUSE CLICK');
    console.log(`[PLAYER] INSTANCE EXISTS: ${exists}`);

    if (!player || !playerReadyRef.current) {
      console.warn('[PLAYER] YouTube Player instance is not ready.');
      if (playingTrackRef.current) {
        const vid = extractValidYouTubeId(playingTrackRef.current.youtubeVideoId);
        if (vid) playTrackVideoId(vid);
      } else if (queuedRequestsRef.current.length > 0) {
        await playQueueTrack(queuedRequestsRef.current[0]);
      }
      return;
    }

    try {
      const currentState = typeof player.getPlayerState === 'function' 
        ? player.getPlayerState() 
        : ytPlayerStateRef.current;
      
      console.log(`[PLAYER] STATE: ${currentState}`);

      if (currentState === 1) { // Currently PLAYING (1) -> Pause it
        console.log('[PLAYER] PAUSE CLICK');
        console.log('[PLAYER] PAUSE');
        player.pauseVideo();
      } else { // Currently PAUSED (2), CUED (5), UNSTARTED (-1), or ENDED (0) -> Play it
        console.log('[PLAYER] PLAY CLICK');
        console.log('[PLAYER] PLAY');
        player.playVideo();
        setIsAutoplayBlocked(false);
      }
    } catch (e) {
      console.warn('[PLAYER] togglePlayPause error:', e);
    }
  };

  const startRadioPlayback = async () => {
    const player = playerRef.current;
    console.log('[PLAYER] PLAY CLICK');
    console.log(`[PLAYER] INSTANCE EXISTS: ${!!player}`);

    if (!player || !playerReadyRef.current) {
      if (playingTrackRef.current) {
        const vid = extractValidYouTubeId(playingTrackRef.current.youtubeVideoId);
        if (vid) playTrackVideoId(vid);
      } else if (queuedRequestsRef.current.length > 0) {
        await playQueueTrack(queuedRequestsRef.current[0]);
      }
      return;
    }
    try {
      console.log('[PLAYER] PLAY');
      player.playVideo();
      setIsAutoplayBlocked(false);
    } catch (e) {}
  };

  const handleSeekChange = (val: number) => {
    setYtCurrentTime(val);
    const player = playerRef.current;
    if (player && playerReadyRef.current) {
      try {
        player.seekTo(val, true);
        const newTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : val;
        setYtCurrentTime(newTime);
        updateLiveStateOnServer(undefined, newTime);
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
