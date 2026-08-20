import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  MoreVertical,
  Disc,
  Sparkles,
  Link,
  Check,
  AlertCircle
} from 'lucide-react';
import { SongRequest } from '../types';
import { useRadioEngine, formatTime } from '../contexts/RadioEngineContext';
import { YouTubeRadioPlayer } from './YouTubeRadioPlayer';

interface RadioPlayerViewProps {
  requests: SongRequest[];
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
  onLike?: (id: string) => void;
}

export const RadioPlayerView: React.FC<RadioPlayerViewProps> = ({
  requests,
  onOpenStoryModal,
  onLike
}) => {
  const {
    userRole,
    ytPlayerState,
    ytVolume,
    ytMuted,
    ytDuration,
    ytCurrentTime,
    ytVideoId,
    activeTrackMetadata,
    playerError,
    isSearchingYt,
    isAutoplayBlocked,
    autoPlay,
    isShuffle,
    isRepeat,
    toggleAutoPlay,
    toggleShuffle,
    toggleRepeat,
    togglePlayPause,
    toggleMute,
    startRadioPlayback,
    handleSeekChange,
    handleNextRequest,
    handlePreviousRequest,
    setYtVolume,
    isMasterTab,
    setCustomVideoIdForTrack,
    registerPlayerController,
    handlePlayerStateChange,
    handlePlayerError,
    handleTrackEnded
  } = useRadioEngine();

  const playingTrack = requests.find((r) => r.status === 'Playing');
  const queuedRequests = requests.filter((r) => r.status === 'Queued');
  const isPlaying = ytPlayerState === 1;
  const isBuffering = ytPlayerState === 3;
  const isAdmin = userRole === 'admin';

  const [isLiked, setIsLiked] = useState(false);
  const [isYtModalOpen, setIsYtModalOpen] = useState(false);
  const [customYtInput, setCustomYtInput] = useState('');

  // Use active metadata from YouTube video data if available
  const displayTitle = activeTrackMetadata?.title || playingTrack?.songTitle || 'EMKA Radio Standby';
  const displayArtist = activeTrackMetadata?.channelTitle || playingTrack?.artist || 'Radiomu Multi Karya';
  const displayCover = activeTrackMetadata?.thumbnail || (ytVideoId ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg` : playingTrack?.coverUrl);

  const currentFormatted = formatTime(ytCurrentTime);
  const totalFormatted = ytDuration > 0 ? formatTime(ytDuration) : '--:--';
  const progressPercent = ytDuration > 0 ? Math.min(100, (ytCurrentTime / ytDuration) * 100) : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    handleSeekChange(val);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setYtVolume(val);
  };

  const handleLikeClick = () => {
    setIsLiked(prev => !prev);
    if (playingTrack && onLike) {
      onLike(playingTrack.id);
    }
  };

  const handleSaveCustomYt = async () => {
    if (isAdmin && playingTrack && customYtInput.trim()) {
      await setCustomVideoIdForTrack(playingTrack.id, customYtInput.trim());
      setIsYtModalOpen(false);
      setCustomYtInput('');
    }
  };

  return (
    <div className="bg-card border-2 border-primary rounded-3xl p-5 sm:p-7 shadow-soft space-y-6 transition-colors">
      {/* Title Header & Mode Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <span className="flex h-3 w-3 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isPlaying ? 'bg-[#FF4F91]' : 'bg-[#B6FF00]'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              isPlaying ? 'bg-[#FF4F91]' : 'bg-[#B6FF00]'
            }`}></span>
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-display text-primary tracking-wide uppercase">
            RADIO PLAYER
          </h2>
          {isAdmin ? (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-300 text-black border border-black/20 shadow-xs">
              👑 PENYIAR
            </span>
          ) : (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#B6FF00] text-black border border-black/20 shadow-xs">
              🎧 PENDENGAR
            </span>
          )}
        </div>

        {/* Autoplay Badge / Toggle */}
        {isAdmin ? (
          <button
            onClick={toggleAutoPlay}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition border ${
              autoPlay
                ? 'bg-[#B6FF00] text-[#0B0B0B] border-black/10'
                : 'bg-elevated text-secondary border-subtle'
            }`}
            title="Autoplay memutar lagu antrean berikutnya secara otomatis"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AUTOPLAY FIFO: {autoPlay ? 'ON' : 'OFF'}</span>
          </button>
        ) : (
          <div
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-elevated text-secondary border border-subtle select-none"
            title="Autoplay dikelola oleh Penyiar"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B6FF00]" />
            <span>MENGIKUTI SIARAN PENYIAR</span>
          </div>
        )}
      </div>

      {/* 16:9 YouTube Player Stage */}
      <div
        id="youtube-player-stage"
        className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative border-2 border-primary shadow-soft flex items-center justify-center"
      >
        {/* The Actual YouTube IFrame mounts into YouTubeRadioPlayer */}
        <YouTubeRadioPlayer
          onRegisterController={registerPlayerController}
          onStateChange={handlePlayerStateChange}
          onError={handlePlayerError}
          onTrackEnded={handleTrackEnded}
        />

        {/* Standby / Searching Overlay */}
        {(!ytVideoId || isSearchingYt) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white space-y-3 p-6 text-center z-10">
            <Disc className="w-12 h-12 text-[#B6FF00] animate-spin" />
            <p className="font-display font-black text-xl sm:text-2xl tracking-wider text-[#B6FF00] uppercase">
              {isSearchingYt ? 'MENCARI AUDIO YOUTUBE...' : 'STANDBY RADIO'}
            </p>
            <p className="text-xs text-gray-400 max-w-md font-sans">
              {playingTrack
                ? `Menyiapkan video: ${playingTrack.songTitle} - ${playingTrack.artist}`
                : queuedRequests.length > 0
                ? `Ada ${queuedRequests.length} request dalam antrean. Klik Play untuk memulai siaran!`
                : 'Penyiar standby. Menunggu kiriman request lagu dari siswa.'}
            </p>
            {playingTrack && !isSearchingYt && (
              <button
                onClick={startRadioPlayback}
                className="mt-2 px-5 py-2.5 rounded-full bg-[#B6FF00] text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-pop"
              >
                <Play className="w-4 h-4 fill-black text-black" />
                <span>MULAI PUTAR SIARAN</span>
              </button>
            )}
          </div>
        )}

        {/* Autoplay Blocked Notification */}
        {isAutoplayBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white space-y-3 p-6 text-center z-20">
            <Volume2 className="w-10 h-10 text-[#B6FF00]" />
            <p className="font-bold text-sm text-[#B6FF00] max-w-md">
              Autoplay diblokir browser. Tekan Play untuk memulai.
            </p>
            <button
              onClick={startRadioPlayback}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#B6FF00] text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-pop"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>PUTAR SEKARANG</span>
            </button>
          </div>
        )}

        {/* Player Error notification */}
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white space-y-3 p-6 text-center z-20">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="font-bold text-sm text-rose-300 max-w-md">{playerError}</p>
            <button
              onClick={handleNextRequest}
              className="px-5 py-2.5 bg-[#B6FF00] text-black rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition"
            >
              Lewati ke Lagu Berikutnya
            </button>
          </div>
        )}

        {/* Secondary tab notice */}
        {!isMasterTab && (
          <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-[11px] text-white font-medium flex items-center space-x-1.5 z-20">
            <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            <span>Tab Sekunder (Audio di-Mute)</span>
          </div>
        )}
      </div>

      {/* Song Information & Equalizer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          {/* Album Cover Art */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-black flex-shrink-0 border-2 border-subtle shadow-sm relative">
            {displayCover ? (
              <img
                src={displayCover}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#B6FF00] flex items-center justify-center font-display font-black text-black text-base">
                EMKA
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Disc className="w-6 h-6 text-[#B6FF00] animate-spin" />
              </div>
            )}
          </div>

          {/* Song title, artist & request metadata */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="text-lg sm:text-2xl font-black text-primary font-display truncate leading-tight">
              {displayTitle}
            </h3>
            <p className="text-sm font-semibold text-secondary truncate">
              {displayArtist}
            </p>
            {playingTrack ? (
              <p className="text-xs font-bold text-[#FF4F91] truncate flex items-center gap-1">
                <span>Request by:</span>
                <span>{playingTrack.studentName} - {playingTrack.className}</span>
              </p>
            ) : (
              <p className="text-xs font-bold text-secondary/70">
                107.7 FM On Air
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Animated Equalizer & Actions */}
        <div className="flex items-center space-x-4 flex-shrink-0 self-end sm:self-center">
          {/* Animated Neon Lime Equalizer */}
          <div className="flex items-end space-x-1 h-8 px-3 py-1 rounded-xl bg-elevated border border-subtle">
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-1' : isBuffering ? 'animate-pulse h-2' : 'h-1.5'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-2' : isBuffering ? 'animate-pulse h-3 delay-75' : 'h-3'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-3' : isBuffering ? 'animate-pulse h-2 delay-150' : 'h-5'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-4' : isBuffering ? 'animate-pulse h-3.5 delay-200' : 'h-3.5'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-5' : isBuffering ? 'animate-pulse h-2.5 delay-300' : 'h-6'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-2' : isBuffering ? 'animate-pulse h-4 delay-150' : 'h-4'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-3' : isBuffering ? 'animate-pulse h-2 delay-75' : 'h-2'}`}></span>
            <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-1' : isBuffering ? 'animate-pulse h-1' : 'h-1'}`}></span>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-1 text-secondary">
            {isBuffering && (
              <span className="text-[10px] font-bold text-[#B6FF00] animate-pulse px-2 uppercase">
                Memuat...
              </span>
            )}

            <button
              onClick={handleLikeClick}
              className={`p-2 rounded-xl hover:bg-elevated transition ${
                isLiked ? 'text-[#FF4F91]' : 'hover:text-[#FF4F91]'
              }`}
              title="Sukai Lagu"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#FF4F91] text-[#FF4F91]' : ''}`} />
            </button>

            {playingTrack && onOpenStoryModal && (
              <button
                onClick={() => onOpenStoryModal(playingTrack)}
                className="p-2 rounded-xl hover:bg-elevated hover:text-primary transition"
                title="Bagikan Cerita Siaran"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}

            {isAdmin && playingTrack && (
              <button
                onClick={() => {
                  setCustomYtInput(ytVideoId || playingTrack.youtubeVideoId || '');
                  setIsYtModalOpen(true);
                }}
                className="p-2 rounded-xl hover:bg-elevated hover:text-[#B6FF00] transition"
                title="Ganti / Cek Video ID YouTube (Penyiar)"
              >
                <Link className="w-5 h-5" />
              </button>
            )}

            <button
              className="p-2 rounded-xl hover:bg-elevated hover:text-primary transition"
              title="Opsi Lainnya"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar with Current / Total Time */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-secondary">
          <span>{currentFormatted}</span>
          <span>{totalFormatted}</span>
        </div>

        <div className="relative w-full flex items-center">
          <input
            type="range"
            min="0"
            max={ytDuration > 0 ? ytDuration : 100}
            value={ytCurrentTime}
            onChange={handleSeek}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#B6FF00] bg-secondary"
            style={{
              background: `linear-gradient(to right, #B6FF00 ${progressPercent}%, var(--bg-secondary) ${progressPercent}%)`
            }}
          />
        </div>
      </div>

      {/* Playback Controls Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        {/* Left: Shuffle & Repeat */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleShuffle}
            disabled={!isAdmin}
            className={`p-2.5 rounded-2xl transition border ${
              !isAdmin
                ? 'opacity-40 cursor-not-allowed bg-elevated text-secondary border-subtle'
                : isShuffle
                ? 'bg-[#B6FF00] text-[#0B0B0B] border-black/10'
                : 'bg-elevated text-secondary border-subtle hover:text-primary'
            }`}
            title={isAdmin ? "Acak Lagu" : "Kontrol antrean hanya tersedia untuk penyiar."}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={toggleRepeat}
            disabled={!isAdmin}
            className={`p-2.5 rounded-2xl transition border ${
              !isAdmin
                ? 'opacity-40 cursor-not-allowed bg-elevated text-secondary border-subtle'
                : isRepeat
                ? 'bg-[#B6FF00] text-[#0B0B0B] border-black/10'
                : 'bg-elevated text-secondary border-subtle hover:text-primary'
            }`}
            title={isAdmin ? "Ulangi Lagu" : "Kontrol antrean hanya tersedia untuk penyiar."}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Previous, Play/Pause (Big 52px), Next */}
        <div className="flex items-center space-x-5">
          <button
            onClick={handlePreviousRequest}
            disabled={!isAdmin}
            className={`w-11 h-11 rounded-full flex items-center justify-center border border-subtle transition shadow-xs ${
              !isAdmin
                ? 'opacity-40 cursor-not-allowed bg-elevated text-secondary'
                : 'bg-elevated hover:bg-secondary text-primary active:scale-95'
            }`}
            title={isAdmin ? "Lagu Sebelumnya" : "Kontrol lagu hanya tersedia untuk penyiar."}
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* BIG CIRCULAR PLAY/PAUSE BUTTON (#B6FF00, 52px diameter) */}
          <button
            onClick={togglePlayPause}
            className={`w-14 h-14 rounded-full bg-[#B6FF00] text-[#0B0B0B] flex items-center justify-center border-2 border-black shadow-pop active:scale-95 transition hover:brightness-105 ${isPlaying ? 'is-playing scale-105' : ''}`}
            title={isPlaying ? 'Jeda Lagu' : 'Putar Lagu'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-black text-black" />
            ) : (
              <Play className="w-6 h-6 fill-black text-black ml-1" />
            )}
          </button>

          <button
            onClick={handleNextRequest}
            disabled={!isAdmin}
            className={`w-11 h-11 rounded-full flex items-center justify-center border border-subtle transition shadow-xs ${
              !isAdmin
                ? 'opacity-40 cursor-not-allowed bg-elevated text-secondary'
                : 'bg-elevated hover:bg-secondary text-primary active:scale-95'
            }`}
            title={isAdmin ? "Lagu Berikutnya" : "Kontrol lagu hanya tersedia untuk penyiar."}
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Volume Controls */}
        <div className="flex items-center space-x-2.5 bg-elevated px-3 py-2 rounded-2xl border border-subtle">
          <button
            onClick={toggleMute}
            className="p-1 rounded-lg text-secondary hover:text-primary transition"
            title={ytMuted ? 'Bunyikan' : 'Mute'}
          >
            {ytMuted || ytVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-primary" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={ytMuted ? 0 : ytVolume}
            onChange={handleVolume}
            className="w-20 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer accent-[#B6FF00] bg-secondary"
          />

          <span className="text-[11px] font-mono font-bold text-primary w-7 text-right">
            {ytMuted ? '0%' : `${ytVolume}%`}
          </span>
        </div>
      </div>

      {/* DJ Custom YouTube ID Modal */}
      {isYtModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-subtle rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-[#B6FF00]" />
                <h3 className="font-display font-black text-lg text-primary uppercase tracking-wide">
                  Ganti Sumber YouTube
                </h3>
              </div>
              <button
                onClick={() => setIsYtModalOpen(false)}
                className="text-secondary hover:text-primary p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Masukkan Link Video YouTube (contoh: <code className="bg-secondary px-1.5 py-0.5 rounded text-[11px] text-primary">https://youtube.com/watch?v=xxx</code>) atau 11-digit Video ID untuk lagu <strong>"{displayTitle}"</strong>.
            </p>

            <input
              type="text"
              value={customYtInput}
              onChange={(e) => setCustomYtInput(e.target.value)}
              placeholder="https://youtu.be/... atau Video ID"
              className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-placeholder focus:outline-none focus:border-[#B6FF00]"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsYtModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-secondary hover:bg-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCustomYt}
                className="px-5 py-2.5 rounded-xl bg-[#B6FF00] text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 hover:scale-105 active:scale-95 transition shadow-pop"
              >
                <Check className="w-4 h-4" />
                <span>Simpan & Putar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
