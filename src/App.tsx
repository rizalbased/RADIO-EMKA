import React, { useState, useEffect } from 'react';
import { Sidebar, MainTabType } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { RadioPlayerView } from './components/RadioPlayerView';
import { QueuePanel } from './components/QueuePanel';
import { DjStudio } from './components/DjStudio';
import { SongRequestForm } from './components/SongRequestForm';
import { LiveFeed } from './components/LiveFeed';
import { CurrentlyPlaying } from './components/CurrentlyPlaying';
import { UserLiveRadio } from './components/UserLiveRadio';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { AiWingmanModal } from './components/AiWingmanModal';
import { GoogleSheetModal } from './components/GoogleSheetModal';
import { ShareRequestLinkModal } from './components/ShareRequestLinkModal';
import { AdminPinModal } from './components/AdminPinModal';
import { StoryShareModal } from './components/StoryShareModal';
import { GlobalYouTubePlayer } from './components/GlobalYouTubePlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { AccessLandingView } from './components/AccessLandingView';

import { SongRequest, SheetConfig, RadioHost } from './types';
import { ensureAnonymousSession, getAdminSessionStatus } from './lib/supabaseClient';
import {
  fetchSheetConfig,
  fetchSongRequests,
  subscribeSongRequests,
  submitSongRequest,
  updateRequestStatus,
  updateRequestYoutubeVideoId,
  likeRequest,
  connectGoogleSheet,
  deleteSongRequest,
  clearAllSongRequests,
  fetchRadioHosts,
  subscribeRadioHosts,
  updateRadioHosts,
  loginAdmin,
  logoutAdmin
} from './services/api';

