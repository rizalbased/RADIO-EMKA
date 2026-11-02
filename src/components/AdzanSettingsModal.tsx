import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Radio,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Check,
  AlertCircle,
  Database,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Music,
  Loader2,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import {
  AdzanSettings,
  PrayerKey,
  PRAYER_DISPLAY_NAMES,
  getPrayerAudioUrl,
  updateAdzanSettings,
  uploadAdzanAudioFile
} from '../services/adzanService';
import { getSupabaseClient } from '../lib/supabaseClient';
import { useAdzanScheduler } from '../hooks/useAdzanScheduler';

interface AdzanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduler: ReturnType<typeof useAdzanScheduler>;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export const AdzanSettingsModal: React.FC<AdzanSettingsModalProps> = ({
  isOpen,
  onClose,
  scheduler
}) => {
  const { settings, reloadSettings, playAdzan } = scheduler;

  const [localSettings, setLocalSettings] = useState<AdzanSettings | null>(null);
  const [uploadingPrayer, setUploadingPrayer] = useState<PrayerKey | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<PrayerKey, number>>({
    subuh: 0,
    dzuhur: 0,
    ashar: 0,
    maghrib: 0,
    isya: 0
  });
  const [previewingPrayer, setPreviewingPrayer] = useState<PrayerKey | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRefs = useRef<Record<PrayerKey, HTMLInputElement | null>>({
    subuh: null,
    dzuhur: null,
    ashar: null,
    maghrib: null,
    isya: null
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings, isOpen]);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle preview audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    previewAudioRef.current = audio;

    audio.onended = () => {
      setPreviewingPrayer(null);
    };

    audio.onerror = (e) => {
      console.warn('[PREVIEW AUDIO] Audio element error event:', e);
      setPreviewingPrayer(null);
      setErrorMessage('Audio preview gagal diputar. Periksa URL atau koneksi internet.');
    };

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch {}
    };
  }, []);

  if (!isOpen || !localSettings) return null;

  const prayers: PrayerKey[] = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

  const handleToggleActive = () => {
    setLocalSettings(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
  };

  const handlePreviewAudio = (prayer: PrayerKey) => {
    // If currently previewing this prayer, toggle stop
    if (previewingPrayer === prayer) {
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
          previewAudioRef.current.currentTime = 0;
        } catch {}
      }
      setPreviewingPrayer(null);
      return;
    }

    // Stop existing audio before switching
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch {}
    }

    const audio = previewAudioRef.current || new Audio();
    previewAudioRef.current = audio;
    audio.crossOrigin = 'anonymous';

    const url = getPrayerAudioUrl(localSettings, prayer);
    audio.src = url;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setPreviewingPrayer(prayer);
          setErrorMessage(null);
        })
        .catch((err: any) => {
          console.warn('[PREVIEW AUDIO] Error playing audio:', err);
          setPreviewingPrayer(null);
          setErrorMessage(
            `Gagal memutar audio preview ${PRAYER_DISPLAY_NAMES[prayer]}: ${
              err?.message || 'Format audio tidak didukung atau pemutaran diblokir browser.'
            }`
          );
        });
    }
  };

  const handleFileSelect = async (prayer: PrayerKey, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPrayer(prayer);
    setUploadProgress(prev => ({ ...prev, [prayer]: 15 }));
    setErrorMessage(null);

    try {
      const result = await uploadAdzanAudioFile(prayer, file, (percent) => {
        setUploadProgress(prev => ({ ...prev, [prayer]: percent }));
      });

      if (result.error && !result.url) {
        console.warn('[ADZAN UPLOAD WARN]:', result.error);
        setErrorMessage(result.error);
      } else {
        setErrorMessage(null);
        // Indikator UI: Notifikasi toast hijau saat file berhasil diunggah
        setToast({
          message: `Audio Adzan ${PRAYER_DISPLAY_NAMES[prayer]} berhasil diperbarui!`,
          type: 'success'
        });
      }

      if (result.url) {
        setLocalSettings(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [`audio_${prayer}`]: result.url
          };
        });
      }

      // Synchronize with background scheduler
      await reloadSettings();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengunggah file.');
    } finally {
      setUploadingPrayer(null);
      setUploadProgress(prev => ({ ...prev, [prayer]: 0 }));
      if (event.target) event.target.value = '';
    }
  };

  const handleResetToDefault = async (prayer: PrayerKey) => {
    if (previewingPrayer === prayer && previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch {}
      setPreviewingPrayer(null);
    }

    setLocalSettings(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [`audio_${prayer}`]: null
      };
    });

    try {
      await updateAdzanSettings({ [`audio_${prayer}`]: null });
      await reloadSettings();
      setToast({
        message: `Audio Adzan ${PRAYER_DISPLAY_NAMES[prayer]} dikembalikan ke default sistem.`,
        type: 'success'
      });
    } catch (err) {
      console.warn('[ADZAN] Error resetting audio in Supabase:', err);
    }
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Coba simpan ke Supabase client dengan penanganan error RLS (tanpa crash 403)
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { error: upsertError } = await supabase
            .from('adzan_settings')
            .upsert({
              id: 1,
              city_name: localSettings.city_name || 'Kota Medan',
              city_id: localSettings.city_id || '0228',
              is_active: localSettings.is_active,
              audio_subuh: localSettings.audio_subuh,
              audio_dzuhur: localSettings.audio_dzuhur,
              audio_ashar: localSettings.audio_ashar,
              audio_maghrib: localSettings.audio_maghrib,
              audio_isya: localSettings.audio_isya,
              updated_at: new Date().toISOString()
            });

          if (upsertError) {
            console.warn('[ADZAN] Supabase client upsert notice (fallback will handle):', upsertError.message);
          }
        } catch (clientErr: any) {
          console.warn('[ADZAN] Supabase client exception:', clientErr?.message);
        }
      }

      // 2. Simpan juga melalui backend server API & local storage
      await updateAdzanSettings(localSettings);
      await reloadSettings();
      setSaveSuccess(true);
      setToast({
        message: 'Pengaturan siaran adzan berhasil disimpan permanen!',
        type: 'success'
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.warn('[ADZAN] Save settings error:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan pengaturan ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestBroadcast = () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewingPrayer(null);
    playAdzan('dzuhur', true);
    onClose();
  };

  const sqlCode = `-- 1. Buat Tabel Pengaturan Adzan (Single Row Configuration)
CREATE TABLE IF NOT EXISTS public.adzan_settings (
    id INT PRIMARY KEY DEFAULT 1,
    city_name VARCHAR(100) NOT NULL DEFAULT 'Kota Medan',
    city_id VARCHAR(50) NOT NULL DEFAULT '0228',
    is_active BOOLEAN NOT NULL DEFAULT true,
    audio_subuh TEXT,
    audio_dzuhur TEXT,
    audio_ashar TEXT,
    audio_maghrib TEXT,
    audio_isya TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Insert Data Bawaan
INSERT INTO public.adzan_settings (id, city_name, city_id, is_active)
VALUES (1, 'Kota Medan', '0228', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.adzan_settings ENABLE ROW LEVEL SECURITY;

-- 4. Kebijakan Akses Database (Izinkan Baca, Tambah & Ubah untuk Semua)
DROP POLICY IF EXISTS "Public Read Adzan Settings" ON public.adzan_settings;
DROP POLICY IF EXISTS "Admin Update Adzan Settings" ON public.adzan_settings;
DROP POLICY IF EXISTS "Allow All Adzan Settings" ON public.adzan_settings;

CREATE POLICY "Allow All Adzan Settings" 
ON public.adzan_settings FOR ALL 
USING (true)
WITH CHECK (true);

-- 5. Bucket Storage 'adzan-audio' & Kebijakan Hak Akses Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('adzan-audio', 'adzan-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access Adzan Audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload Adzan Audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update Adzan Audio" ON storage.objects;

CREATE POLICY "Public Access Adzan Audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'adzan-audio');

CREATE POLICY "Allow Upload Adzan Audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'adzan-audio');

CREATE POLICY "Allow Update Adzan Audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'adzan-audio')
WITH CHECK (bucket_id = 'adzan-audio');`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-subtle w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-subtle flex items-center justify-between flex-shrink-0 bg-elevated/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B6FF00] border-2 border-black flex items-center justify-center text-black">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg text-primary uppercase tracking-tight">
                Pengaturan Siaran Adzan
              </h2>
              <p className="text-xs text-secondary font-medium">
                Jadwal Sholat Otomatis Kota Medan (Kemenag / MyQuran API: 0228)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (previewAudioRef.current) previewAudioRef.current.pause();
              onClose();
            }}
            className="p-2 rounded-xl bg-elevated hover:bg-secondary text-secondary hover:text-primary border border-subtle transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-none">
          {/* Toast Notification Banner */}
          {toast && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-bold">{toast.message}</span>
              </div>
              <button
                onClick={() => setToast(null)}
                className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && !toast && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Pengaturan siaran adzan berhasil disimpan!</span>
            </div>
          )}

          {/* Master Switch */}
          <div className="p-4 rounded-2xl bg-elevated border border-subtle flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primary">
                Siaran Adzan Otomatis
              </h3>
              <p className="text-xs text-secondary mt-0.5">
                Otomatis jeda radio dan kumandangkan adzan saat waktu sholat Medan tiba.
              </p>
            </div>

            <button
              onClick={handleToggleActive}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative ${
                localSettings.is_active ? 'bg-[#B6FF00]' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-black shadow-md transform transition-transform duration-200 ease-in-out ${
                  localSettings.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Test Broadcast Button */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-card to-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Uji Coba Siaran Langsung</span>
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Simulasikan bagaimana radio otomatis dijeda dan dilanjutkan kembali.
              </p>
            </div>
            <button
              onClick={handleTestBroadcast}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition flex items-center space-x-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Uji Sekarang</span>
            </button>
          </div>

          {/* 5 Audio Prayer Slots */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-secondary">
              File Audio Adzan (5 Waktu Sholat)
            </h3>

            {prayers.map((prayer) => {
              const customUrl = localSettings[`audio_${prayer}` as keyof AdzanSettings] as string | null;
              const hasCustom = !!(customUrl && typeof customUrl === 'string' && customUrl.trim().length > 0);
              const isUploading = uploadingPrayer === prayer;
              const isPreviewing = previewingPrayer === prayer;
              const progressPercent = uploadProgress[prayer] || 0;

              return (
                <div
                  key={prayer}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    hasCustom
                      ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm'
                      : 'bg-elevated/60 border-subtle'
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  {/* Left: Info & Status Badge */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      hasCustom
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-card border-subtle text-primary'
                    }`}>
                      <Music className={`w-4 h-4 ${hasCustom ? 'text-emerald-400' : 'text-[#B6FF00]'}`} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-black text-primary uppercase font-display tracking-wide">
                          {PRAYER_DISPLAY_NAMES[prayer]}
                        </span>

                        {/* Indikator UI: Jika audio sudah diunggah, tampilkan badge status berwarna hijau terang: "✓ Audio Kustom Terpasang" */}
                        {hasCustom ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                            <span>✓ Audio Kustom Terpasang</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            Default Sistem
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5">
                        {hasCustom
                          ? 'Audio kustom aktif (tersimpan di Supabase Storage)'
                          : prayer === 'subuh'
                          ? 'Termasuk lafadz Ash-shalatu khairum minan-naum'
                          : 'Audio Adzan standar berkualitas tinggi'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 justify-end flex-wrap gap-y-2">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg"
                      ref={(el) => { fileInputRefs.current[prayer] = el; }}
                      onChange={(e) => handleFileSelect(prayer, e)}
                      className="hidden"
                    />

                    {/* Preview Button */}
                    <button
                      type="button"
                      onClick={() => handlePreviewAudio(prayer)}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 ${
                        isPreviewing
                          ? 'bg-[#B6FF00] text-black border-black shadow-md'
                          : 'bg-card hover:bg-secondary text-primary border-subtle'
                      }`}
                      title={isPreviewing ? 'Hentikan Preview' : 'Dengarkan Audio'}
                    >
                      {isPreviewing ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      <span className="text-[11px]">{isPreviewing ? 'Stop' : 'Cek'}</span>
                    </button>

                    {/* Upload / Ganti File Button & Progress Indicator */}
                    {isUploading ? (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-2 rounded-xl bg-card text-[#B6FF00] border border-[#B6FF00]/40 transition text-xs font-bold flex items-center space-x-1.5 cursor-not-allowed shadow-sm"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B6FF00]" />
                        <span>Mengunggah {progressPercent}%...</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[prayer]?.click()}
                        className={`px-3 py-2 rounded-xl border transition text-xs font-bold flex items-center space-x-1.5 ${
                          hasCustom
                            ? 'bg-card hover:bg-secondary text-emerald-400 border-emerald-500/30'
                            : 'bg-card hover:bg-secondary text-primary border-subtle'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{hasCustom ? 'Ganti File' : 'Unggah'}</span>
                      </button>
                    )}

                    {/* Reset Button: Ikon Trash / Refresh untuk menghapus audio kustom dan kembali ke default */}
                    {hasCustom && (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => handleResetToDefault(prayer)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center space-x-1"
                        title={`Reset audio ${PRAYER_DISPLAY_NAMES[prayer]} ke default sistem`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">Reset</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Database Setup Info Accordion */}
          <div className="rounded-2xl border border-subtle bg-elevated/40 overflow-hidden">
            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-secondary hover:text-primary transition"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-[#B6FF00]" />
                <span>Skema Database Supabase & Panduan Storage</span>
              </div>
              {showSqlGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSqlGuide && (
              <div className="p-4 pt-0 border-t border-subtle/40 space-y-3 text-xs text-secondary">
                <p>
                  Jika belum menjalankan query SQL di Supabase SQL Editor, jalankan perintah berikut untuk mengonfigurasi tabel <code className="text-[#B6FF00]">adzan_settings</code> dengan hak akses RLS yang benar, serta bucket <code className="text-[#B6FF00]">adzan-audio</code>.
                </p>

                <div className="relative">
                  <pre className="p-3 bg-black/60 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48 scrollbar-none border border-subtle">
                    {sqlCode}
                  </pre>
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-card border border-subtle text-primary hover:bg-secondary text-[10px] font-bold transition flex items-center space-x-1"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql ? 'Tersalin' : 'Salin SQL'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-subtle bg-elevated/50 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-secondary">
            Perubahan langsung aktif untuk seluruh pendengar.
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (previewAudioRef.current) previewAudioRef.current.pause();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-card hover:bg-secondary text-primary border border-subtle text-xs font-bold transition"
            >
              Batal
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#B6FF00] hover:brightness-105 text-black text-xs font-black transition flex items-center space-x-1.5 shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
