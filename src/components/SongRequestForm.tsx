import React, { useState, useEffect, useRef } from 'react';
import { Music, Send, Sparkles, Search, User, School, HeartHandshake, MessageSquare, AlertCircle, CheckCircle2, Disc, Play } from 'lucide-react';
import { MoodTag, ItunesSearchResult } from '../types';
import { analyzeVibeWithAi, searchItunesSongs, findYouTubeMatch } from '../services/api';
import { SongPreviewCard } from './SongPreviewCard';
import { decodeHtmlEntities } from '../lib/textUtils';

interface SongRequestFormProps {
  onSubmitRequest: (data: {
    studentName: string;
    className: string;
    songTitle: string;
    artist: string;
    targetPerson: string;
    message: string;
    mood: MoodTag;
    coverUrl?: string;
    previewUrl?: string;
    album?: string;
    genre?: string;
    itunesTrackId?: string | number;
    itunesCollectionId?: string | number;
    youtubeVideoId?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const MOOD_OPTIONS: MoodTag[] = [
  '💌 Secret Confession',
  '🎧 Vibe Check',
  '💔 Galau Time',
  '🔥 Hype Track',
  '🎂 Ultah Wish',
  '☕ Chill Afternoon'
];

const QUICK_CLASSES = ['X IPA 1', 'X IPS 2', 'XI MIPA 3', 'XI IPS 1', 'XII DKV', 'XII IPS 4'];
const QUICK_TARGETS = ['Crush di Kantin 💘', 'Sahabat Terbaik 💖', 'Wali Kelas 🧑‍🏫', 'Geng Nongkrong 🔥', 'Anonim 🕵️'];

export const SongRequestForm: React.FC<SongRequestFormProps> = ({
  onSubmitRequest,
  isSubmitting
}) => {
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [itunesTrackId, setItunesTrackId] = useState<string | number>('');
  const [itunesCollectionId, setItunesCollectionId] = useState<string | number>('');
  const [targetPerson, setTargetPerson] = useState('');
  const [message, setMessage] = useState('');
  const [mood, setMood] = useState<MoodTag>('💌 Secret Confession');
  const [coverUrl, setCoverUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');

  // iTunes Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ItunesSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Helper to extract YouTube Video ID if user enters a YouTube URL or Video ID
  const extractYouTubeId = (input: string): string | null => {
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regExp);
    return match && match[1] ? match[1] : null;
  };

  // Ref to skip search when track is selected
  const skipSearchRef = useRef(false);

  // Debounced iTunes music search
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchError('');
      return;
    }

    // Check if user pasted a direct YouTube URL or 11-char Video ID
    const extractedId = extractYouTubeId(searchQuery.trim());
    if (extractedId) {
      setYoutubeVideoId(extractedId);
      setCoverUrl(`https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`);
      setShowSearchResults(false);
      setSearchError('');

      // Auto-fetch video metadata via YouTube oEmbed
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${extractedId}`)
        .then(res => res.json())
        .then(data => {
          if (data.title) setSongTitle(decodeHtmlEntities(data.title));
          if (data.author_name) setArtist(decodeHtmlEntities(data.author_name));
        })
        .catch(() => {});
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        const results = await searchItunesSongs(searchQuery);
        setSearchResults(results);
        if (results.length > 0) {
          setShowSearchResults(true);
          setSearchError('');
        } else {
          setShowSearchResults(false);
          setSearchError('Tidak ditemukan lagu yang sesuai.');
        }
      } catch (err: any) {
        console.warn('[ITUNES SEARCH ERROR]:', err);
        setShowSearchResults(false);
        setSearchError(err?.message || 'Pencarian lagu sedang mengalami gangguan.');
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [isMatchingYt, setIsMatchingYt] = useState(false);

  const handleSelectTrack = (track: ItunesSearchResult) => {
    skipSearchRef.current = true;
    const cleanT = decodeHtmlEntities(track.trackName);
    const cleanA = decodeHtmlEntities(track.artistName);

    console.log(`[ITUNES]\nselected title: ${cleanT}\nselected artist: ${cleanA}`);

    setSongTitle(cleanT);
    setArtist(cleanA);
    setAlbum(track.collectionName ? decodeHtmlEntities(track.collectionName) : '');
    setCoverUrl(track.artworkUrl600 || track.artworkUrl100);
    setPreviewUrl(track.previewUrl || '');
    setItunesTrackId(track.trackId);
    setItunesCollectionId(track.collectionId || '');
    setGenre(track.primaryGenreName || '');
    setSearchQuery(`${cleanT} - ${cleanA}`);
    setShowSearchResults(false);
    setYoutubeVideoId('');

    // Fetch matching YouTube videoId in background
    setIsMatchingYt(true);
    findYouTubeMatch(cleanT, cleanA)
      .then((vId) => {
        setYoutubeVideoId(vId);
      })
      .catch((err) => {
        console.warn('[YOUTUBE MATCH] Selection match notice:', err?.message || err);
      })
      .finally(() => {
        setIsMatchingYt(false);
      });
  };

  const handleAiVibeCheck = async () => {
    if (!songTitle || !artist) {
      setFormError('Isi judul lagu & penyanyi terlebih dahulu untuk diaudit AI Wingman!');
      return;
    }
    setFormError('');
    setIsAnalyzingAi(true);
    const result = await analyzeVibeWithAi({
      songTitle,
      artist,
      targetPerson: targetPerson || 'Seseorang',
      message: message || 'Lagu ini khusus buat kamu!'
    });
    setAiAnalysis(result);
    setIsAnalyzingAi(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!studentName.trim()) {
      setFormError('Nama siswa wajib diisi!');
      return;
    }
    if (!className.trim()) {
      setFormError('Kelas wajib diisi!');
      return;
    }
    if (!songTitle.trim()) {
      setFormError('Judul lagu wajib diisi!');
      return;
    }
    if (!artist.trim()) {
      setFormError('Penyanyi / Artis wajib diisi!');
      return;
    }

    // Ensure valid YouTube videoId before inserting to database (Requirements 1, 15, 16)
    let finalVideoId = youtubeVideoId ? youtubeVideoId.trim() : '';

    if (!finalVideoId || finalVideoId.length !== 11) {
      setIsMatchingYt(true);
      try {
        console.log(`[YOUTUBE MATCH] Resolving videoId on submit for "${songTitle} - ${artist}"`);
        finalVideoId = await findYouTubeMatch(songTitle.trim(), artist.trim());
        setYoutubeVideoId(finalVideoId);
      } catch (err: any) {
        setIsMatchingYt(false);
        const errMsg = err?.message || `Gagal menemukan video YouTube yang cocok untuk "${songTitle} - ${artist}". Silakan coba lagu lain atau tempelkan link YouTube secara langsung.`;
        setFormError(errMsg);
        return; // STOP! Requirement 16: Jangan memasukkan request setengah jadi ke database
      } finally {
        setIsMatchingYt(false);
      }
    }

    if (!finalVideoId || finalVideoId.length !== 11) {
      setFormError('Video ID YouTube tidak valid. Silakan pilih lagu lain atau tempelkan link YouTube secara langsung.');
      return;
    }

    try {
      await onSubmitRequest({
        studentName: studentName.trim(),
        className: className.trim(),
        songTitle: songTitle.trim(),
        artist: artist.trim(),
        targetPerson: targetPerson.trim() || 'Semua Teman',
        message: message.trim() || 'Salam hangat untuk semuanya!',
        mood,
        coverUrl: coverUrl || (finalVideoId ? `https://i.ytimg.com/vi/${finalVideoId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'),
        previewUrl,
        album,
        genre,
        itunesTrackId,
        itunesCollectionId,
        youtubeVideoId: finalVideoId
      });

      setSuccessMessage('🎉 Request lagu berhasil dikirim.');
      
      // Reset form
      setStudentName('');
      setClassName('');
      setSongTitle('');
      setArtist('');
      setAlbum('');
      setGenre('');
      setItunesTrackId('');
      setItunesCollectionId('');
      setTargetPerson('');
      setMessage('');
      setSearchQuery('');
      setCoverUrl('');
      setPreviewUrl('');
      setYoutubeVideoId('');
      setAiAnalysis(null);

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Request gagal dikirim ke server.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Form Input Container */}
      <div className="lg:col-span-7 bg-card border-2 border-primary rounded-[28px] p-6 sm:p-8 shadow-soft relative transition-colors">
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-subtle">
          <div className="w-12 h-12 rounded-2xl bg-neon text-black border-2 border-black flex items-center justify-center font-black shadow-pop flex-shrink-0">
            <Music className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-primary font-display uppercase">Form Request Lagu & Confession</h2>
            <p className="text-xs text-secondary font-medium">Kirimkan lagu favoritmu & pesan rahasia ke EMKA RADIO</p>
          </div>
        </div>

