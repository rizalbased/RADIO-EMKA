import React, { useState } from 'react';
import { Radio, Disc, Heart, Sparkles, MessageCircleHeart, Play, Pause, UserCheck, Mic, Image as ImageIcon, ListMusic, ArrowRight, User } from 'lucide-react';
import { SongRequest, RadioHost } from '../types';
import { decodeHtmlEntities } from '../lib/textUtils';

interface CurrentlyPlayingProps {
  currentTrack?: SongRequest;
  nextTrack?: SongRequest;
  queuedRequests?: SongRequest[];
  queuedCount?: number;
  onLike?: (id: string) => void;
  onOpenAiWingman?: () => void;
  radioHost?: RadioHost;
  radioHosts?: RadioHost[];
  userRole?: 'user' | 'admin';
  onGoToDjStudio?: () => void;
  onGoToRequestTab?: () => void;
  onGoToFeedTab?: () => void;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
}

export const CurrentlyPlaying: React.FC<CurrentlyPlayingProps> = ({
  currentTrack,
  nextTrack,
  queuedRequests = [],
  queuedCount = 0,
  onLike,
  onOpenAiWingman,
  radioHost,
  radioHosts,
  userRole,
  onGoToDjStudio,
  onGoToRequestTab,
  onGoToFeedTab,
  onOpenStoryModal
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // Next Track preview audio state
  const [isPlayingNextAudio, setIsPlayingNextAudio] = useState(false);
  const [nextAudioRef, setNextAudioRef] = useState<HTMLAudioElement | null>(null);

  // Only show hosts if admin has entered their names
  const activeHosts: RadioHost[] = (radioHosts && radioHosts.length > 0 
    ? radioHosts 
    : (radioHost ? [radioHost] : [])
  ).filter(h => h && h.name && h.name.trim().length > 0);

  const upcomingTrack = nextTrack || (queuedRequests.length > 0 ? queuedRequests[0] : undefined);
  const totalQueued = queuedCount > 0 ? queuedCount : queuedRequests.length;

  const toggleAudio = () => {
    if (!currentTrack?.previewUrl) return;

    if (isPlayingAudio && audioRef) {
      audioRef.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioRef) {
        audioRef.play();
        setIsPlayingAudio(true);
      } else {
        const audio = new Audio(currentTrack.previewUrl);
        audio.onended = () => setIsPlayingAudio(false);
        audio.play().catch(() => {});
        setAudioRef(audio);
        setIsPlayingAudio(true);
      }
    }
  };

  const toggleNextAudio = () => {
    if (!upcomingTrack?.previewUrl) return;

    if (isPlayingNextAudio && nextAudioRef) {
      nextAudioRef.pause();
      setIsPlayingNextAudio(false);
    } else {
      if (nextAudioRef) {
        nextAudioRef.play();
        setIsPlayingNextAudio(true);
      } else {
        const audio = new Audio(upcomingTrack.previewUrl);
        audio.onended = () => setIsPlayingNextAudio(false);
        audio.play().catch(() => {});
        setNextAudioRef(audio);
        setIsPlayingNextAudio(true);
      }
    }
  };

  return (
    <div className="space-y-5 mb-8">
      {/* Radio Hosts / Penyiar On Air Banner */}
      {activeHosts.length > 0 && (
        <div className="bg-card border-2 border-primary rounded-[28px] p-5 shadow-soft space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-subtle pb-3">
            <div className="flex items-center space-x-2">
              <span className="bg-neon text-black text-xs font-black px-3 py-1 rounded-full border border-black/20 flex items-center space-x-1.5 shadow-sm">
                <Mic className="w-3.5 h-3.5 text-black animate-pulse" />
                <span>TIM PENYIAR EMKA RADIO ({activeHosts.filter(h => h.isOnAir).length > 0 ? `${activeHosts.filter(h => h.isOnAir).length} HOST ON AIR` : `${activeHosts.length} HOST`})</span>
              </span>
            </div>

            {userRole === 'admin' && onGoToDjStudio && (
              <button
                onClick={onGoToDjStudio}
                className="flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-blue hover:opacity-90 text-black font-black text-xs transition shadow-sm border border-black/20"
                title="Atur Nama & Foto Penyiar Radio"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Setting Penyiar</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeHosts.map((host, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-3 bg-elevated p-3.5 rounded-2xl border border-subtle"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={host.photoUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
                    alt={host.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-black shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                  {host.isOnAir ? (
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-neon border-2 border-black"></span>
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-secondary border border-subtle"></span>
                  )}
                </div>

                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-pink uppercase tracking-wider">
                      Penyiar #{idx + 1}
                    </span>
                    {host.isOnAir ? (
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ● ON AIR
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-secondary bg-elevated px-2 py-0.5 rounded-full border border-subtle">
                        ○ OFF AIR
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-primary truncate flex items-center gap-1.5 font-display">
                    <span>{host.name}</span>
                    {host.instagram && (
                      <span className="text-[11px] font-medium text-secondary">
                        ({host.instagram})
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-secondary font-medium truncate">
                    {host.tagline || 'Penyiar EMKA Radio Sekolah'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Track Station Player or Standby Station */}
      {!currentTrack ? (
        <div className="bg-card rounded-[28px] p-8 border-2 border-primary text-center shadow-soft space-y-3 transition-colors">
          <div className="w-16 h-16 rounded-3xl bg-neon text-black flex items-center justify-center mx-auto mb-2 border-2 border-black shadow-pop">
            <Radio className="w-8 h-8 text-black animate-bounce" />
          </div>
          <h3 className="text-2xl font-black text-primary font-display uppercase">Radio EMKA Sedang Rehat / Standby 📻</h3>
          <p className="text-xs text-secondary max-w-md mx-auto font-medium">
            Belum ada lagu yang sedang diputar saat ini. Request lagu favoritmu sekarang agar diputar oleh DJ penyiar!
          </p>
          {onGoToRequestTab && (
            <div className="pt-2">
              <button
                onClick={onGoToRequestTab}
                className="px-6 py-3 rounded-2xl bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-neon dark:text-black font-black text-xs transition active:scale-95 border-2 border-black shadow-pop inline-flex items-center space-x-2"
              >
                <span>KIRIM REQUEST LAGU SEKARANG 🎵</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[28px] bg-card p-6 border-2 border-primary shadow-soft space-y-6 transition-colors">
          {/* Top Banner Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle pb-4">
            <div className="flex items-center space-x-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-neon"></span>
              </span>
              <span className="text-xs font-black tracking-wider text-black uppercase bg-neon border border-black/20 px-3 py-1 rounded-full font-display">
                ● SEDANG DIPUTAR DI EMKA RADIO
              </span>
            </div>

            {onOpenAiWingman && (
              <button
                onClick={onOpenAiWingman}
                className="flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-amber-300 text-black border border-black/20 text-xs font-black transition shadow-sm hover:scale-105"
              >
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>AI Vibe Check</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Vinyl Spin & Album Cover */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                {/* Spinning Vinyl */}
                <div className="absolute inset-0 rounded-full bg-black border-4 border-slate-900 flex items-center justify-center shadow-xl animate-spin" style={{ animationDuration: '6s' }}>
                  <div className="w-20 h-20 rounded-full border-2 border-slate-800 bg-pink flex items-center justify-center">
                    <Disc className="w-8 h-8 text-white animate-pulse" />
                  </div>
                </div>

                {/* Album Cover Overlaid */}
                <div className="absolute inset-4 rounded-2xl overflow-hidden border-2 border-black shadow-lg">
                  <img
                    src={currentTrack.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'}
                    alt={currentTrack.songTitle}
                    className="w-full h-full object-cover"
                  />
                  {currentTrack.previewUrl && (
                    <button
                      onClick={toggleAudio}
                      className="absolute inset-0 bg-black/30 hover:bg-black/10 flex items-center justify-center transition"
                    >
                      <div className="w-14 h-14 rounded-full bg-neon text-black border-2 border-black flex items-center justify-center shadow-lg transform hover:scale-110 transition">
                        {isPlayingAudio ? <Pause className="w-7 h-7 text-black" /> : <Play className="w-7 h-7 ml-1 text-black" />}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Track Metadata & Confession Detail */}
            <div className="md:col-span-7 space-y-4 text-center md:text-left">
              <div>
                <span className="text-xs font-black text-pink tracking-wide uppercase bg-pink/10 px-3 py-1 rounded-full border border-pink/20">
                  {currentTrack.mood || '🎧 Vibe Check'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-primary tracking-tight mt-2 font-display uppercase">
                  {decodeHtmlEntities(currentTrack.songTitle)}
                </h2>
                <p className="text-lg font-bold text-secondary">
                  {decodeHtmlEntities(currentTrack.artist)}
                </p>
              </div>

              {/* Equalizer Visualizer */}
              <div className="flex items-center justify-center md:justify-start space-x-1.5 h-6">
                <div className="w-1.5 bg-pink rounded-full animate-pulse h-5" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1.5 bg-neon rounded-full animate-pulse h-6" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-1.5 bg-blue rounded-full animate-pulse h-4" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 bg-purple rounded-full animate-pulse h-5" style={{ animationDelay: '0.4s' }}></div>
                <div className="w-1.5 bg-amber-300 rounded-full animate-pulse h-3" style={{ animationDelay: '0.15s' }}></div>
                <span className="text-xs text-secondary ml-2 font-bold uppercase tracking-wider font-display">LIVE STREAMING</span>
              </div>

              {/* Dedicated Message Box */}
              <div className="bg-elevated rounded-2xl p-4 border border-subtle text-left space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs text-secondary gap-2 border-b border-subtle pb-2 font-bold">
                  <div>
                    <span className="text-secondary">Dari: </span>
                    <span className="text-primary font-bold">{decodeHtmlEntities(currentTrack.studentName)}</span>
                    <span className="text-pink ml-1">({decodeHtmlEntities(currentTrack.className)})</span>
                  </div>
                  <div>
                    <span className="text-secondary">Confess Ke: </span>
                    <span className="text-purple font-black">💘 {decodeHtmlEntities(currentTrack.targetPerson)}</span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-primary italic flex items-start gap-2 pt-1">
                  <MessageCircleHeart className="w-5 h-5 text-pink flex-shrink-0 mt-0.5" />
                  <span>"{decodeHtmlEntities(currentTrack.message)}"</span>
                </p>
              </div>

              {/* Reactions & Story Download */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                {onLike && (
                  <button
                    onClick={() => onLike(currentTrack.id)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-pink hover:opacity-90 text-white font-black text-xs transition shadow-sm active:scale-95 border border-pink"
                  >
                    <Heart className="w-4 h-4 fill-white" />
                    <span>Beri Vibe ({currentTrack.likes || 0})</span>
                  </button>
                )}

                {onOpenStoryModal && (
                  <button
                    onClick={() => onOpenStoryModal(currentTrack)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-neon dark:text-black font-black text-xs transition shadow-sm active:scale-95 border-2 border-black"
                  >
                    <ImageIcon className="w-4 h-4 text-neon dark:text-black" />
                    <span>📸 Download Story 9:16</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⏭️ FITUR USER: UP NEXT / LAGU BERIKUTNYA DALAM ANTREAN */}
      <div className="bg-card border-2 border-primary rounded-[28px] p-5 sm:p-6 shadow-soft space-y-4 relative overflow-hidden transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-8 h-8 rounded-xl bg-blue text-black border border-black/20 flex items-center justify-center shadow-sm">
              <ListMusic className="w-4 h-4 text-black" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs sm:text-sm font-black text-primary uppercase tracking-wider font-display">
                  ⏭️ LAGU BERIKUTNYA DALAM ANTREAN
                </h3>
                <span className="bg-blue text-black text-[10px] font-black px-2.5 py-0.5 rounded-full border border-black/20">
                  UP NEXT
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {totalQueued > 1 && (
              <span className="text-[11px] font-black bg-amber-300 text-black px-3 py-1 rounded-full border border-black/20">
                +{totalQueued - 1} lagu berikutnya di antrean
              </span>
            )}
            {onGoToFeedTab && (
              <button
                onClick={onGoToFeedTab}
                className="text-xs font-bold text-secondary hover:text-primary underline flex items-center gap-1 transition"
              >
                <span>Lihat Semua Antrean</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {upcomingTrack ? (
          <div className="bg-elevated rounded-2xl p-4 sm:p-5 border border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left part: Cover & Song Details */}
            <div className="flex items-start space-x-4 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <img
                  src={upcomingTrack.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'}
                  alt={upcomingTrack.songTitle}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-black shadow-md"
                />
                <span className="absolute -top-2 -left-2 bg-neon text-black text-[10px] font-black px-2 py-0.5 rounded-full border border-black shadow-sm">
                  #1 NEXT
                </span>
                {upcomingTrack.previewUrl && (
                  <button
                    onClick={toggleNextAudio}
                    className="absolute inset-0 bg-black/25 hover:bg-black/10 rounded-2xl flex items-center justify-center transition"
                    title="Dengar preview singkat"
                  >
                    <div className="w-8 h-8 rounded-full bg-neon text-black border border-black flex items-center justify-center shadow">
                      {isPlayingNextAudio ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 ml-0.5 text-black" />}
                    </div>
                  </button>
                )}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black text-pink uppercase tracking-wider bg-pink/10 px-2 py-0.5 rounded-full border border-pink/20">
                    {upcomingTrack.mood || '🎧 Vibe Check'}
                  </span>
                  <span className="text-[10px] font-bold text-secondary">
                    Akan Diputar Otomatis Setelah Lagu Ini Selesai 🕒
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-black text-primary truncate font-display">
                  {upcomingTrack.songTitle}
                </h4>
                <p className="text-xs sm:text-sm font-bold text-secondary truncate">
                  {upcomingTrack.artist}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary pt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-pink" />
                    <span className="text-secondary">Dari:</span>
                    <strong className="text-primary">{upcomingTrack.studentName}</strong>
                    <span className="text-pink">({upcomingTrack.className})</span>
                  </span>
                  <span className="text-secondary">•</span>
                  <span>
                    <span className="text-secondary">Untuk:</span>
                    <strong className="text-purple ml-1">💘 {upcomingTrack.targetPerson}</strong>
                  </span>
                </div>

                {upcomingTrack.message && (
                  <p className="text-xs text-secondary italic truncate pt-0.5">
                    "{upcomingTrack.message}"
                  </p>
                )}
              </div>
            </div>

            {/* Right part: Action buttons */}
            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
              {onLike && (
                <button
                  onClick={() => onLike(upcomingTrack.id)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-card hover:bg-elevated text-pink font-black text-xs transition border border-subtle shadow-sm active:scale-95"
                >
                  <Heart className="w-3.5 h-3.5 fill-pink" />
                  <span>Vibe ({upcomingTrack.likes || 0})</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-elevated rounded-2xl p-6 border border-subtle text-center space-y-2">
            <p className="text-xs sm:text-sm font-black text-primary">
              Belum ada antrean lagu berikutnya 🎶
            </p>
            <p className="text-xs text-secondary font-medium max-w-md mx-auto">
              Antrean lagu sedang kosong. Jadilah yang pertama mengirim request lagu & confess untuk siaran berikutnya!
            </p>
            {onGoToRequestTab && (
              <div className="pt-2">
                <button
                  onClick={onGoToRequestTab}
                  className="px-4 py-2 rounded-xl bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-neon dark:text-black font-black text-xs transition shadow-sm inline-flex items-center space-x-1.5 border border-black"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neon dark:text-black" />
                  <span>Request Lagu Baru Sekarang</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
