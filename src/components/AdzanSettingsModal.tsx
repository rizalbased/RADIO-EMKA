import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Radio,
  Upload,
  Volume2,
  VolumeX,
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
  Music
} from 'lucide-react';
import {
  AdzanSettings,
  PrayerKey,
  PRAYER_DISPLAY_NAMES,
  DEFAULT_ADZAN_AUDIO,
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

export const AdzanSettingsModal: React.FC<AdzanSettingsModalProps> = ({
  isOpen,
  onClose,
  scheduler
}) => {
  const { settings, reloadSettings, playAdzan, stopAdzan, isBroadcastingAdzan } = scheduler;

  const [localSettings, setLocalSettings] = useState<AdzanSettings | null>(null);
  const [uploadingPrayer, setUploadingPrayer] = useState<PrayerKey | null>(null);
  const [previewingPrayer, setPreviewingPrayer] = useState<PrayerKey | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    // Requirement 2: Set crossOrigin = 'anonymous' on HTML Audio instance
    audio.crossOrigin = 'anonymous';

    const url = getPrayerAudioUrl(localSettings, prayer);
    audio.src = url;

    // Requirement 4: Add catch() on audio.play() for clean error handling without crashing
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
    setErrorMessage(null);

    try {
      // Requirement 3: Upload MP3 to Supabase Storage bucket 'adzan-audio', get public URL, and update adzan_settings table
      const result = await uploadAdzanAudioFile(prayer, file);
      if (result.error) {
        console.warn('[ADZAN UPLOAD WARN]:', result.error);
        setErrorMessage(result.error);
      } else {
        setErrorMessage(null);
      }

      setLocalSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          [`audio_${prayer}`]: result.url
        };
      });

      // Synchronize with background scheduler
      await reloadSettings();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengunggah file.');
    } finally {
      setUploadingPrayer(null);
      // Reset input value so same file can be selected again
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

    // Clear custom audio in Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('adzan_settings').upsert({
          id: 1,
          [`audio_${prayer}`]: null,
          updated_at: new Date().toISOString()
        });
        await reloadSettings();
      } catch (err) {
        console.warn('[ADZAN] Error resetting audio in Supabase:', err);
      }
    }
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 3. Simpan seluruh Public URL audio beserta status is_active ke tabel adzan_settings di Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
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
          throw upsertError;
        }
      }

      await updateAdzanSettings(localSettings);
      await reloadSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.warn('[ADZAN] Save settings error:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan pengaturan ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestBroadcast = () => {
    // Stops any preview
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewingPrayer(null);

    // Trigger Dzuhur or Subuh preview
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

-- 4. Kebijakan Akses Database
CREATE POLICY "Public Read Adzan Settings" 
ON public.adzan_settings FOR SELECT 
USING (true);

CREATE POLICY "Admin Update Adzan Settings" 
ON public.adzan_settings FOR UPDATE 
USING (true);

-- 5. Bucket Storage 'adzan-audio' (Jalankan di SQL Editor jika belum dibuat manual di menu Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('adzan-audio', 'adzan-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Access Adzan Audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'adzan-audio');

CREATE POLICY "Allow Upload Adzan Audio"
ON storage.objects FOR INSERT
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
        <div className="p-5 overflow-y-auto space-y-5 flex-1 scrollbar-none">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
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
              const hasCustom = !!customUrl;
              const isUploading = uploadingPrayer === prayer;
              const isPreviewing = previewingPrayer === prayer;

              return (
                <div
                  key={prayer}
                  className="p-3.5 rounded-2xl bg-elevated/60 border border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-card border border-subtle flex items-center justify-center text-primary flex-shrink-0">
                      <Music className="w-4 h-4 text-[#B6FF00]" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black text-primary uppercase font-display">
                          {PRAYER_DISPLAY_NAMES[prayer]}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          hasCustom
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {hasCustom ? 'Audio Kustom' : 'Default Sistem'}
                        </span>
                      </div>
                      <p className="text-[11px] text-secondary">
                        {prayer === 'subuh'
                          ? 'Termasuk lafadz Ash-shalatu khairum minan-naum'
                          : 'Audio Adzan standar berkualitas tinggi'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 justify-end">
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
                      onClick={() => handlePreviewAudio(prayer)}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1 ${
                        isPreviewing
                          ? 'bg-[#B6FF00] text-black border-black'
                          : 'bg-card hover:bg-secondary text-primary border-subtle'
                      }`}
                      title={isPreviewing ? 'Hentikan Preview' : 'Dengarkan Audio'}
                    >
                      {isPreviewing ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      <span className="text-[11px]">{isPreviewing ? 'Stop' : 'Cek'}</span>
                    </button>

                    {/* Upload Custom Audio Button */}
                    <button
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[prayer]?.click()}
                      className="px-3 py-2 rounded-xl bg-card hover:bg-secondary text-primary border border-subtle transition text-xs font-bold flex items-center space-x-1.5"
                    >
                      <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce text-[#FF4F91]' : ''}`} />
                      <span>{isUploading ? 'Mengunggah...' : 'Unggah'}</span>
                    </button>

                    {/* Reset to Default */}
                    {hasCustom && (
                      <button
                        onClick={() => handleResetToDefault(prayer)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                        title="Kembalikan ke Default Sistem"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
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
                  Jika belum menjalankan query SQL di Supabase SQL Editor, jalankan perintah berikut untuk membuat tabel <code className="text-[#B6FF00]">adzan_settings</code> dan pastikan bucket storage bernama <code className="text-[#B6FF00]">adzan-audio</code> berstatus <strong>Public</strong>.
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
                <span>Menyimpan...</span>
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
