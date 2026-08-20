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
  video_id?: string | null;
  title: string;
  channel_title: string;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  album?: string | null;
  genre?: string | null;
  itunes_track_id?: string | number | null;
  itunes_collection_id?: string | number | null;
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
  album?: string;
  genre?: string;
  itunesTrackId?: string | number;
  itunesCollectionId?: string | number;
  status: RequestStatus;
  likes: number;
  youtubeVideoId?: string;
  sheetRowIndex?: number;
  userId?: string | null;
  playedAt?: string | null;
}

import { decodeHtmlEntities } from './lib/textUtils';

export function mapDbRequestToSongRequest(db: DbSongRequest): SongRequest {
  let uiStatus: RequestStatus = 'Queued';
  if (db.status === 'playing') uiStatus = 'Playing';
  else if (db.status === 'played') uiStatus = 'Played';
  else if (db.status === 'pending' || (db.status as any) === 'queued') uiStatus = 'Queued';

  return {
    id: db.id,
    timestamp: db.created_at || new Date().toISOString(),
    studentName: decodeHtmlEntities(db.requester_name) || 'Anonim',
    className: decodeHtmlEntities(db.class_name) || '-',
    songTitle: decodeHtmlEntities(db.title) || 'Judul Lagu',
    artist: decodeHtmlEntities(db.channel_title) || 'Penyanyi',
    targetPerson: decodeHtmlEntities(db.target_person) || 'Semua Teman',
    message: decodeHtmlEntities(db.message) || 'Salam hangat!',
    mood: (db.mood as MoodTag) || '🎧 Vibe Check',
    coverUrl: db.thumbnail_url || (db.video_id ? `https://i.ytimg.com/vi/${db.video_id}/hqdefault.jpg` : undefined),
    previewUrl: db.preview_url || undefined,
    album: db.album || undefined,
    genre: db.genre || undefined,
    itunesTrackId: db.itunes_track_id || undefined,
    itunesCollectionId: db.itunes_collection_id || undefined,
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

export interface ItunesSearchResult {
  trackId: number | string;
  collectionId?: number | string;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100: string;
  artworkUrl600?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
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

export interface DbRadioState {
  id: number;
  status: 'playing' | 'paused' | 'standby';
  current_request_id?: string | null;
  current_video_id?: string | null;
  current_title?: string | null;
  current_channel_title?: string | null;
  current_thumbnail_url?: string | null;
  current_preview_url?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
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