import {
  Radio,
  Lock,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Home,
  Music,
  Headphones,
  ListMusic,
  Settings,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';
import { RadioEngineProvider } from './contexts/RadioEngineContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTabType>('player');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [isAccessChosen, setIsAccessChosen] = useState<boolean>(false);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ connected: false });
  const [radioHosts, setRadioHosts] = useState<RadioHost[]>([
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
  ]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals state
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [storyModalRequest, setStoryModalRequest] = useState<Partial<SongRequest> | null>(null);

  // Check URL query parameters or localStorage for role mode on initial mount
  useEffect(() => {
    async function initSessionAndRole() {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode') || params.get('role');
      const isChosen = localStorage.getItem('fm_access_chosen') === 'true';
      const savedRole = localStorage.getItem('fm_user_role') as 'user' | 'admin' | null;

      // Verify Supabase Auth Session
      const adminStatus = await getAdminSessionStatus();

      if (urlMode === 'admin' || (isChosen && savedRole === 'admin')) {
        if (adminStatus.isAdmin) {
          setUserRole('admin');
          setActiveTab('player');
          setIsAccessChosen(true);
        } else {
          // If admin requested but not authenticated with admin role, show PIN modal or landing
          setIsAccessChosen(false);
          setIsAdminPinModalOpen(true);
        }
      } else if (urlMode === 'user' || urlMode === 'student' || (isChosen && savedRole === 'user')) {
        setUserRole('user');
        setActiveTab('feed');
        setIsAccessChosen(true);
        localStorage.setItem('fm_access_chosen', 'true');
        localStorage.setItem('fm_user_role', 'user');
        ensureAnonymousSession().catch(() => {});
      } else {
        // First time opening: Show welcome access selection screen
        setIsAccessChosen(false);
        ensureAnonymousSession().catch(() => {});
      }
    }

    initSessionAndRole();
  }, []);

  // Manual refresh handler for UI buttons
  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      const [config, reqs, hostsData] = await Promise.all([
        fetchSheetConfig(),
        fetchSongRequests(),
        fetchRadioHosts()
      ]);
      setSheetConfig(config);
      if (reqs.requests) setRequests(reqs.requests);
      if (hostsData && hostsData.length > 0) setRadioHosts(hostsData);
    } catch (e) {
      console.error('Error refreshing data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load initial data and bind Realtime Listeners
  useEffect(() => {
    setIsSyncing(true);

    // Initialize Supabase anonymous user session in background
    ensureAnonymousSession().catch(() => {});

    // Initial Sheet config load
    fetchSheetConfig()
      .then((config) => {
        setSheetConfig(config);
      })
      .catch((e) => console.error('Error loading sheet config:', e));

    // Real-time Firestore Song Requests Listener
    const unsubRequests = subscribeSongRequests((latestRequests) => {
      const seen = new Set<string>();
      const unique = (latestRequests || []).filter((item) => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      setRequests(unique);
      setIsSyncing(false);
    });

    // Real-time Firestore Radio Hosts Listener
    const unsubHosts = subscribeRadioHosts((latestHosts) => {
      if (latestHosts && latestHosts.length > 0) {
        setRadioHosts(latestHosts);
      }
    });

    return () => {
      unsubRequests();
      unsubHosts();
    };
  }, []);

  const handleConnectSheet = async (payload: { spreadsheetId?: string; spreadsheetUrl?: string }) => {
    const result = await connectGoogleSheet(payload);
    if (result.config) {
      setSheetConfig(result.config);
    }
  };

  const handleUpdateHostsData = async (updatedHosts: RadioHost[]) => {
    const result = await updateRadioHosts(updatedHosts);
    if (result.hosts) {
      setRadioHosts(result.hosts);
    }
  };

  const handleSubmitRequest = async (data: any) => {
    setIsSubmitting(true);
    try {
      const result = await submitSongRequest(data);
      if (!result.success) {
        throw new Error(result.error || 'Request gagal dikirim ke server.');
      }
      if (result.requests) {
        setRequests(result.requests);
      }
      setTimeout(() => setActiveTab('feed'), 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeRequest = async (id: string) => {
    try {
      const result = await likeRequest(id);
      if (result.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, likes: result.likes } : r))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'Queued' | 'Playing' | 'Played') => {
    try {
      const result = await updateRequestStatus(id, status);
      if (result.requests) {
        setRequests(result.requests);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateYoutubeVideoId = async (id: string, youtubeVideoId: string) => {
    try {
      const result = await updateRequestYoutubeVideoId(id, youtubeVideoId);
      if (result.requests) {
        setRequests(result.requests);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    const result = await deleteSongRequest(id);
    if (result.requests) {
      setRequests(result.requests);
    }
  };

  const handleClearAllRequests = async () => {
    const result = await clearAllSongRequests();
    if (result.requests) {
      setRequests(result.requests);
    }
  };

  // Student entry
  const handleSelectStudent = () => {
    setUserRole('user');
    setIsAccessChosen(true);
    localStorage.setItem('fm_access_chosen', 'true');
    localStorage.setItem('fm_user_role', 'user');
    setActiveTab('feed');
    ensureAnonymousSession().catch(() => {});
  };

  // Admin PIN Login Success (PIN 1902)
  const handleAdminLoginSuccess = () => {
    setUserRole('admin');
    setIsAccessChosen(true);
    localStorage.setItem('fm_access_chosen', 'true');
    localStorage.setItem('fm_user_role', 'admin');
    localStorage.setItem('fm_admin_authenticated', 'true');
    setActiveTab('player');
    setIsAdminPinModalOpen(false);
  };

  // Logout Admin / Switch Role -> Returns to Welcome Landing Page
  const handleLogoutOrSwitchRole = () => {
    logoutAdmin();
    localStorage.removeItem('fm_admin_authenticated');
    localStorage.removeItem('fm_access_chosen');
    localStorage.removeItem('fm_user_role');
    setIsAccessChosen(false);
    setUserRole('user');
  };

  const currentlyPlayingTrack = requests.find((r) => r.status === 'Playing');
  const queuedRequestsList = requests.filter((r) => r.status === 'Queued');
  const nextUpTrack = queuedRequestsList.length > 0 ? queuedRequestsList[0] : undefined;

  return (
    <ThemeProvider>
      <RadioEngineProvider
        requests={requests}
        onUpdateStatus={handleUpdateStatus}
        userRole={userRole}
      >
        <GlobalYouTubePlayer />

        {!isAccessChosen ? (
          <AccessLandingView
            onSelectStudent={handleSelectStudent}
            onAdminLoginSuccess={handleAdminLoginSuccess}
          />
        ) : (
          <div className="min-h-screen bg-primary text-primary font-sans flex flex-col md:flex-row transition-colors duration-250">
            {/* DESKTOP SIDEBAR (COLUMN 1) */}
            <div className="hidden md:block">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                userRole={userRole}
                onLogout={handleLogoutOrSwitchRole}
                requests={requests}
              />
            </div>

            {/* MOBILE TOP BAR */}
            <div className="md:hidden bg-card border-b border-subtle p-4 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  className="p-2 rounded-xl bg-elevated border border-subtle text-primary"
                >
                  {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <div className="flex items-center space-x-1 font-display font-black text-xl">
                  <span className="text-primary">EMKA</span>
                  <span className="text-[#FF4F91]">RADIO</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#B6FF00] text-black text-[10px] font-black uppercase tracking-wider font-display">
                  ● LIVE
                </span>
              </div>
            </div>

            {/* MOBILE DRAWER / MENU */}
            {isMobileSidebarOpen && (
              <div className="fixed inset-0 z-40 bg-black/60 md:hidden flex" onClick={() => setIsMobileSidebarOpen(false)}>
                <div className="w-72 bg-card h-full" onClick={(e) => e.stopPropagation()}>
                  <Sidebar
                    activeTab={activeTab}
                    setActiveTab={(t) => {
                      setActiveTab(t);
                      setIsMobileSidebarOpen(false);
                    }}
                    userRole={userRole}
                    onLogout={() => {
                      setIsMobileSidebarOpen(false);
                      handleLogoutOrSwitchRole();
                    }}
                    requests={requests}
                  />
                </div>
              </div>
            )}

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-8">
            {/* TOP HEADER */}
            <TopHeader
              radioHost={radioHosts[0]}
              radioHosts={radioHosts}
              onOpenSheetModal={() => setIsSheetModalOpen(true)}
              onOpenShareModal={() => setIsShareModalOpen(true)}
              sheetConfig={sheetConfig}
              isSyncing={isSyncing}
              onRefresh={handleManualRefresh}
              userRole={userRole}
            />

            <main className="p-4 sm:p-6 lg:p-8 flex-1">
              {/* 1. DEDICATED RADIO PLAYER (3-COLUMN LAYOUT: Radio Player + Queue Panel) */}
              <div className={activeTab === 'player' ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start' : 'hidden'}>
                {/* Center Column: Big Radio Player */}
                <div className="xl:col-span-8">
                  <RadioPlayerView
                    requests={requests}
                    onOpenStoryModal={(req) => setStoryModalRequest(req)}
                    onLike={handleLikeRequest}
                  />
                </div>

                {/* Right Column: Antrean FIFO Queue */}
                <div className="xl:col-span-4">
                  <QueuePanel
                    requests={requests}
                    onUpdateStatus={handleUpdateStatus}
                    onDeleteRequest={handleDeleteRequest}
                    onClearAllRequests={handleClearAllRequests}
                    onOpenStoryModal={(req) => setStoryModalRequest(req)}
                  />
                </div>
              </div>

              {/* 2. SETTING PENYIAR */}
              {activeTab === 'dj' && (
                <DjStudio
                  requests={requests}
                  onUpdateStatus={handleUpdateStatus}
                  onDeleteRequest={handleDeleteRequest}
                  onClearAllRequests={handleClearAllRequests}
                  sheetConfig={sheetConfig}
                  onRefresh={handleManualRefresh}
                  isSyncing={isSyncing}
                  onOpenShareModal={() => setIsShareModalOpen(true)}
                  radioHost={radioHosts[0]}
                  radioHosts={radioHosts}
                  onUpdateRadioHost={(host) => handleUpdateHostsData([host, radioHosts[1]])}
                  onUpdateRadioHosts={handleUpdateHostsData}
                  onOpenStoryModal={(req) => setStoryModalRequest(req)}
                  onUpdateYoutubeVideoId={handleUpdateYoutubeVideoId}
                  onGoToPlayerTab={() => setActiveTab('player')}
                />
              )}

              {/* 3. REQUEST LAGU */}
              {activeTab === 'request' && (
                <div className="max-w-3xl mx-auto">
                  <SongRequestForm
                    onSubmitRequest={handleSubmitRequest}
                    isSubmitting={isSubmitting}
                  />
                </div>
              )}

              {/* 4. LIVE FEED / DASHBOARD */}
              {activeTab === 'feed' && (
                <LiveFeed
                  requests={requests}
                  onLikeRequest={handleLikeRequest}
                  isSyncing={isSyncing}
                  onRefresh={handleManualRefresh}
                  sheetConfig={sheetConfig}
                  onOpenSheetModal={() => setIsSheetModalOpen(true)}
                  onOpenStoryModal={(req) => setStoryModalRequest(req)}
                  userRole={userRole}
                  onDeleteRequest={handleDeleteRequest}
                  onClearAllRequests={handleClearAllRequests}
                />
              )}

              {/* 5. ANTREAN (Dedicated Full Queue View) */}
              {activeTab === 'queue' && (
                <div className="max-w-4xl mx-auto">
                  <QueuePanel
                    requests={requests}
                    onUpdateStatus={handleUpdateStatus}
                    onDeleteRequest={handleDeleteRequest}
                    onClearAllRequests={handleClearAllRequests}
                    onOpenStoryModal={(req) => setStoryModalRequest(req)}
                  />
                </div>
              )}

              {/* 6. AI WINGMAN */}
              {activeTab === 'ai' && <AiWingmanModal />}

              {/* 7. PREVIEW SISWA */}
              {activeTab === 'preview' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <CurrentlyPlaying
                    currentTrack={currentlyPlayingTrack}
                    nextTrack={nextUpTrack}
                    queuedRequests={queuedRequestsList}
                    queuedCount={queuedRequestsList.length}
                    onLike={handleLikeRequest}
                    onOpenAiWingman={() => setActiveTab('ai')}
                    radioHost={radioHosts[0]}
                    radioHosts={radioHosts}
                    userRole={userRole}
                    onGoToDjStudio={() => setActiveTab('dj')}
                    onGoToRequestTab={() => setActiveTab('request')}
                    onGoToFeedTab={() => setActiveTab('feed')}
                    onOpenStoryModal={(req) => setStoryModalRequest(req)}
                  />
                  <UserLiveRadio />
                </div>
              )}

              {/* 8. RIWAYAT */}
              {activeTab === 'history' && (
                <HistoryView
                  requests={requests}
                  onPlayAgain={async (id) => {
                    await handleUpdateStatus(id, 'Playing');
                    setActiveTab('player');
                  }}
                />
              )}

              {/* 9. LAPORAN */}
              {activeTab === 'reports' && <ReportsView requests={requests} />}
            </main>
          </div>

          {/* MOBILE BOTTOM NAVIGATION BAR */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-subtle px-3 py-2 flex items-center justify-around z-30">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex flex-col items-center p-1 text-[10px] font-bold ${
                activeTab === 'feed' ? 'text-[#FF4F91]' : 'text-secondary'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setActiveTab('request')}
              className={`flex flex-col items-center p-1 text-[10px] font-bold ${
                activeTab === 'request' ? 'text-[#FF4F91]' : 'text-secondary'
              }`}
            >
              <Music className="w-5 h-5" />
              <span>Request</span>
            </button>

            <button
              onClick={() => setActiveTab('player')}
              className={`flex flex-col items-center p-1 text-[10px] font-bold ${
                activeTab === 'player' ? 'text-[#B6FF00] font-black' : 'text-secondary'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#B6FF00] text-[#0B0B0B] flex items-center justify-center -mt-3 shadow-md border border-black">
                <Headphones className="w-4 h-4" />
              </div>
              <span className="mt-0.5">Radio</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex flex-col items-center p-1 text-[10px] font-bold ${
                activeTab === 'queue' ? 'text-[#FF4F91]' : 'text-secondary'
              }`}
            >
              <ListMusic className="w-5 h-5" />
              <span>Antrean</span>
            </button>

            <button
              onClick={() => setActiveTab('dj')}
              className={`flex flex-col items-center p-1 text-[10px] font-bold ${
                activeTab === 'dj' ? 'text-[#FF4F91]' : 'text-secondary'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Setting</span>
            </button>
          </div>

          {/* Persistent Mini Player across tabs */}
          <MiniPlayer activeTab={activeTab} setActiveTab={setActiveTab} requests={requests} />

          {/* Modals */}
          <GoogleSheetModal
            isOpen={isSheetModalOpen}
            onClose={() => setIsSheetModalOpen(false)}
            sheetConfig={sheetConfig}
            onConnectSheet={handleConnectSheet}
            onRefresh={handleManualRefresh}
            requests={requests}
          />

          <ShareRequestLinkModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />

          <AdminPinModal
            isOpen={isAdminPinModalOpen}
            onClose={() => setIsAdminPinModalOpen(false)}
            onSuccessAdmin={handleAdminLoginSuccess}
          />

          <StoryShareModal
            isOpen={!!storyModalRequest}
            onClose={() => setStoryModalRequest(null)}
            request={storyModalRequest}
            radioHost={radioHosts[0]}
            radioHosts={radioHosts}
          />
        </div>
        )}
      </RadioEngineProvider>
    </ThemeProvider>
  );
}
