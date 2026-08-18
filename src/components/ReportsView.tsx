import React from 'react';
import { BarChart3, TrendingUp, Music, Users, Sparkles, Heart } from 'lucide-react';
import { SongRequest } from '../types';

interface ReportsViewProps {
  requests: SongRequest[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ requests }) => {
  const total = requests.length;
  const queued = requests.filter(r => r.status === 'Queued').length;
  const played = requests.filter(r => r.status === 'Played').length;

  // Group by mood
  const moodCounts: Record<string, number> = {};
  requests.forEach(r => {
    moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
  });

  // Top Artists
  const artistCounts: Record<string, number> = {};
  requests.forEach(r => {
    artistCounts[r.artist] = (artistCounts[r.artist] || 0) + 1;
  });
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card border border-subtle rounded-3xl p-6 shadow-soft flex items-center justify-between transition-colors">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B6FF00]"></span>
            <span className="text-xs font-black text-secondary tracking-widest uppercase font-display">
              STATISTIK & INSIGHT
            </span>
          </div>
          <h2 className="text-2xl font-black font-display text-primary tracking-wide uppercase">
            LAPORAN SIARAN EMKA RADIO
          </h2>
          <p className="text-xs text-secondary">
            Analisis aktivitas request lagu, artis terpopuler, dan vibe suasana siswa.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-subtle shadow-soft space-y-1">
          <p className="text-xs font-bold text-secondary uppercase">Total Request</p>
          <p className="text-2xl font-display font-black text-primary">{total}</p>
          <p className="text-[10px] text-secondary">Semua lagu masuk</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-subtle shadow-soft space-y-1">
          <p className="text-xs font-bold text-secondary uppercase">Dalam Antrean</p>
          <p className="text-2xl font-display font-black text-[#B6FF00]">{queued}</p>
          <p className="text-[10px] text-secondary">Menunggu giliran</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-subtle shadow-soft space-y-1">
          <p className="text-xs font-bold text-secondary uppercase">Telah Diputar</p>
          <p className="text-2xl font-display font-black text-emerald-500">{played}</p>
          <p className="text-[10px] text-secondary">Sukses mengudara</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-subtle shadow-soft space-y-1">
          <p className="text-xs font-bold text-secondary uppercase">Suasana Teratas</p>
          <p className="text-lg font-display font-black text-[#FF4F91] truncate">
            {Object.keys(moodCounts)[0] || 'Vibe Check'}
          </p>
          <p className="text-[10px] text-secondary">Mood dominan</p>
        </div>
      </div>

      {/* Top Artists & Mood Distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Top Artists */}
        <div className="bg-card border border-subtle rounded-3xl p-5 shadow-soft space-y-4">
          <h3 className="text-base font-black font-display text-primary uppercase flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-[#B6FF00]" />
            <span>ARTIS PALING BANYAK DI-REQUEST</span>
          </h3>

          <div className="space-y-2">
            {topArtists.length > 0 ? (
              topArtists.map(([artist, count], idx) => (
                <div key={artist} className="flex items-center justify-between p-2.5 rounded-xl bg-elevated border border-subtle">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-secondary w-4">#{idx + 1}</span>
                    <p className="text-xs font-black text-primary truncate">{artist}</p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-card text-[#FF4F91] border border-subtle">
                    {count} lagu
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-secondary text-center py-4">Belum ada data artis</p>
            )}
          </div>
        </div>

        {/* Mood Distribution */}
        <div className="bg-card border border-subtle rounded-3xl p-5 shadow-soft space-y-4">
          <h3 className="text-base font-black font-display text-primary uppercase flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#FF4F91]" />
            <span>KATEGORI & VIBE SISWA</span>
          </h3>

          <div className="space-y-2">
            {Object.entries(moodCounts).map(([mood, count]) => (
              <div key={mood} className="flex items-center justify-between p-2.5 rounded-xl bg-elevated border border-subtle">
                <p className="text-xs font-bold text-primary truncate">{mood}</p>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-card text-primary border border-subtle">
                  {count} request
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
