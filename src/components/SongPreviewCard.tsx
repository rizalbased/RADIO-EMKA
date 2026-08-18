import React, { useState } from 'react';
import { Play, Pause, Heart, MessageCircleHeart, Disc, Share2, Check, User, ImageIcon, Trash2 } from 'lucide-react';
import { SongRequest } from '../types';

interface SongPreviewCardProps {
  request: Partial<SongRequest>;
  onLike?: (id: string) => void;
  isInteractive?: boolean;
  isUpNext?: boolean;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
  userRole?: 'user' | 'admin';
  onDelete?: (id: string) => void;
}

const MOOD_COLORS: Record<string, string> = {
  '💌 Secret Confession': 'bg-pink/15 text-pink border-pink/30',
  '🎧 Vibe Check': 'bg-blue/15 text-primary border-blue/40',
  '💔 Galau Time': 'bg-purple/15 text-purple border-purple/30',
  '🔥 Hype Track': 'bg-neon text-black border-black/20',
  '🎂 Ultah Wish': 'bg-amber-300 text-black border-black/20',
  '☕ Chill Afternoon': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

export const SongPreviewCard: React.FC<SongPreviewCardProps> = ({
  request,
  onLike,
  isInteractive = true,
  isUpNext = false,
  onOpenStoryModal,
  userRole,
  onDelete
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [copied, setCopied] = useState(false);

  const coverUrl = request.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  const moodBadgeClass = MOOD_COLORS[request.mood || '🎧 Vibe Check'] || 'bg-neon text-black border-black/20';

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!request.previewUrl) return;

    if (isPlayingAudio && audioRef) {
      audioRef.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioRef) {
        audioRef.play();
        setIsPlayingAudio(true);
      } else {
        const audio = new Audio(request.previewUrl);
        audio.onended = () => setIsPlayingAudio(false);
        audio.play().catch(() => {});
        setAudioRef(audio);
        setIsPlayingAudio(true);
      }
    }
  };

  const handleCopyCardText = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🎵 Request Lagu: ${request.songTitle || 'Judul'} - ${request.artist || 'Penyanyi'}\n💌 Dari: ${request.studentName || 'Nama'} (${request.className || 'Kelas'})\n💘 Untuk: ${request.targetPerson || 'Doi'}\n💬 Pesan: "${request.message || ''}"\n✨ EMKA Radio Request`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group relative rounded-[28px] bg-card p-5 border-2 shadow-soft hover:shadow-md transition-all duration-300 ${
      isUpNext ? 'border-blue ring-2 ring-blue/20' : 'border-primary hover:border-primary/80'
    }`}>
      {/* Mood Sticker Tag & Status Badge */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <span className={`text-xs font-black px-3.5 py-1 rounded-full border flex items-center space-x-1 ${moodBadgeClass}`}>
          <span>{request.mood || '🎧 Vibe Check'}</span>
        </span>

        <div className="flex items-center space-x-1.5">
          {isUpNext && request.status === 'Queued' && (
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue text-black border border-black/20">
              ⏭️ UP NEXT
            </span>
          )}
          {request.status && (
            <span className={`text-[11px] font-black px-3 py-0.5 rounded-full border ${
              request.status === 'Playing'
                ? 'bg-neon text-black border-black/20 animate-pulse'
                : request.status === 'Queued'
                ? 'bg-amber-300 text-black border-black/20'
                : 'bg-elevated text-secondary border-subtle'
            }`}>
              {request.status === 'Playing' ? '🎵 Sedang Muter' : request.status === 'Queued' ? '🕒 Di Antrean' : '✅ Selesai'}
            </span>
          )}
        </div>
      </div>

      {/* Album Cover & Vinyl Display */}
      <div className="relative mb-5 flex items-center justify-center py-2">
        <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
          {/* Vinyl Record Shadow Effect */}
          <div className={`absolute -right-3 w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-black border-4 border-slate-800 flex items-center justify-center shadow-md transition-transform duration-700 ${
            isPlayingAudio || request.status === 'Playing' ? 'animate-spin' : 'group-hover:translate-x-3'
          }`} style={{ animationDuration: '8s' }}>
            <div className="w-16 h-16 rounded-full border-2 border-slate-700 bg-pink flex items-center justify-center">
              <Disc className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Album Cover Art */}
          <div className="relative z-10 w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-md border-2 border-black group-hover:scale-105 transition-transform duration-300">
            <img 
              src={coverUrl} 
              alt={request.songTitle || 'Cover'} 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
              }}
            />

            {/* Audio Play Overlay if preview exists */}
            {request.previewUrl && (
              <button
                onClick={toggleAudio}
                className="absolute inset-0 bg-black/30 hover:bg-black/10 flex items-center justify-center transition"
              >
                <div className="w-12 h-12 rounded-full bg-neon text-black border-2 border-black flex items-center justify-center shadow-md transform group-hover:scale-110 transition">
                  {isPlayingAudio ? <Pause className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 ml-0.5 text-black" />}
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Track & Artist Info */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-black text-primary truncate group-hover:text-pink transition-colors font-display">
          {request.songTitle || 'Judul Lagu'}
        </h3>
        <p className="text-sm font-bold text-secondary truncate">
          {request.artist || 'Penyanyi'}
        </p>
      </div>

      {/* Confession Box / Dedication Note */}
      <div className="bg-elevated rounded-2xl p-3.5 border border-subtle space-y-2 relative overflow-hidden mb-4">
        <div className="flex items-center justify-between text-[11px] text-secondary">
          <span className="flex items-center gap-1 font-bold text-primary">
            <User className="w-3.5 h-3.5 text-pink" />
            <span>{request.studentName || 'Nama Siswa'}</span>
            <span className="text-pink">({request.className || 'Kelas'})</span>
          </span>
          <span className="text-purple font-black">➡️ {request.targetPerson || 'Doi'}</span>
        </div>

        <div className="bg-card border border-subtle rounded-xl p-2.5 text-xs text-primary italic flex items-start space-x-2">
          <MessageCircleHeart className="w-4 h-4 text-pink flex-shrink-0 mt-0.5" />
          <p className="line-clamp-3 font-semibold">"{request.message || 'Belum ada pesan confession...'}"</p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-subtle text-xs text-secondary gap-2">
        <div className="flex items-center space-x-2">
          {onLike && request.id && (
            <button
              onClick={() => onLike(request.id!)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-pink/10 hover:bg-pink/20 text-pink font-black transition active:scale-95 border border-pink/20"
            >
              <Heart className="w-3.5 h-3.5 fill-pink text-pink" />
              <span>{request.likes || 0} Vibe</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {onOpenStoryModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenStoryModal(request);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-[#0B0B0B] dark:bg-elevated hover:bg-slate-800 text-neon text-[11px] font-black transition shadow-sm active:scale-95 border border-black dark:border-subtle"
              title="Download Card untuk Story Instagram (9:16)"
            >
              <ImageIcon className="w-3.5 h-3.5 text-neon" />
              <span>Story 9:16</span>
            </button>
          )}

          <button
            onClick={handleCopyCardText}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-full bg-elevated hover:bg-secondary text-primary text-[11px] font-bold transition border border-subtle"
            title="Salin teks request untuk story"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3 text-secondary" />
                <span className="hidden sm:inline">Salin</span>
              </>
            )}
          </button>

          {userRole === 'admin' && onDelete && request.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(request.id!);
              }}
              className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition ml-1"
              title="Hapus request (Mode Admin)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
