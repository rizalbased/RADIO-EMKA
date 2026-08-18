import React from 'react';
import { History, Play, Music, User, Clock, CheckCircle2, RotateCcw } from 'lucide-react';
import { SongRequest } from '../types';

interface HistoryViewProps {
  requests: SongRequest[];
  onPlayAgain: (id: string) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ requests, onPlayAgain }) => {
  const playedRequests = requests
    .filter((r) => r.status === 'Played')
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-card border border-subtle rounded-3xl p-6 shadow-soft flex items-center justify-between transition-colors">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B6FF00]"></span>
            <span className="text-xs font-black text-secondary tracking-widest uppercase font-display">
              LOG SIARAN
            </span>
          </div>
          <h2 className="text-2xl font-black font-display text-primary tracking-wide uppercase">
            RIWAYAT LAGU TERPUTAR
          </h2>
          <p className="text-xs text-secondary">
            Daftar lagu yang telah selesai mengudara di EMKA Radio.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-elevated border border-subtle text-right">
          <p className="text-xs text-secondary font-semibold">Total Diputar</p>
          <p className="text-xl font-mono font-black text-primary">{playedRequests.length}</p>
        </div>
      </div>

      <div className="bg-card border border-subtle rounded-3xl p-5 shadow-soft space-y-3 transition-colors">
        {playedRequests.length > 0 ? (
          <div className="space-y-2">
            {playedRequests.map((track, idx) => (
              <div
                key={track.id ? `${track.id}-${idx}` : `history-track-${idx}`}
                className="p-3.5 rounded-2xl bg-elevated hover:bg-secondary border border-subtle flex items-center justify-between gap-4 transition"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-subtle">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.songTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#B6FF00]/20 flex items-center justify-center">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-primary truncate">
                      {track.songTitle}
                    </p>
                    <p className="text-xs text-secondary font-medium truncate">
                      {track.artist}
                    </p>
                    <p className="text-[11px] text-[#FF4F91] font-bold truncate">
                      Request by {track.studentName} ({track.className})
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Selesai</span>
                    </span>
                  </div>

                  <button
                    onClick={() => onPlayAgain(track.id)}
                    className="px-3 py-1.5 rounded-xl bg-card hover:bg-elevated text-primary border border-subtle text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shadow-xs"
                    title="Putar ulang lagu ini"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#B6FF00]" />
                    <span>Putar Ulang</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-secondary space-y-2">
            <History className="w-10 h-10 text-secondary mx-auto opacity-40" />
            <p className="text-sm font-bold text-primary">Belum Ada Riwayat Siaran</p>
            <p className="text-xs text-secondary max-w-sm mx-auto">
              Lagu yang selesai diputar di Radio Player akan otomatis tercatat di halaman riwayat ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
