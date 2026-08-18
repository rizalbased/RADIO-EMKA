import React, { useState } from 'react';
import {
  Settings,
  Radio,
  Sparkles,
  Users,
  Mic,
  Volume2,
  FileSpreadsheet,
  RefreshCw,
  Share2,
  Check,
  CheckCircle2,
  Sliders,
  ExternalLink,
  ArrowRight,
  ListMusic
} from 'lucide-react';
import { SongRequest, SheetConfig, RadioHost } from '../types';
import { useRadioEngine } from '../contexts/RadioEngineContext';

interface DjStudioProps {
  requests: SongRequest[];
  onUpdateStatus: (id: string, status: 'Queued' | 'Playing' | 'Played') => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onClearAllRequests: () => Promise<void>;
  sheetConfig: SheetConfig;
  onRefresh: () => void;
  isSyncing: boolean;
  onOpenShareModal: () => void;
  radioHost?: RadioHost;
  radioHosts?: RadioHost[];
  onUpdateRadioHost?: (hostData: RadioHost) => Promise<void>;
  onUpdateRadioHosts?: (hostsData: RadioHost[]) => Promise<void>;
  onOpenStoryModal?: (request: Partial<SongRequest>) => void;
  onUpdateYoutubeVideoId?: (id: string, videoId: string) => Promise<void>;
  onGoToPlayerTab?: () => void;
}

const DEFAULT_HOSTS: RadioHost[] = [
  {
    id: 'host-1',
    name: 'DJ Rizal',
    tagline: 'Penyiar Main On-Air EMKA Radio Sekolah',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    instagram: '@rizalsaragih498',
    isOnAir: true
  },
  {
    id: 'host-2',
    name: 'DJ Nabila',
    tagline: 'Co-Host & Request Curator EMKA Radio',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    instagram: '@nabila.fm',
    isOnAir: true
  }
];

