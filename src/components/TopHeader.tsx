import React from 'react';
import {
  RadioTower,
  Sun,
  Moon,
  Bell,
  Sliders,
  ChevronDown,
  RefreshCw,
  Share2,
  FileSpreadsheet,
  Monitor
} from 'lucide-react';
import { RadioHost, SheetConfig } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useRadioEngine } from '../contexts/RadioEngineContext';

interface TopHeaderProps {
  radioHost?: RadioHost;
  radioHosts?: RadioHost[];
  onOpenSheetModal: () => void;
  onOpenShareModal: () => void;
  sheetConfig: SheetConfig;
  isSyncing: boolean;
  onRefresh: () => void;
  userRole: 'user' | 'admin';
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  radioHost,
  radioHosts = [],
  onOpenSheetModal,
  onOpenShareModal,
  sheetConfig,
  isSyncing,
  onRefresh,
  userRole
}) => {
  const { theme, toggleTheme } = useTheme();
  const { ytPlayerState } = useRadioEngine();
  const isPlaying = ytPlayerState === 1;

  const currentHost = radioHosts[0] || radioHost || {
    name: 'DJ EMKA',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    isOnAir: true
  };

  return (
    <header className="h-16 px-5 sm:px-8 bg-card border-b border-subtle flex items-center justify-between sticky top-0 z-20 transition-colors flex-shrink-0">
      {/* Left: Station & Broadcast Status */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* On Air Pill */}
        <div className="flex items-center space-x-2 bg-elevated border border-subtle px-3 py-1.5 rounded-full">
          <span className="flex h-2.5 w-2.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isPlaying ? 'bg-[#FF4F91]' : 'bg-[#B6FF00]'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isPlaying ? 'bg-[#FF4F91]' : 'bg-[#B6FF00]'
            }`}></span>
          </span>
          <span className={`text-[11px] font-black uppercase tracking-wider font-display ${
            isPlaying ? 'text-[#FF4F91]' : 'text-primary'
          }`}>
            {isPlaying ? 'ON AIR' : 'STANDBY'}
          </span>
          <span className="text-secondary text-xs">&bull;</span>
          <span className="text-xs font-mono font-bold text-primary">107.7 FM</span>

          {/* Soundwave bars */}
          <div className="flex items-center space-x-0.5 h-3 ml-1">
            <span className={`w-0.5 bg-primary rounded-full transition-all ${isPlaying ? 'h-3 animate-pulse' : 'h-1'}`}></span>
            <span className={`w-0.5 bg-primary rounded-full transition-all ${isPlaying ? 'h-2 animate-pulse delay-75' : 'h-1.5'}`}></span>
            <span className={`w-0.5 bg-primary rounded-full transition-all ${isPlaying ? 'h-3.5 animate-pulse delay-150' : 'h-2'}`}></span>
            <span className={`w-0.5 bg-primary rounded-full transition-all ${isPlaying ? 'h-2 animate-pulse' : 'h-1'}`}></span>
          </div>
        </div>

        {/* Sync & Share quick buttons */}
        <div className="hidden md:flex items-center space-x-1.5">
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="p-2 rounded-xl bg-elevated hover:bg-secondary text-secondary hover:text-primary transition border border-subtle"
            title="Sinkronisasi Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenShareModal}
            className="p-2 rounded-xl bg-elevated hover:bg-secondary text-secondary hover:text-primary transition border border-subtle"
            title="Bagikan Tautan Request"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {userRole === 'admin' && (
            <button
              onClick={onOpenSheetModal}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                sheetConfig.connected
                  ? 'bg-blue/10 text-blue border-blue/30'
                  : 'bg-elevated text-secondary border-subtle hover:bg-secondary'
              }`}
              title="Google Sheet Request Sync"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{sheetConfig.connected ? 'Sheet Terhubung' : 'Sambung Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: DJ Profile, Theme Switcher, Notifications */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* DJ Profile Pill */}
        <div className="flex items-center space-x-2.5 bg-elevated border border-subtle pl-3 pr-2 py-1 rounded-full">
          <span className="text-xs font-semibold text-secondary hidden sm:inline">
            Penyiar:
          </span>
          <span className="text-xs font-black text-primary font-display uppercase tracking-wide">
            {currentHost.name}
          </span>
          <img
            src={currentHost.photoUrl}
            alt={currentHost.name}
            className="w-7 h-7 rounded-full object-cover border border-subtle"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
            }}
          />
        </div>

        {/* Theme Switcher ☀️ / 🌙 */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl bg-elevated hover:bg-secondary text-primary border border-subtle transition flex items-center justify-center"
          title={`Ganti tema ke mode ${theme === 'light' ? 'Gelap' : 'Terang'}`}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-primary" />
          ) : (
            <Sun className="w-4 h-4 text-[#B6FF00]" />
          )}
        </button>

        {/* Notification Bell */}
        <button
          className="p-2.5 rounded-2xl bg-elevated hover:bg-secondary text-secondary hover:text-primary border border-subtle transition relative"
          title="Notifikasi Siaran"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF4F91]"></span>
        </button>
      </div>
    </header>
  );
};
