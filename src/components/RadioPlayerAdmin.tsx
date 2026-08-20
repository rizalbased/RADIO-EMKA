import React from 'react';
import { useRadioEngine } from '../contexts/RadioEngineContext';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Trash2,
  Music,
  Clock,
  User,
  Disc,
  Layers,
  Heart,
  MessageSquare,
  Square
} from 'lucide-react';
import { SongRequest } from '../types';

interface RadioPlayerAdminProps {
  requests: SongRequest[];
  onUpdateStatus: (id: string, status: 'Queued' | 'Playing' | 'Played') => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onClearAllRequests: () => Promise<void>;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
}

export const RadioPlayerAdmin: React.FC<RadioPlayerAdminProps> = ({
  requests,
  onUpdateStatus,
  onDeleteRequest,
  onClearAllRequests,
  onOpenStoryModal
}) => {
  const {
    ytPlayerState,
    ytVolume,
    ytMuted,
    ytDuration,
    ytCurrentTime,
    ytVideoId,
    isSearchingYt,
    autoPlay,
    toggleAutoPlay,
    togglePlayPause,
    handleStopRadio,
    toggleMute,
    handleSeekChange,
    handleNextRequest,
    playQueueTrack,
    setYtVolume,
    isMasterTab,
    radioState
  } = useRadioEngine();

  const currentPlayingId = (radioState && radioState.status === 'playing') ? radioState.current_request_id : null;

  const playingTrack = currentPlayingId
    ? requests.find((r) => r.id === currentPlayingId) || (radioState?.current_title ? {
        id: currentPlayingId,
        songTitle: radioState.current_title,
        artist: radioState.current_channel_title || '',
        coverUrl: radioState.current_thumbnail_url || undefined,
        status: 'Playing'
      } as SongRequest : undefined)
    : undefined;

  // Strict FIFO: sort queued requests by oldest arrival time first (excluding currently playing track)
  const queuedRequests = requests
    .filter((r) => (r.status === 'Queued' || r.status === 'pending') && r.id !== currentPlayingId)
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

  const isPlaying = ytPlayerState === 1 || radioState?.status === 'playing';

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayDirectly = async (request: SongRequest) => {
    await playQueueTrack(request);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ========================================================================= */}
      {/* LEFT / CENTER: YOUTUBE STAGE & PLAYER CONTROLS                           */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full flex flex-col gap-6">
        {/* Stage Container */}
        <div className="bg-card border-2 border-primary rounded-3xl p-4 sm:p-6 shadow-soft transition-colors">
          {/* Top Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-subtle">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-neon animate-ping' : 'bg-secondary'}`}></div>
              <span className="font-display text-lg font-black tracking-wide text-primary uppercase">
                EMKA RADIO LIVE STAGE
              </span>
              <span className="bg-neon text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {isPlaying ? 'ON AIR' : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Autoplay FIFO Switch */}
              <button
                onClick={toggleAutoPlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition border ${
                  autoPlay
                    ? 'bg-neon text-black border-black shadow-sm'
                    : 'bg-elevated text-secondary border-subtle'
                }`}
                title="Autoplay memutar antrean FIFO secara otomatis saat lagu selesai"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Autoplay FIFO: {autoPlay ? 'AKTIF' : 'OFF'}</span>
              </button>

              {/* Master Tab indicator */}
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  isMasterTab
                    ? 'bg-blue/10 text-blue border-blue/30'
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                }`}
              >
                {isMasterTab ? 'Master Tab' : 'Slave Tab (Muted)'}
              </span>
            </div>
          </div>

          {/* YouTube Video Placeholder (GlobalYouTubePlayer smoothly mounts here) */}
          <div
            id="youtube-placeholder"
            className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-pop-dark relative border-2 border-primary flex items-center justify-center"
          >
            {(!ytVideoId || isSearchingYt) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white space-y-3 p-6 text-center z-10">
                <Disc className="w-12 h-12 text-neon animate-spin" />
                <p className="font-display font-black text-xl tracking-wider text-neon">
                  {isSearchingYt ? 'MENCARI AUDIO YOUTUBE...' : 'STANDBY / TIDAK ADA LAGU'}
                </p>
                <p className="text-xs text-gray-400 max-w-sm font-sans">
                  {queuedRequests.length > 0
                    ? `Ada ${queuedRequests.length} lagu di antrean. Klik Play untuk memulai antrean!`
                    : 'Pilih lagu dari antrean atau tunggu kiriman request dari siswa.'}
                </p>
              </div>
            )}

            {!isMasterTab && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white space-y-2 p-4 text-center z-20">
                <VolumeX className="w-10 h-10 text-rose-400" />
                <p className="font-bold text-sm">Tab Ini Sekunder (Audio di-Mute)</p>
                <p className="text-xs text-gray-400">Gunakan tombol Play untuk mengambil alih kendali utama.</p>
              </div>
            )}
          </div>

          {/* Now Playing Info Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-elevated border border-subtle">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-xl bg-black overflow-hidden flex-shrink-0 border border-subtle relative shadow-md">
                {playingTrack?.coverUrl ? (
                  <img
                    src={playingTrack.coverUrl}
                    alt={playingTrack.songTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-neon flex items-center justify-center font-display font-black text-xl text-black">
                    EMKA
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="flex items-end gap-1 h-5">
                      <div className="w-1 bg-neon h-full animate-[bounce_0.8s_infinite]"></div>
                      <div className="w-1 bg-neon h-3/4 animate-[bounce_0.8s_infinite_150ms]"></div>
                      <div className="w-1 bg-neon h-1/2 animate-[bounce_0.8s_infinite_300ms]"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-display font-black text-primary truncate">
                    {playingTrack ? playingTrack.songTitle : 'EMKA Radio Standby'}
                  </h2>
                  {playingTrack?.mood && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink/10 text-pink border border-pink/20 flex-shrink-0">
                      {playingTrack.mood}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-secondary truncate">
                  {playingTrack ? playingTrack.artist : 'Rehat Sejenak • Menunggu Request'}
                </p>
                {playingTrack && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-secondary font-medium">
                    <span className="flex items-center gap-1 text-pink font-bold">
                      <User className="w-3 h-3" /> {playingTrack.studentName} ({playingTrack.className})
                    </span>
                    {playingTrack.targetPerson && (
                      <span>&rarr; untuk <strong className="text-primary">{playingTrack.targetPerson}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {playingTrack && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {onOpenStoryModal && (
                  <button
                    onClick={() => onOpenStoryModal(playingTrack)}
                    className="px-3.5 py-2 rounded-xl bg-card border border-primary hover:border-pink text-xs font-black text-primary hover:text-pink transition flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-pink" />
                    <span>Story Card 9:16</span>
                  </button>
                )}
                <button
                  onClick={() => onDeleteRequest(playingTrack.id)}
                  className="p-2 rounded-xl bg-card hover:bg-rose-500/10 text-secondary hover:text-rose-500 border border-subtle transition active:scale-95"
                  title="Hapus lagu yang sedang diputar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Progress Timeline & Seek Slider */}
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs font-mono font-bold text-secondary">
              <span>{formatTime(ytCurrentTime)}</span>
              <span>{formatTime(ytDuration)}</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max={ytDuration || 100}
                value={ytCurrentTime}
                onChange={(e) => handleSeekChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full bg-secondary appearance-none cursor-pointer accent-neon transition"
              />
            </div>
          </div>

          {/* Player Control Toolbar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-2">
            {/* Left Aux Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (playingTrack) {
                    onUpdateStatus(playingTrack.id, 'Played');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-elevated hover:bg-secondary text-xs font-bold text-secondary hover:text-primary transition border border-subtle"
                title="Tandai lagu saat ini sebagai Selesai Diputar"
              >
                Tandai Selesai
              </button>

              <button
                onClick={handleStopRadio}
                className="px-3 py-1.5 rounded-xl bg-elevated hover:bg-rose-500/10 text-xs font-bold text-secondary hover:text-rose-500 transition border border-subtle flex items-center gap-1.5"
                title="Hentikan siaran radio (masuk mode Standby)"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>

            {/* Center Main Playback Controls */}
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => handleSeekChange(Math.max(0, ytCurrentTime - 10))}
                className="w-10 h-10 rounded-full bg-elevated hover:bg-secondary text-primary flex items-center justify-center transition border border-subtle active:scale-95"
                title="Mundur 10 Detik"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlayPause}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-neon text-black flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(11,11,11,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-black text-black" />
                ) : (
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-black text-black ml-1" />
                )}
              </button>

              <button
                onClick={handleNextRequest}
                className="w-10 h-10 rounded-full bg-elevated hover:bg-secondary text-primary flex items-center justify-center transition border border-subtle active:scale-95"
                title="Lagu Berikutnya (FIFO)"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right Volume Control */}
            <div className="flex items-center gap-2 bg-elevated px-3 py-1.5 rounded-2xl border border-subtle">
              <button
                onClick={toggleMute}
                className="text-secondary hover:text-primary transition"
                title={ytMuted ? 'Unmute' : 'Mute'}
              >
                {ytMuted || ytVolume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-500" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={ytMuted ? 0 : ytVolume}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setYtVolume(val);
                }}
                className="w-20 sm:w-24 h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
              />
              <span className="text-[11px] font-mono font-bold text-secondary w-7 text-right">
                {ytMuted ? '0%' : `${ytVolume}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: FIFO ANTREAN (QUEUE)                                        */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-96 xl:w-[420px] flex flex-col gap-4 flex-shrink-0">
        {/* Antrean Header Card */}
        <div className="bg-card border-2 border-primary rounded-3xl p-5 shadow-soft transition-colors flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between pb-4 border-b border-subtle mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-neon" />
              <h3 className="font-display font-black text-xl text-primary uppercase tracking-wide">
                ANTREAN FIFO
              </h3>
              <span className="bg-neon text-black text-xs font-black px-2.5 py-0.5 rounded-full">
                {queuedRequests.length}
              </span>
            </div>

            {queuedRequests.length > 0 && (
              <button
                onClick={onClearAllRequests}
                className="text-xs font-bold text-pink hover:text-pink/80 border border-pink/30 hover:border-pink px-2.5 py-1 rounded-full transition flex items-center gap-1"
                title="Hapus semua antrean lagu"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bersihkan</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Sedang Diputar */}
            <div>
              <p className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-neon animate-spin" />
                <span>SEDANG DIPUTAR</span>
              </p>

              {playingTrack ? (
                <div className="p-3.5 rounded-2xl bg-neon/10 border-2 border-neon flex items-start gap-3 transition">
                  <div className="w-12 h-12 rounded-xl bg-black overflow-hidden flex-shrink-0 shadow">
                    {playingTrack.coverUrl ? (
                      <img
                        src={playingTrack.coverUrl}
                        alt={playingTrack.songTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-neon flex items-center justify-center font-black text-xs text-black">
                        EMKA
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-primary truncate">{playingTrack.songTitle}</p>
                    <p className="text-xs font-semibold text-secondary truncate">{playingTrack.artist}</p>
                    <p className="text-[11px] text-pink font-bold mt-1 truncate">
                      Request: {playingTrack.studentName} ({playingTrack.className})
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteRequest(playingTrack.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition"
                    title="Hapus lagu ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border-2 border-dashed border-subtle text-center text-xs font-bold text-secondary bg-elevated">
                  Radio Standby • Belum ada lagu diputar
                </div>
              )}
            </div>

            {/* Antrean Berikutnya (Strict FIFO list) */}
            <div>
              <p className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue" />
                  <span>BERIKUTNYA (FIFO URUTAN PERTAMA)</span>
                </span>
                <span className="text-[10px] text-secondary font-mono">Earliest First</span>
              </p>

              {queuedRequests.length > 0 ? (
                <div className="space-y-2.5">
                  {queuedRequests.map((req, idx) => (
                    <div
                      key={req.id ? `${req.id}-${idx}` : `radio-admin-req-${idx}`}
                      className="p-3 rounded-2xl bg-elevated hover:bg-secondary/70 border border-subtle transition flex items-center justify-between gap-3 group"
                    >
                      {/* Queue Number */}
                      <span className="font-mono text-xs font-black text-secondary w-6 text-center">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>

                      {/* Cover Art */}
                      <div className="w-11 h-11 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-subtle">
                        {req.coverUrl ? (
                          <img
                            src={req.coverUrl}
                            alt={req.songTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold">
                            🎵
                          </div>
                        )}
                      </div>

                      {/* Song Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary truncate">{req.songTitle}</p>
                        <p className="text-[11px] text-secondary truncate">{req.artist}</p>
                        <p className="text-[10px] text-pink font-semibold truncate">
                          {req.studentName} ({req.className})
                        </p>
                      </div>

                      {/* Action buttons on hover / touch */}
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handlePlayDirectly(req)}
                          className="w-8 h-8 rounded-full bg-neon hover:bg-neon/90 text-black flex items-center justify-center font-bold text-xs shadow-sm transition active:scale-95"
                          title="Putar Sekarang Langsung"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                        </button>
                        <button
                          onClick={() => onDeleteRequest(req.id)}
                          className="w-8 h-8 rounded-full bg-card hover:bg-rose-500/10 text-secondary hover:text-rose-500 flex items-center justify-center border border-subtle transition active:scale-95"
                          title="Hapus dari antrean"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-subtle bg-elevated text-center space-y-2">
                  <Music className="w-8 h-8 text-secondary mx-auto opacity-50" />
                  <p className="text-xs font-bold text-secondary">
                    Antrean kosong. Belum ada request lagu baru.
                  </p>
                  <p className="text-[11px] text-secondary/70">
                    Siswa dapat mengirimkan request melalui menu Request Lagu.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
