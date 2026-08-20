import React, { useEffect, useRef } from 'react';

export interface PlayerController {
  loadVideo: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoData: () => any;
}

interface YouTubeRadioPlayerProps {
  onRegisterController: (controller: PlayerController) => void;
  onStateChange?: (state: number) => void;
  onError?: (errorCode: number) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onTrackEnded?: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YouTubeRadioPlayer: React.FC<YouTubeRadioPlayerProps> = ({
  onRegisterController,
  onStateChange,
  onError,
  onProgress,
  onTrackEnded
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any | null>(null);
  const readyRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const pendingPlayRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[PLAYER] COMPONENT MOUNTED');

    if (containerRef.current) {
      console.log('[PLAYER] CONTAINER EXISTS');
    }

    // Load YouTube IFrame API script
    const loadApi = () => {
      return new Promise<void>((resolve) => {
        if (window.YT && window.YT.Player) {
          console.log('[PLAYER] YOUTUBE API READY');
          resolve();
          return;
        }

        const existingScript = document.getElementById('youtube-iframe-api');
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.id = 'youtube-iframe-api';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }

        window.onYouTubeIframeAPIReady = () => {
          console.log('[PLAYER] YOUTUBE API READY');
          resolve();
        };

        const interval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(interval);
            console.log('[PLAYER] YOUTUBE API READY');
            resolve();
          }
        }, 150);
      });
    };

    loadApi().then(() => {
      if (!mountedRef.current) return;
      if (!containerRef.current) {
        console.warn('[PLAYER] Container missing when API ready');
        return;
      }
      if (playerRef.current) return;

      console.log('[PLAYER] PLAYER CREATED');

      try {
        const player = new window.YT.Player(containerRef.current, {
          width: '100%',
          height: '100%',
          videoId: '',
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            enablejsapi: 1
          },
          events: {
            onReady: (event: any) => {
              readyRef.current = true;
              console.log('[PLAYER READY]');

              const pendingId = pendingVideoIdRef.current;
              if (pendingId) {
                pendingVideoIdRef.current = null;
                console.log(`[PLAYER LOAD]\nvideoId=${pendingId}`);
                event.target.loadVideoById({ videoId: pendingId });
              }

              if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                console.log('[PLAYER PLAY]');
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              const state = event.data;
              console.log(`[PLAYER] STATE=${state}`);
              if (onStateChange) {
                onStateChange(state);
              }
              if (state === 0 && onTrackEnded) {
                onTrackEnded();
              }
            },
            onError: (event: any) => {
              const code = event.data;
              console.error(`[PLAYER] ERROR=${code}`);
              if (onError) {
                onError(code);
              }
            }
          }
        });

        playerRef.current = player;
      } catch (err) {
        console.error('[PLAYER] Error creating YT.Player:', err);
      }
    });

    const controller: PlayerController = {
      loadVideo: (videoId: string) => {
        if (!videoId) return;
        console.log(`[PLAYER LOAD]\nvideoId=${videoId}`);
        pendingVideoIdRef.current = videoId;

        if (!playerRef.current || !readyRef.current) {
          console.log('[PLAYER] LOAD QUEUED — WAITING ONREADY');
          return;
        }

        playerRef.current.loadVideoById({ videoId });
        pendingVideoIdRef.current = null;
      },
      play: () => {
        const player = playerRef.current;
        if (!player || !readyRef.current) {
          pendingPlayRef.current = true;
          console.log('[PLAYER] PLAY QUEUED — PLAYER NOT READY');
          return;
        }
        player.playVideo();
        console.log('[PLAYER PLAY]');
      },
      pause: () => {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        player.pauseVideo();
        console.log('[PLAYER PAUSE]');
      },
      stopVideo: () => {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        if (typeof player.stopVideo === 'function') {
          player.stopVideo();
        } else if (typeof player.pauseVideo === 'function') {
          player.pauseVideo();
        }
        console.log('[PLAYER STOP]');
      },
      seekTo: (seconds: number) => {
        if (playerRef.current && readyRef.current) {
          playerRef.current.seekTo(seconds, true);
        }
      },
      setVolume: (volume: number) => {
        if (playerRef.current && readyRef.current) {
          playerRef.current.setVolume(volume);
        }
      },
      setMuted: (muted: boolean) => {
        if (playerRef.current && readyRef.current) {
          if (muted) playerRef.current.mute();
          else playerRef.current.unMute();
        }
      },
      getCurrentTime: () => {
        if (playerRef.current && readyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          return playerRef.current.getCurrentTime();
        }
        return 0;
      },
      getDuration: () => {
        if (playerRef.current && readyRef.current && typeof playerRef.current.getDuration === 'function') {
          return playerRef.current.getDuration();
        }
        return 0;
      },
      getVideoData: () => {
        if (playerRef.current && readyRef.current && typeof playerRef.current.getVideoData === 'function') {
          return playerRef.current.getVideoData();
        }
        return null;
      }
    };

    onRegisterController(controller);

    return () => {
      mountedRef.current = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
        readyRef.current = false;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="emka-youtube-player"
      className="w-full h-full"
    />
  );
};
