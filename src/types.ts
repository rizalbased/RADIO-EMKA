export type MoodTag = 
  | '💌 Secret Confession'
  | '🎧 Vibe Check'
  | '💔 Galau Time'
  | '🔥 Hype Track'
  | '🎂 Ultah Wish'
  | '☕ Chill Afternoon';

export type RequestStatus = 'Queued' | 'Playing' | 'Played';

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
