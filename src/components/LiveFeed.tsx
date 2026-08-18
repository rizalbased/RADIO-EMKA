import React, { useState } from 'react';
import { Search, Trash2, Music } from 'lucide-react';
import { SongRequest, MoodTag, SheetConfig } from '../types';
import { SongPreviewCard } from './SongPreviewCard';

interface LiveFeedProps {
  requests: SongRequest[];
  onLikeRequest: (id: string) => void;
  isSyncing: boolean;
  onRefresh: () => void;
  sheetConfig: SheetConfig;
  onOpenSheetModal: () => void;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
  userRole?: 'user' | 'admin';
  onDeleteRequest?: (id: string) => Promise<void>;
  onClearAllRequests?: () => Promise<void>;
}

const ALL_MOODS: MoodTag[] = [
  '💌 Secret Confession',
  '🎧 Vibe Check',
  '💔 Galau Time',
  '🔥 Hype Track',
  '🎂 Ultah Wish',
  '☕ Chill Afternoon'
];

export const LiveFeed: React.FC<LiveFeedProps> = ({
  requests,
  onLikeRequest,
  onOpenStoryModal,
  userRole,
  onDeleteRequest,
  onClearAllRequests
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Filter logic
  const filteredRequests = requests.filter((req) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      req.songTitle.toLowerCase().includes(query) ||
      req.artist.toLowerCase().includes(query) ||
      req.studentName.toLowerCase().includes(query) ||
      req.className.toLowerCase().includes(query) ||
      req.targetPerson.toLowerCase().includes(query) ||
      req.message.toLowerCase().includes(query);

    const matchesMood = selectedMood === 'all' || req.mood === selectedMood;
    const matchesStatus = selectedStatus === 'all' || req.status === selectedStatus;

    return matchesSearch && matchesMood && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-card border-2 border-primary rounded-[28px] p-5 space-y-4 shadow-soft transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Search Field */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-secondary absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Cari lagu, artis, nama siswa, kelas, atau pesan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition"
            />
          </div>

          {/* Status Tab Filters */}
          <div className="md:col-span-6 flex items-center justify-start md:justify-end space-x-1 bg-elevated p-1.5 rounded-2xl border border-subtle">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                selectedStatus === 'all'
                  ? 'bg-neon text-black shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Semua ({requests.length})
            </button>
            <button
              onClick={() => setSelectedStatus('Queued')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                selectedStatus === 'Queued'
                  ? 'bg-amber-300 text-black border border-black/20 shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              🕒 Antrean
            </button>
            <button
              onClick={() => setSelectedStatus('Playing')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                selectedStatus === 'Playing'
                  ? 'bg-neon text-black border border-black/20 shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              🎵 Diputar
            </button>
            <button
              onClick={() => setSelectedStatus('Played')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                selectedStatus === 'Played'
                  ? 'bg-secondary text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              ✅ Selesai
            </button>
          </div>
        </div>

        {/* Mood Chips Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <span className="text-secondary font-extrabold text-[11px] uppercase mr-1">Mood:</span>
          <button
            onClick={() => setSelectedMood('all')}
            className={`px-3.5 py-1.5 rounded-full font-black transition whitespace-nowrap border ${
              selectedMood === 'all'
                ? 'bg-neon text-black border-black shadow-sm'
                : 'bg-elevated text-secondary hover:text-primary border-subtle'
            }`}
          >
            ✨ Semua Mood
          </button>

          {ALL_MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMood(m)}
              className={`px-3.5 py-1.5 rounded-full font-black transition whitespace-nowrap border ${
                selectedMood === m
                  ? 'bg-pink text-white border-pink shadow-sm'
                  : 'bg-elevated text-secondary hover:text-primary border-subtle'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Quick Clear Bar */}
      {userRole === 'admin' && requests.length > 0 && onClearAllRequests && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-bold">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Mode Admin: {requests.length} Request Tersimpan</span>
          </div>
          <button
            onClick={async () => {
              if (confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA RIWAYAT request lagu & confession?')) {
                await onClearAllRequests();
              }
            }}
            className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shadow flex items-center space-x-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Semua Riwayat ({requests.length})</span>
          </button>
        </div>
      )}

      {/* Request Grid Cards */}
      {filteredRequests.length === 0 ? (
        <div className="bg-card border-2 border-primary rounded-[28px] p-12 text-center space-y-3 shadow-soft">
          <Music className="w-12 h-12 text-pink mx-auto animate-bounce" />
          <h3 className="text-lg font-black text-primary font-display uppercase">Belum Ada Request Lagu Yang Sesuai</h3>
          <p className="text-xs font-semibold text-secondary max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau mood filter di atas, atau jadilah yang pertama merequest lagu hari ini!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            const firstQueued = requests.find((r) => r.status === 'Queued');
            return [...filteredRequests].reverse().map((req, idx) => (
              <SongPreviewCard
                key={req.id ? `${req.id}-${idx}` : `feed-req-${idx}`}
                request={req}
                onLike={onLikeRequest}
                isInteractive={true}
                isUpNext={firstQueued?.id === req.id}
                onOpenStoryModal={onOpenStoryModal}
                userRole={userRole}
                onDelete={onDeleteRequest}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
};