        {formError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-neon/20 border border-neon text-primary text-xs flex items-center gap-2 font-black">
            <CheckCircle2 className="w-5 h-5 text-neon flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Student Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-primary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <User className="w-4 h-4 text-pink" />
                <span>Nama Kamu <span className="text-pink">*</span></span>
              </label>
              <input
                type="text"
                placeholder="Masukkan nama kamu..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl px-4 py-3.5 text-sm font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-primary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <School className="w-4 h-4 text-pink" />
                <span>Kelas <span className="text-pink">*</span></span>
              </label>
              <input
                type="text"
                placeholder="Contoh: XI MIPA 2"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl px-4 py-3.5 text-sm font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition"
              />
              {/* Quick Class Pills */}
              <div className="flex flex-wrap gap-1 mt-2">
                {QUICK_CLASSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setClassName(c)}
                    className="text-[10px] bg-elevated hover:bg-secondary text-primary font-bold px-2.5 py-1 rounded-full border border-subtle transition"
                  >
                    + {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Song Title Search with iTunes Search API */}
          <div className="relative">
            <label className="block text-xs font-black text-primary mb-2 flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-pink" />
                <span>Cari Judul Lagu / Link YouTube <span className="text-pink">*</span></span>
              </span>
              <span className="text-[10px] text-pink font-extrabold bg-pink/10 px-2 py-0.5 rounded-full border border-pink/20">🎵 iTunes Search</span>
            </label>

            <input
              type="text"
              placeholder="Contoh: Nina, Alan Walker, atau link YouTube..."
              value={searchQuery}
              onChange={(e) => {
                skipSearchRef.current = false;
                setSearchQuery(e.target.value);
                setSongTitle(e.target.value);
              }}
              className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl px-4 py-3.5 text-sm font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition"
            />

            {/* Helper Hint / Search Status */}
            {isSearching && (
              <div className="mt-1.5 text-[11px] font-bold text-pink flex items-center gap-1.5 px-1">
                <div className="w-3 h-3 border-2 border-pink border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span>Mencari lagu di iTunes...</span>
              </div>
            )}

            {searchError && !isSearching && searchQuery.trim().length >= 2 && (
              <div className="mt-1.5 text-[11px] font-bold text-rose-500 flex items-center gap-1.5 px-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {!searchQuery && (
              <p className="mt-1 text-[11px] text-secondary font-medium px-1">
                Ketik judul lagu atau nama artis untuk mencari.
              </p>
            )}

            {/* iTunes Search Autocomplete Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-2 bg-card border-2 border-primary rounded-2xl shadow-pop-dark overflow-hidden max-h-72 overflow-y-auto">
                <div className="px-3 py-2 bg-neon text-[11px] font-black text-black flex justify-between items-center">
                  <span>PILIH LAGU DARI ITUNES</span>
                  <span>{searchResults.length} Hasil</span>
                </div>
                {searchResults.map((t, idx) => (
                  <button
                    key={`${t.trackId}-${idx}`}
                    type="button"
                    onClick={() => handleSelectTrack(t)}
                    className="w-full text-left px-4 py-2.5 hover:bg-elevated flex items-center space-x-3 border-b border-subtle transition group"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black flex-shrink-0 relative border border-subtle">
                      {t.artworkUrl100 ? (
                        <img src={t.artworkUrl100} alt={t.trackName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-slate-800">
                          <Music className="w-4 h-4 text-pink" />
                        </div>
                      )}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className="text-xs font-black text-primary group-hover:text-pink truncate">{t.trackName}</p>
                      <p className="text-[11px] text-secondary font-bold truncate">
                        {t.artistName} {t.collectionName ? `• ${t.collectionName}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Manual Fields & Selected track indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <input
                type="text"
                placeholder="Judul Lagu"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary placeholder:text-secondary/50"
              />
              <input
                type="text"
                placeholder="Penyanyi / Artis"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary placeholder:text-secondary/50"
              />
            </div>

            {(songTitle && artist && (previewUrl || youtubeVideoId || itunesTrackId)) && (
              <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Lagu Terpilih: <strong>{songTitle} - {artist}</strong></span>
              </div>
            )}
          </div>

          {/* Step 3: Target Confession & Message */}
          <div className="space-y-4 pt-2 border-t border-subtle">
            <div>
              <label className="block text-xs font-black text-primary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <HeartHandshake className="w-4 h-4 text-pink" />
                <span>Confess Lagu Ini Ke Siapa?</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Eza XI IPS 1 / Crush di Kantin..."
                value={targetPerson}
                onChange={(e) => setTargetPerson(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl px-4 py-3.5 text-sm font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {QUICK_TARGETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetPerson(t)}
                    className="text-[10px] bg-elevated hover:bg-secondary text-primary font-bold px-2.5 py-1 rounded-full border border-subtle transition"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-primary mb-2 flex items-center justify-between uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-pink" />
                  <span>Pesan / Catatan Confession (Opsional)</span>
                </span>
                <span className="text-[10px] text-secondary font-bold">{message.length}/200</span>
              </label>
              <textarea
                rows={3}
                maxLength={200}
                placeholder="Tulis pesan untuk penyiar atau penerima confession..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-elevated border border-subtle focus:border-primary focus:bg-card rounded-2xl px-4 py-3.5 text-sm font-semibold text-primary placeholder:text-secondary/50 focus:outline-none transition resize-none"
              />
            </div>
          </div>

          {/* Step 4: Mood Tag Selection */}
          <div>
            <label className="block text-xs font-black text-primary mb-2 uppercase tracking-wider">
              Pilih Mood / Category Tag:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`px-3.5 py-3 rounded-2xl text-xs font-black border transition text-left flex items-center justify-between ${
                    mood === m
                      ? 'bg-black dark:bg-elevated text-neon border-black dark:border-neon shadow-sm scale-[1.02]'
                      : 'bg-elevated text-primary border-subtle hover:bg-secondary'
                  }`}
                >
                  <span>{m}</span>
                  {mood === m && <Sparkles className="w-3.5 h-3.5 text-neon" />}
                </button>
              ))}
            </div>
          </div>

          {/* AI Wingman Quick Check Button */}
          <div className="p-4 rounded-2xl bg-purple/10 border border-purple/30 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-purple flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple" />
                <span>Auditing AI Wingman</span>
              </h4>
              <p className="text-[11px] text-secondary font-semibold">Analisis tingkat ke-baperan confession sebelum kirim</p>
            </div>
            <button
              type="button"
              onClick={handleAiVibeCheck}
              disabled={isAnalyzingAi}
              className="px-4 py-2 rounded-full bg-purple hover:opacity-90 text-white font-black text-xs transition disabled:opacity-50"
            >
              {isAnalyzingAi ? 'Analyzing...' : 'Vibe Check ⚡'}
            </button>
          </div>

          {/* AI Analysis Result Display if triggered */}
          {aiAnalysis && (
            <div className="p-4 rounded-2xl bg-neon/15 border border-neon/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-primary text-sm">{aiAnalysis.vibeCategory}</span>
                <span className="bg-black text-neon font-black px-2.5 py-0.5 rounded-full text-[11px]">
                  Romance Score: {aiAnalysis.romanceScore}%
                </span>
              </div>
              <p className="text-primary font-semibold">💡 <strong>Saran DJ AI:</strong> {aiAnalysis.recommendation}</p>
              <p className="text-pink font-bold italic">" {aiAnalysis.storyCaption} "</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isMatchingYt}
            className="w-full py-4 rounded-2xl bg-[#0B0B0B] dark:bg-neon hover:bg-slate-800 dark:hover:bg-[#a6eb00] text-[#B8FF00] dark:text-black font-black text-sm shadow-pop-dark transition-all flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.99] border-2 border-black"
          >
            <Send className="w-4 h-4 text-neon dark:text-black" />
            <span>{isSubmitting ? 'Mengirim Request...' : (isMatchingYt ? 'Mencari Video YouTube...' : 'Kirim Request 🚀')}</span>
          </button>
        </form>
      </div>

      {/* Live Preview Card Sidebar */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-card border-2 border-primary rounded-[28px] p-4 text-center shadow-soft transition-colors">
          <span className="text-xs font-black text-primary uppercase tracking-wider flex items-center justify-center gap-1.5 font-display">
            <Disc className="w-4 h-4 animate-spin text-pink" />
            PREVIEW HASIL CARD SISWA
          </span>
          <p className="text-[11px] text-secondary font-semibold mt-1">
            Tampilan request lagu & confession kamu di radio sekolah!
          </p>
        </div>

        <SongPreviewCard
          request={{
            studentName: studentName || 'Nama Kamu',
            className: className || 'Kelas Kamu',
            songTitle: songTitle || 'Judul Lagu Pilihanmu',
            artist: artist || 'Nama Penyanyi',
            targetPerson: targetPerson || 'Doi / Target Confess',
            message: message || 'Tulis pesan manis yang mau dibacakan DJ...',
            mood,
            coverUrl: coverUrl || (youtubeVideoId ? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg` : undefined),
            previewUrl,
            youtubeVideoId,
            likes: 0,
            status: 'Queued'
          }}
          isInteractive={false}
        />
      </div>
    </div>
  );
};
