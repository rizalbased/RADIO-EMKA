import React from 'react';
import {
  Radio,
  FileSpreadsheet,
  Sparkles,
  Music,
  ListMusic,
  ShieldCheck,
  RefreshCw,
  Share2,
  Lock,
  UserCheck,
  RadioTower,
  Sun,
  Moon,
  Volume2
} from 'lucide-react';
import { SheetConfig } from '../types';
import { useTheme } from '../contexts/ThemeContext';

export type TabType = 'request' | 'feed' | 'dj' | 'ai' | 'player';

interface HeaderProps {
  userRole: 'user' | 'admin';
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  sheetConfig: SheetConfig;
  onOpenSheetModal: () => void;
  onOpenShareModal: () => void;
  onOpenAdminPinModal: () => void;
  onSwitchToUserMode: () => void;
  isSyncing: boolean;
  onRefresh: () => void;
  totalRequestsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  userRole,
  activeTab,
  setActiveTab,
  sheetConfig,
  onOpenSheetModal,
  onOpenShareModal,
  onOpenAdminPinModal,
  onSwitchToUserMode,
  isSyncing,
  onRefresh,
  totalRequestsCount
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-primary transition-colors">
      {/* Ticker / Top Banner */}
      <div className="bg-neon text-black text-xs py-2 px-4 overflow-hidden border-b border-black/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 font-black uppercase tracking-wider text-[11px]">
          <span className="flex h-2.5 w-2.5 rounded-full bg-black animate-ping"></span>
          <span className="font-extrabold text-black flex items-center gap-1.5 font-display text-sm tracking-wide">
            <RadioTower className="w-4 h-4" /> EMKA RADIO &bull; RADIOMU MULTI KARYA
          </span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="hidden sm:inline font-bold font-sans">
            {userRole === 'user' ? 'PORTAL REQUEST SISWA 🎧' : 'STUDIO KONTROL DJ 🛡️'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 bg-black/10 hover:bg-black/20 text-black font-black px-2.5 py-1 rounded-full text-[11px] transition"
            title={`Beralih ke mode ${theme === 'light' ? 'Dark' : 'Light'}`}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenShareModal}
            className="flex items-center space-x-1 bg-black hover:bg-slate-800 text-neon font-black px-3 py-1 rounded-full text-[11px] transition shadow-sm active:scale-95"
            title="Bagikan link request ke siswa"
          >
            <Share2 className="w-3 h-3 text-neon" />
            <span>Bagikan 🔗</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 bg-card hover:bg-elevated text-primary font-bold px-2.5 py-1 rounded-full border border-subtle transition text-[11px] disabled:opacity-50"
            title="Refresh data dari database / Google Sheet"
          >
            <RefreshCw className={`w-3 h-3 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onOpenSheetModal}
              className="flex items-center space-x-1.5 bg-blue hover:bg-sky-400 text-black font-black px-2.5 py-1 rounded-full text-[11px] transition shadow-sm"
            >
              <FileSpreadsheet className="w-3 h-3 text-black" />
              <span>{sheetConfig.connected ? 'Sheet Aktif' : 'Sambungkan Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Info */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-neon border-2 border-black flex items-center justify-center text-black shadow-pop flex-shrink-0">
              <Radio className="w-6 h-6 animate-bounce text-black" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black tracking-tight text-primary uppercase font-display">
                  EMKA <span className="text-pink">RADIO</span>
                </h1>
                {userRole === 'user' ? (
                  <span className="bg-black text-neon text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-neon" />
                    SISWA
                  </span>
                ) : (
                  <span className="bg-pink text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-white" />
                    ADMIN DJ
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary font-medium hidden sm:block">
                {userRole === 'user'
                  ? 'Radiomu Multi Karya • Request Lagu & Secret Confession'
                  : 'Pusat Kendali Live Player & Pengaturan Siaran'}
              </p>
            </div>
          </div>

          {/* Quick theme toggle for mobile */}
          <div className="md:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-elevated border border-subtle text-primary"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-elevated p-1.5 rounded-full border border-subtle shadow-soft overflow-x-auto max-w-full gap-1">
          {/* Radio Player Tab for Admin */}
          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('player')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
                activeTab === 'player'
                  ? 'bg-neon text-black shadow-sm scale-105 border border-black/20'
                  : 'text-secondary hover:text-primary hover:bg-secondary'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Radio Player</span>
            </button>
          )}

          {/* Setting Penyiar Tab for Admin */}
          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('dj')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
                activeTab === 'dj'
                  ? 'bg-blue text-black shadow-sm scale-105 border border-black/20'
                  : 'text-secondary hover:text-primary hover:bg-secondary'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>Setting Penyiar</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('request')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'request'
                ? 'bg-neon text-black shadow-sm scale-105 border border-black/20'
                : 'text-secondary hover:text-primary hover:bg-secondary'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>+ Request Lagu</span>
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'feed'
                ? 'bg-pink text-white shadow-sm scale-105'
                : 'text-secondary hover:text-primary hover:bg-secondary'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Live Feed ({totalRequestsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'ai'
                ? 'bg-purple text-white shadow-sm scale-105'
                : 'text-secondary hover:text-primary hover:bg-secondary'
            }`}
          >
            <Sparkles className="w-4 h-4 text-neon" />
            <span>AI Wingman</span>
          </button>

          {userRole === 'user' ? (
            <button
              onClick={onOpenAdminPinModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-secondary hover:text-primary hover:bg-secondary border border-subtle transition-all"
              title="Masuk sebagai Admin / DJ"
            >
              <Lock className="w-3.5 h-3.5 text-pink" />
              <span>Admin</span>
            </button>
          ) : (
            <button
              onClick={onSwitchToUserMode}
              className="ml-1 px-3 py-1.5 rounded-full bg-pink/10 hover:bg-pink/20 text-pink border border-pink/30 text-[11px] font-black transition flex items-center gap-1"
              title="Beralih ke mode tampilan siswa"
            >
              <UserCheck className="w-3 h-3" />
              <span>Preview Siswa</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
