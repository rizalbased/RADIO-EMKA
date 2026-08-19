import React from 'react';
import {
  Trash2,
  MoreVertical,
  GripVertical,
  Play,
  Music,
  Clock,
  Sparkles,
  Heart,
  Disc,
  AlertTriangle
} from 'lucide-react';
import { SongRequest } from '../types';
import { useRadioEngine } from '../contexts/RadioEngineContext';
import { getLastAdminQueueError } from '../services/api';

interface QueuePanelProps {
  requests: SongRequest[];
  onUpdateStatus: (id: string, status: 'Queued' | 'Playing' | 'Played') => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onClearAllRequests: () => Promise<void>;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  requests,
  onUpdateStatus,
  onDeleteRequest,
  onClearAllRequests,
  onOpenStoryModal
}) => {
  const { ytPlayerState, playQueueTrack } = useRadioEngine();
  const isPlaying = ytPlayerState === 1;
  const adminQueueError = getLastAdminQueueError();

  // Strict FIFO: sort queued requests by oldest timestamp first
  const queuedRequests = requests
    .filter((r) => r.status === 'Queued' || r.status === 'pending')
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

  const playingTrack = requests.find((r) => r.status === 'Playing' || r.status === 'playing');

  const handlePlayNow = async (req: SongRequest) => {
    await playQueueTrack(req);
  };

  return (
    <div className="bg-card border border-subtle rounded-3xl p-5 shadow-soft flex flex-col h-full transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-subtle">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-black font-display text-primary tracking-wide uppercase">
            ANTREAN
          </h2>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-elevated text-secondary border border-subtle">
            {queuedRequests.length}
          </span>
        </div>

        {queuedRequests.length > 0 && (
          <button
            onClick={onClearAllRequests}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold text-[#FF4F91] hover:bg-[#FF4F91]/10 border border-[#FF4F91]/30 transition"
            title="Hapus semua lagu dalam antrean"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Antrean</span>
          </button>
        )}
      </div>

      {/* RLS / Diagnostic Error Banner */}
      {adminQueueError && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-mono uppercase">[ADMIN QUEUE ERROR]</span>
          </div>
          <p className="font-mono text-[11px]">
            {adminQueueError.code ? `code: ${adminQueueError.code} ` : ''}
            message: {adminQueueError.message}
          </p>
        </div>
      )}

      {/* SEDANG DIPUTAR (NOW PLAYING) */}
      <div className="pt-4 pb-2 space-y-2">
        <p className="text-[11px] font-black text-secondary uppercase tracking-wider font-display">
          SEDANG DIPUTAR
        </p>

        {playingTrack ? (
          <div className="p-3 rounded-2xl bg-elevated border-l-4 border-l-[#B6FF00] border-y border-r border-subtle flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-subtle shadow-sm">
                {playingTrack.coverUrl ? (
                  <img
                    src={playingTrack.coverUrl}
                    alt={playingTrack.songTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#B6FF00] flex items-center justify-center font-display font-black text-black text-xs">
                    EMKA
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Disc className="w-4 h-4 text-[#B6FF00] animate-spin" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-primary truncate">
                  {playingTrack.songTitle}
                </p>
                <p className="text-[11px] text-secondary font-medium truncate">
                  {playingTrack.artist}
                </p>
                <p className="text-[10px] text-[#FF4F91] font-bold truncate">
                  {playingTrack.studentName} ({playingTrack.className})
                </p>
              </div>
            </div>

            {/* Visualizer bars */}
            <div className="flex items-end space-x-0.5 h-5 flex-shrink-0 px-2">
              <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-1' : 'h-1'}`}></span>
              <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-2' : 'h-2'}`}></span>
              <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-3' : 'h-3'}`}></span>
              <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-4' : 'h-2'}`}></span>
              <span className={`w-1 bg-[#B6FF00] rounded-full transition-all ${isPlaying ? 'eq-bar-5' : 'h-1.5'}`}></span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-elevated border border-dashed border-subtle text-center">
            <p className="text-xs font-bold text-secondary">
              Tidak ada lagu yang sedang diputar
            </p>
          </div>
        )}
      </div>

      {/* BERIKUTNYA (UP NEXT QUEUE) */}
      <div className="pt-3 flex-1 flex flex-col min-h-0">
        <p className="text-[11px] font-black text-secondary uppercase tracking-wider font-display mb-2">
          BERIKUTNYA
        </p>

        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[460px] scrollbar-none">
          {queuedRequests.length > 0 ? (
            queuedRequests.map((track, idx) => {
              const numStr = (idx + 1).toString().padStart(2, '0');
              return (
                <div
                  key={track.id ? `${track.id}-${idx}` : `queue-track-${idx}`}
                  className="group p-2.5 rounded-2xl bg-card hover:bg-elevated border border-subtle flex items-center justify-between gap-3 transition-all duration-150"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {/* Index Number */}
                    <span className="text-xs font-mono font-bold text-secondary group-hover:text-primary w-5 text-center flex-shrink-0">
                      {numStr}
                    </span>

                    {/* Cover Art */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-elevated flex-shrink-0 border border-subtle relative">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.songTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#B6FF00]/20 flex items-center justify-center text-xs font-bold text-[#B6FF00]">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                      )}

                      {/* Quick Play overlay button on hover */}
                      <button
                        onClick={() => handlePlayNow(track)}
                        className="absolute inset-0 bg-black/60 text-[#B6FF00] opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                        title="Putar Sekarang"
                      >
                        <Play className="w-4 h-4 fill-[#B6FF00]" />
                      </button>
                    </div>

                    {/* Track info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-primary truncate group-hover:text-[#FF4F91] transition">
                        {track.songTitle}
                      </p>
                      <p className="text-[11px] text-secondary font-medium truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Handle */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={() => onDeleteRequest(track.id)}
                      className="p-1.5 rounded-lg text-secondary hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                      title="Hapus dari antrean"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1 text-secondary">
                      <GripVertical className="w-4 h-4 cursor-grab" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-secondary rounded-2xl bg-elevated border border-dashed border-subtle space-y-2 my-auto">
              <Music className="w-8 h-8 text-secondary mx-auto opacity-50" />
              <p className="text-xs font-bold text-primary">Antrean Kosong</p>
              <p className="text-[11px] text-secondary">
                Request baru dari siswa akan otomatis masuk ke sini sesuai urutan FIFO.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