const PRESET_AVATARS = [
  { label: 'Cool DJ Female', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
  { label: 'Cool DJ Male', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80' },
  { label: 'Studio Host Male', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' },
  { label: 'Studio Host Female', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80' },
  { label: 'Radio Mic', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80' }
];

export const DjStudio: React.FC<DjStudioProps> = ({
  requests,
  sheetConfig,
  onRefresh,
  isSyncing,
  onOpenShareModal,
  radioHosts,
  onUpdateRadioHosts,
  onGoToPlayerTab
}) => {
  const {
    autoPlay,
    toggleAutoPlay,
    ytVolume,
    setYtVolume
  } = useRadioEngine();

  const [activeHostTab, setActiveHostTab] = useState<0 | 1>(0);
  const [hostsState, setHostsState] = useState<RadioHost[]>(() => {
    if (radioHosts && radioHosts.length >= 2) return radioHosts;
    return DEFAULT_HOSTS;
  });

  const [isRadioLive, setIsRadioLive] = useState(true);
  const [isAllowRequests, setIsAllowRequests] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if prop changes
  React.useEffect(() => {
    if (radioHosts && radioHosts.length >= 2) {
      setHostsState(radioHosts);
    }
  }, [radioHosts]);

  const handleHostChange = (index: number, field: keyof RadioHost, value: any) => {
    setHostsState((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      if (onUpdateRadioHosts) {
        await onUpdateRadioHosts(hostsState);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-subtle rounded-3xl p-6 sm:p-8 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B6FF00]"></span>
            <span className="text-xs font-black text-secondary tracking-widest uppercase font-display">
              PENGATURAN STUDIO
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-primary tracking-wide uppercase">
            SETTING PENYIAR
          </h2>
          <p className="text-xs text-secondary max-w-lg font-sans">
            Konfigurasi sistem radio, profil penyiar On-Air, antrean FIFO, dan preferensi volume siaran.
          </p>
        </div>

        {onGoToPlayerTab && (
          <button
            onClick={onGoToPlayerTab}
            className="px-5 py-3 rounded-2xl bg-[#B6FF00] hover:bg-[#a6eb00] text-[#0B0B0B] font-display font-black text-sm tracking-wide uppercase flex items-center space-x-2 transition shadow-pop border border-black active:scale-95 flex-shrink-0"
          >
            <Radio className="w-4 h-4" />
            <span>BUKA RADIO PLAYER &rarr;</span>
          </button>
        )}
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Radio Core System Toggles */}
        <div className="bg-card border border-subtle rounded-3xl p-6 shadow-soft space-y-5 transition-colors">
          <h3 className="text-lg font-black font-display text-primary uppercase border-b border-subtle pb-3">
            STATUS & KONTROL SISTEM
          </h3>

          {/* 1. Status Siaran */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-elevated border border-subtle">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-primary">Status Siaran</p>
              <p className="text-xs text-secondary">
                {isRadioLive ? 'Radio sedang mengudara (ON AIR)' : 'Radio dalam mode rehat'}
              </p>
            </div>
            <button
              onClick={() => setIsRadioLive(!isRadioLive)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition border ${
                isRadioLive
                  ? 'bg-[#FF4F91] text-white border-[#FF4F91]'
                  : 'bg-card text-secondary border-subtle'
              }`}
            >
              {isRadioLive ? '● LIVE' : '○ OFF'}
            </button>
          </div>

          {/* 2. Autoplay & FIFO Queue */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-elevated border border-subtle">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-primary">Autoplay & Queue</p>
              <p className="text-xs text-secondary">
                Lagu berikutnya otomatis diputar dari antrean terlama
              </p>
            </div>
            <button
              onClick={toggleAutoPlay}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition border ${
                autoPlay
                  ? 'bg-[#B6FF00] text-[#0B0B0B] border-black/10'
                  : 'bg-card text-secondary border-subtle'
              }`}
            >
              {autoPlay ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 3. FIFO Queue Status Indicator */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-elevated border border-subtle">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-primary">FIFO Queue</p>
              <p className="text-xs text-secondary">
                First In, First Out (Urutan request paling lama didahulukan)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#B6FF00]/20 text-primary border border-[#B6FF00]/40">
              ACTIVE
            </span>
          </div>

          {/* 4. Request User */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-elevated border border-subtle">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-primary">Request User</p>
              <p className="text-xs text-secondary">
                Siswa dapat mengirim request lagu melalui form
              </p>
            </div>
            <button
              onClick={() => setIsAllowRequests(!isAllowRequests)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition border ${
                isAllowRequests
                  ? 'bg-[#B6FF00] text-[#0B0B0B] border-black/10'
                  : 'bg-card text-secondary border-subtle'
              }`}
            >
              {isAllowRequests ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 5. Volume Default */}
          <div className="p-4 rounded-2xl bg-elevated border border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Volume Default</span>
              </p>
              <span className="text-xs font-mono font-bold text-primary">
                {ytVolume}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ytVolume}
              onChange={(e) => setYtVolume(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#B6FF00] bg-secondary"
            />
          </div>
        </div>

        {/* Right Column: Profil Penyiar On-Air */}
        <div className="bg-card border border-subtle rounded-3xl p-6 shadow-soft space-y-5 transition-colors">
          <div className="flex items-center justify-between border-b border-subtle pb-3">
            <h3 className="text-lg font-black font-display text-primary uppercase">
              PROFIL PENYIAR ON-AIR
            </h3>

            {/* Host 1 / Host 2 tabs */}
            <div className="flex bg-elevated p-1 rounded-xl border border-subtle space-x-1">
              <button
                type="button"
                onClick={() => setActiveHostTab(0)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeHostTab === 0
                    ? 'bg-[#B6FF00] text-[#0B0B0B] font-black'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Penyiar 1
              </button>
              <button
                type="button"
                onClick={() => setActiveHostTab(1)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeHostTab === 1
                    ? 'bg-[#B6FF00] text-[#0B0B0B] font-black'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Penyiar 2
              </button>
            </div>
          </div>

          {hostsState[activeHostTab] && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary uppercase">Nama Penyiar</label>
                <input
                  type="text"
                  value={hostsState[activeHostTab].name}
                  onChange={(e) => handleHostChange(activeHostTab, 'name', e.target.value)}
                  placeholder="Nama DJ / Penyiar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-subtle text-xs font-semibold text-primary focus:outline-none focus:border-[#B6FF00]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary uppercase">Instagram / Handle</label>
                <input
                  type="text"
                  value={hostsState[activeHostTab].instagram || ''}
                  onChange={(e) => handleHostChange(activeHostTab, 'instagram', e.target.value)}
                  placeholder="@username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-subtle text-xs font-semibold text-primary focus:outline-none focus:border-[#B6FF00]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary uppercase">Tagline Siaran</label>
                <input
                  type="text"
                  value={hostsState[activeHostTab].tagline}
                  onChange={(e) => handleHostChange(activeHostTab, 'tagline', e.target.value)}
                  placeholder="Tagline siaran penyiar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-subtle text-xs font-semibold text-primary focus:outline-none focus:border-[#B6FF00]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase">Foto Avatar Penyiar</label>
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black flex-shrink-0 border border-subtle">
                    <img
                      src={hostsState[activeHostTab].photoUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={hostsState[activeHostTab].photoUrl}
                    onChange={(e) => handleHostChange(activeHostTab, 'photoUrl', e.target.value)}
                    placeholder="URL Foto Penyiar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-subtle text-xs font-semibold text-primary focus:outline-none focus:border-[#B6FF00]"
                  />
                </div>

                {/* Preset Avatars */}
                <div className="flex items-center space-x-2 pt-1">
                  {PRESET_AVATARS.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleHostChange(activeHostTab, 'photoUrl', preset.url)}
                      className="w-8 h-8 rounded-xl overflow-hidden border border-subtle hover:border-[#B6FF00] transition"
                      title={preset.label}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="bg-card border border-subtle rounded-3xl p-5 shadow-soft flex items-center justify-between transition-colors">
        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-500 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengaturan berhasil disimpan!</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {onGoToPlayerTab && (
            <button
              onClick={onGoToPlayerTab}
              className="px-4 py-2.5 rounded-2xl bg-elevated hover:bg-secondary text-primary text-xs font-bold transition border border-subtle"
            >
              Lihat Radio Player
            </button>
          )}

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-2xl bg-[#B6FF00] hover:bg-[#a6eb00] text-[#0B0B0B] font-display font-black text-sm uppercase tracking-wide transition shadow-pop border border-black active:scale-95"
          >
            {isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
          </button>
        </div>
      </div>
    </div>
  );
};
