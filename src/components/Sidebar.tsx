import React from 'react';
import {
  Home,
  Music,
  Radio,
  Headphones,
  ListMusic,
  Settings,
  Sparkles,
  Heart,
  History,
  BarChart3,
  LogOut,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  UserCheck,
  ShieldCheck,
  Disc
} from 'lucide-react';
import { SongRequest } from '../types';
import { useRadioEngine } from '../contexts/RadioEngineContext';

export type MainTabType = 'player' | 'request' | 'feed' | 'queue' | 'dj' | 'ai' | 'preview' | 'history' | 'reports';

interface SidebarProps {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  userRole: 'user' | 'admin';
  onLogout: () => void;
  requests: SongRequest[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  onLogout,
  requests
}) => {
  const {
    ytPlayerState,
    togglePlayPause,
    handleNextRequest,
    handlePreviousRequest
  } = useRadioEngine();

  const playingTrack = requests.find((r) => r.status === 'Playing');
  const isPlaying = ytPlayerState === 1;

  const menuItems: { id: MainTabType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'feed', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
    { id: 'request', label: 'Request Lagu', icon: <Music className="w-4 h-4" /> },
    { id: 'feed', label: 'Live Feed', icon: <Radio className="w-4 h-4" /> },
    { id: 'player', label: 'Radio Player', icon: <Headphones className="w-4 h-4" /> },
    { id: 'queue', label: 'Antrean', icon: <ListMusic className="w-4 h-4" /> },
    { id: 'dj', label: 'Setting Penyiar', icon: <Settings className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Wingman', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'preview', label: 'Preview Siswa', icon: <Heart className="w-4 h-4" /> },
    { id: 'history', label: 'Riwayat', icon: <History className="w-4 h-4" /> },
    { id: 'reports', label: 'Laporan', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-card border-r border-subtle flex flex-col justify-between h-screen sticky top-0 transition-colors z-30 select-none">
      {/* Brand Top Header */}
      <div>
        <div className="p-5 border-b border-subtle flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#B6FF00] border-2 border-black flex items-center justify-center text-[#0B0B0B] shadow-pop flex-shrink-0">
            <Radio className="w-5 h-5 text-[#0B0B0B]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 leading-none">
              <span className="font-display font-black text-2xl tracking-tight text-primary uppercase">
                EMKA
              </span>
              <span className="font-display font-black text-2xl tracking-tight text-[#FF4F91] uppercase">
                RADIO
              </span>
            </div>
            <p className="text-[10px] font-bold text-secondary tracking-wider uppercase mt-0.5">
              RADIO MULTI KARYA
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-none">
          {menuItems.map((item, idx) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-[#B6FF00] text-[#0B0B0B] shadow-sm font-black'
                    : 'text-secondary hover:text-primary hover:bg-elevated'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? 'text-[#0B0B0B]' : 'text-secondary'}>
                    {item.icon}
                  </span>
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {item.id === 'queue' && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-black text-[#B6FF00]' : 'bg-elevated text-secondary border border-subtle'
                  }`}>
                    {requests.filter(r => r.status === 'Queued').length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sidebar: Mini Track Widget & Logout */}
      <div className="p-3 border-t border-subtle space-y-2">
        {playingTrack && (
          <div className="p-2.5 rounded-2xl bg-elevated border border-subtle space-y-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-black flex-shrink-0 relative border border-subtle">
                {playingTrack.coverUrl ? (
                  <img
                    src={playingTrack.coverUrl}
                    alt={playingTrack.songTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#B6FF00] flex items-center justify-center text-[10px] font-bold text-black">
                    EMKA
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Disc className="w-3.5 h-3.5 text-[#B6FF00] animate-spin" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-primary truncate leading-tight">
                  {playingTrack.songTitle}
                </p>
                <p className="text-[10px] font-medium text-secondary truncate">
                  {playingTrack.artist}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-1 border-t border-subtle">
              <button
                onClick={handlePreviousRequest}
                className="p-1 rounded-lg hover:bg-card text-secondary hover:text-primary transition"
                title="Lagu Sebelumnya"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-7 h-7 rounded-full bg-[#B6FF00] text-[#0B0B0B] flex items-center justify-center border border-black shadow-xs hover:brightness-105 transition"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-black" /> : <Play className="w-3 h-3 fill-black ml-0.5" />}
              </button>
              <button
                onClick={handleNextRequest}
                className="p-1 rounded-lg hover:bg-card text-secondary hover:text-primary transition"
                title="Lagu Berikutnya"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-secondary hover:text-rose-500 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>{userRole === 'admin' ? 'Keluar Admin' : 'Ganti Akses'}</span>
        </button>
      </div>
    </aside>
  );
};
