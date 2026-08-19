export type MoodTag = 
  | '💌 Secret Confession'
  | '🎧 Vibe Check'
  | '💔 Galau Time'
  | '🔥 Hype Track'
  | '🎂 Ultah Wish'
  | '☕ Chill Afternoon';

export type RequestStatus = 'Queued' | 'Playing' | 'Played' | 'pending' | 'playing' | 'played' | 'rejected' | 'cancelled';

export interface DbSongRequest {
  id: string;
  user_id?: string | null;
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url?: string | null;
  requester_name: string;
  class_name: string;
  target_person?: string | null;
  message?: string | null;
  mood?: string | null;
  likes?: number | null;
  status: 'pending' | 'playing' | 'played' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at?: string | null;
  played_at?: string | null;
}

export interface SongRequest {
  id: string;
  timestamp: string;
  studentName: string;
  className: string;
  songTitle: string;
  artist: string;
  targetPerson: string;
  message: string;
  mood: MoodTag;
  coverUrl?: string;
  previewUrl?: string;
  status: RequestStatus;
  likes: number;
  youtubeVideoId?: string;
  sheetRowIndex?: number;
  userId?: string | null;
  playedAt?: string | null;
}

export function mapDbRequestToSongRequest(db: DbSongRequest): SongRequest {
  let uiStatus: RequestStatus = 'Queued';
  if (db.status === 'playing') uiStatus = 'Playing';
  else if (db.status === 'played') uiStatus = 'Played';
  else if (db.status === 'pending') uiStatus = 'Queued';

  return {
    id: db.id,
    timestamp: db.created_at || new Date().toISOString(),
    studentName: db.requester_name || 'Anonim',
    className: db.class_name || '-',
    songTitle: db.title || 'Judul Lagu',
    artist: db.channel_title || 'Penyanyi',
    targetPerson: db.target_person || 'Semua Teman',
    message: db.message || 'Salam hangat!',
    mood: (db.mood as MoodTag) || '🎧 Vibe Check',
    coverUrl: db.thumbnail_url || (db.video_id ? `https://i.ytimg.com/vi/${db.video_id}/hqdefault.jpg` : undefined),
    status: uiStatus,
    likes: db.likes || 0,
    youtubeVideoId: db.video_id || undefined,
    userId: db.user_id || null,
    playedAt: db.played_at || null
  };
}

export interface SheetConfig {
  connected: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  title?: string;
  lastSyncedAt?: string;
  error?: string;
  mode?: 'oauth' | 'demo' | 'api_key';
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export interface AiVibeAnalysis {
  romanceScore: number;
  vibeCategory: string;
  recommendation: string;
  storyCaption: string;
  suggestedEmoji: string;
}

export interface RadioHost {
  id?: string;
  name: string;
  tagline: string;
  photoUrl: string;
  instagram?: string;
  isOnAir: boolean;
}

export interface LiveRadioState {
  videoId: string;
  trackId: string;
  songTitle: string;
  artist: string;
  artworkUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'IDLE' | 'STOPPED';
  position: number;
  updatedAt: number;
  queueIndex: number;
  sequence: number;
}
