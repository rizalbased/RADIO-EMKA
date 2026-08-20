import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  url = url.replace(/^["'`]|["'`]$/g, '').trim();
  url = url.replace(/\/(rest|auth|storage|graphql)\/v\d+.*$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
}

function sanitizeSupabaseKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let key = rawKey.trim();
  key = key.replace(/^["'`]|["'`]$/g, '').trim();
  return key;
}

// Server-side Supabase client for admin operations
const rawServerSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const rawServerSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const serverSupabaseUrl = sanitizeSupabaseUrl(rawServerSupabaseUrl);
const serverSupabaseKey = sanitizeSupabaseKey(rawServerSupabaseKey);

const serverSupabase = serverSupabaseUrl && serverSupabaseKey
  ? createClient(serverSupabaseUrl, serverSupabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })
  : null;

// Local data persistence setup (ensures app works even before sheet is linked or as offline backup)
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const CONFIG_FILE = path.join(DATA_DIR, 'sheet_config.json');
const DELETED_IDS_FILE = path.join(DATA_DIR, 'deleted_ids.json');
const RADIO_HOST_FILE = path.join(DATA_DIR, 'radio_host.json');
const LIVE_STATE_FILE = path.join(DATA_DIR, 'live_radio_state.json');

interface LiveRadioState {
  videoId: string;
  trackId: string;
  songTitle: string;
  artist: string;
  artworkUrl: string;
  status: string;
  position: number;
  updatedAt: number;
  queueIndex: number;
  sequence: number;
}

const DEFAULT_LIVE_STATE: LiveRadioState = {
  videoId: '',
  trackId: '',
  songTitle: '',
  artist: '',
  artworkUrl: '',
  status: 'IDLE',
  position: 0,
  updatedAt: 0,
  queueIndex: 0,
  sequence: 0
};

function loadLiveState(): LiveRadioState {
  if (fs.existsSync(LIVE_STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LIVE_STATE_FILE, 'utf-8'));
    } catch {
      return DEFAULT_LIVE_STATE;
    }
  }
  return DEFAULT_LIVE_STATE;
}

function saveLiveState(state: LiveRadioState) {
  try {
    fs.writeFileSync(LIVE_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    console.log('Error saving live state:', err.message);
  }
}

interface RadioHostData {
  id?: string;
  name: string;
  tagline: string;
  photoUrl: string;
  instagram?: string;
  isOnAir: boolean;
}

const DEFAULT_HOSTS: RadioHostData[] = [
  {
    id: 'host-1',
    name: '',
    tagline: '',
    photoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    instagram: '',
    isOnAir: false
  },
  {
    id: 'host-2',
    name: '',
    tagline: '',
    photoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    instagram: '',
    isOnAir: false
  }
];

function loadRadioHosts(): RadioHostData[] {
  if (fs.existsSync(RADIO_HOST_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(RADIO_HOST_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        return data.map((h, i) => ({
          id: h.id || `host-${i + 1}`,
          name: typeof h.name === 'string' ? h.name.trim() : '',
          tagline: typeof h.tagline === 'string' ? h.tagline.trim() : '',
          photoUrl: h.photoUrl || DEFAULT_HOSTS[i % 2].photoUrl,
          instagram: typeof h.instagram === 'string' ? h.instagram.trim() : '',
          isOnAir: typeof h.isOnAir === 'boolean' ? h.isOnAir : false
        }));
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.hosts) && data.hosts.length > 0) {
          const loaded = data.hosts.map((h: any, i: number) => ({
            id: h.id || `host-${i + 1}`,
            name: typeof h.name === 'string' ? h.name.trim() : '',
            tagline: typeof h.tagline === 'string' ? h.tagline.trim() : '',
            photoUrl: h.photoUrl || DEFAULT_HOSTS[i % 2].photoUrl,
            instagram: typeof h.instagram === 'string' ? h.instagram.trim() : '',
            isOnAir: typeof h.isOnAir === 'boolean' ? h.isOnAir : false
          }));
          while (loaded.length < 2) {
            loaded.push({
              id: `host-${loaded.length + 1}`,
              name: '',
              tagline: '',
              photoUrl: DEFAULT_HOSTS[1].photoUrl,
              instagram: '',
              isOnAir: false
            });
          }
          return loaded;
        } else if (typeof data.name === 'string') {
          return [
            {
              id: 'host-1',
              name: data.name.trim(),
              tagline: typeof data.tagline === 'string' ? data.tagline.trim() : '',
              photoUrl: data.photoUrl || DEFAULT_HOSTS[0].photoUrl,
              instagram: typeof data.instagram === 'string' ? data.instagram.trim() : '',
              isOnAir: typeof data.isOnAir === 'boolean' ? data.isOnAir : false
            },
            DEFAULT_HOSTS[1]
          ];
        }
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_HOSTS;
}

function saveRadioHosts(hosts: RadioHostData[]) {
  fs.writeFileSync(RADIO_HOST_FILE, JSON.stringify({ hosts }, null, 2));
}


function loadDeletedData(): { ids: string[]; clearedAllAt: number } {
  if (fs.existsSync(DELETED_IDS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DELETED_IDS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        return { ids: parsed, clearedAllAt: 0 };
      }
      return {
        ids: Array.isArray(parsed.ids) ? parsed.ids : [],
        clearedAllAt: typeof parsed.clearedAllAt === 'number' ? parsed.clearedAllAt : 0
      };
    } catch {
      return { ids: [], clearedAllAt: 0 };
    }
  }
  return { ids: [], clearedAllAt: 0 };
}

function saveDeletedData(data: { ids: string[]; clearedAllAt: number }) {
  fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(data, null, 2));
}

function mapRequestToRow(req: any) {
  return [
    req.id,
    req.timestamp,
    req.studentName,
    req.className,
    req.songTitle,
    req.artist,
    req.targetPerson,
    req.message,
    req.mood,
    req.coverUrl,
    req.previewUrl,
    req.status,
    req.likes || 0
  ];
}

async function overwriteSheetRows(spreadsheetId: string, requests: any[]) {
  try {
    const auth = getGoogleAuth();
    if (!auth) return;
    const sheets = google.sheets({ version: 'v4', auth });

    // Clear existing range
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Request Lagu!A2:M1000',
    });

    // Write updated rows if any remain
    if (requests.length > 0) {
      const values = requests.map(mapRequestToRow);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Request Lagu!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }
  } catch (err: any) {
    console.log('Error overwriting Google Sheet rows:', err.message);
  }
}

// Initial requests data (starts completely empty by default)
const INITIAL_REQUESTS: any[] = [];

function loadLocalRequests() {
  if (fs.existsSync(REQUESTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
    } catch {
      return [];
    }
  } else {
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

function saveLocalRequests(data: any) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2));
}

function loadSheetConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      return { connected: false };
    }
  }
  return { connected: false };
}

function saveSheetConfig(data: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// Google OAuth client setup
function getGoogleAuth() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });
    return auth;
  } catch (err) {
    console.log('Google auth client setup notice:', err);
    return null;
  }
}

// API Routes

// 0. Admin Authentication Endpoint
app.post('/api/admin/login', (req, res) => {
  const { usernameOrEmail, username, email, password, pin } = req.body;
  const inputIdentifier = (usernameOrEmail || username || email || '').trim().toLowerCase();
  const inputPassword = (password || '').trim();
  const inputPin = (pin || '').trim();

  const validUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const validEmail = (process.env.ADMIN_EMAIL || 'admin@emkaradio.sch.id').toLowerCase();
  const validPassword = process.env.ADMIN_PASSWORD || 'emkaradio1902';
  const validPin = '1902';

  let isValid = false;

  // Check username/email + password match
  if (inputIdentifier && inputPassword) {
    if ((inputIdentifier === validUsername || inputIdentifier === validEmail) && inputPassword === validPassword) {
      isValid = true;
    }
  }

  // Allow pin fallback or password match if identifier empty
  if (!isValid && inputPassword === validPassword) {
    isValid = true;
  }

  if (!isValid && inputPin === validPin) {
    isValid = true;
  }

  if (isValid) {
    const token = 'emka_admin_token_' + Math.random().toString(36).substring(2) + Date.now();
    return res.json({
      success: true,
      token,
      user: {
        username: validUsername,
        email: validEmail,
        role: 'admin'
      }
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Username / Email atau Password / PIN Admin salah! Akses ditolak.'
  });
});

// 1. Get Google Sheet status & config
app.get('/api/sheets/config', async (req, res) => {
  const config = loadSheetConfig();
  res.json(config);
});

// 2. Connect or setup a Google Sheet
app.post('/api/sheets/connect', async (req, res) => {
  const { spreadsheetId, spreadsheetUrl } = req.body;

  let sheetId = spreadsheetId;
  if (!sheetId && spreadsheetUrl) {
    const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) sheetId = match[1];
  }

  if (sheetId) {
    const newConfig = {
      connected: true,
      spreadsheetId: sheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      title: 'FM Radio Request Lagu & Confession Gen Z',
      lastSyncedAt: new Date().toISOString(),
      mode: 'linked'
    };
    saveSheetConfig(newConfig);

    // Try appending current requests to Sheet
    try {
      const auth = getGoogleAuth();
      if (auth) {
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Check or write headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: 'A1:M1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              'ID Request',
              'Waktu Request',
              'Nama Siswa',
              'Kelas',
              'Judul Lagu',
              'Penyanyi',
              'Target Confess',
              'Pesan Confession',
              'Mood Tag',
              'Cover Art URL',
              'Audio Preview URL',
              'Status',
              'Likes'
            ]]
          }
        });
      }
    } catch (e: any) {
      console.log('Sheet initial header sync warning:', e.message);
    }

    return res.json({ success: true, config: newConfig });
  }

  // Create new spreadsheet if requested
  try {
    const auth = getGoogleAuth();
    if (auth) {
      const sheets = google.sheets({ version: 'v4', auth });
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: '🎵 Request Lagu & Confession FM School (' + new Date().toLocaleDateString('id-ID') + ')'
          },
          sheets: [
            {
              properties: {
                title: 'Request Lagu',
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          ]
        }
      });

      const createdId = created.data.spreadsheetId;
      if (createdId) {
        // Set column headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: createdId,
          range: 'Request Lagu!A1:M1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              'ID Request',
              'Waktu Request',
              'Nama Siswa',
              'Kelas',
              'Judul Lagu',
              'Penyanyi',
              'Target Confess',
              'Pesan Confession',
              'Mood Tag',
              'Cover Art URL',
              'Audio Preview URL',
              'Status',
              'Likes'
            ]]
          }
        });

        // Sync existing items
        const localItems = loadLocalRequests();
        const rows = localItems.map((r: any) => [
          r.id,
          r.timestamp,
          r.studentName,
          r.className,
          r.songTitle,
          r.artist,
          r.targetPerson,
          r.message,
          r.mood,
          r.coverUrl || '',
          r.previewUrl || '',
          r.status,
          r.likes
        ]);

        if (rows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: createdId,
            range: 'Request Lagu!A2',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: rows }
          });
        }

        const newConfig = {
          connected: true,
          spreadsheetId: createdId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${createdId}`,
          title: created.data.properties?.title || 'Request Lagu & Confession',
          lastSyncedAt: new Date().toISOString(),
          mode: 'oauth'
        };
        saveSheetConfig(newConfig);
        return res.json({ success: true, config: newConfig });
      }
    }
  } catch (err: any) {
    console.log('Notice: Google Sheets API create endpoint notice:', err.message);
    if (err.message && (err.message.includes('has not been used') || err.message.includes('disabled') || err.message.includes('permission'))) {
      return res.status(400).json({
        error: 'Google Sheets API belum diaktifkan di Google Cloud Project. Silakan buat Spreadsheet di Google Drive Anda lalu tempelkan linknya di kolom "Sambungkan Link Google Sheet".'
      });
    }
  }

  // Fallback demo connected mode if user hasn't supplied sheet ID yet
  const demoConfig = {
    connected: true,
    spreadsheetId: 'demo-school-radio-sheet',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/u/0/',
    title: 'Request Lagu & Confession School Feed',
    lastSyncedAt: new Date().toISOString(),
    mode: 'demo'
  };
  saveSheetConfig(demoConfig);
  res.json({ success: true, config: demoConfig });
});

// 2b. Export requests as CSV file for Excel/Google Sheets
app.get('/api/sheets/export-csv', (req, res) => {
  const requests = loadLocalRequests();
  const headers = [
    'ID Request',
    'Waktu Request',
    'Nama Siswa',
    'Kelas',
    'Judul Lagu',
    'Penyanyi',
    'Target Confess',
    'Pesan Confession',
    'Mood Tag',
    'Status',
    'Likes'
  ];

  const csvRows = [headers.join(',')];

  requests.forEach((r: any) => {
    const row = [
      `"${r.id}"`,
      `"${r.timestamp}"`,
      `"${(r.studentName || '').replace(/"/g, '""')}"`,
      `"${(r.className || '').replace(/"/g, '""')}"`,
      `"${(r.songTitle || '').replace(/"/g, '""')}"`,
      `"${(r.artist || '').replace(/"/g, '""')}"`,
      `"${(r.targetPerson || '').replace(/"/g, '""')}"`,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      `"${(r.mood || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      r.likes || 0
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="request_lagu_radio_school.csv"');
  res.status(200).send(csvContent);
});

// Helper function to safely parse multiple date formats (ISO, Google Sheet Locale format, etc.)
function parseSafeDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  try {
    // Try custom parsing for common Google Sheet formats: "DD/MM/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
    const parts = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1; // 0-indexed
      const year = parseInt(parts[3], 10);
      const hour = parseInt(parts[4], 10);
      const minute = parseInt(parts[5], 10);
      const second = parseInt(parts[6], 10);
      const parsedDate = new Date(year, month, day, hour, minute, second);
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
  } catch {}
  
  return null;
}

// 3. Fetch song requests from Google Sheet (or local database synced)
app.get('/api/sheets/requests', async (req, res) => {
  const config = loadSheetConfig();
  const deletedInfo = loadDeletedData();
  const deletedIds = new Set(deletedInfo.ids);

  let localData = loadLocalRequests().filter((r: any) => {
    if (deletedIds.has(r.id)) return false;
    if (deletedInfo.clearedAllAt > 0) {
      const parsedDate = parseSafeDate(r.timestamp);
      if (parsedDate) {
        if (parsedDate.getTime() <= deletedInfo.clearedAllAt) return false;
      } else {
        // If timestamp cannot be parsed, assume it is old/deleted
        return false;
      }
    }
    return true;
  });

  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    try {
      const auth = getGoogleAuth();
      if (auth) {
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: 'Request Lagu!A2:N200',
        });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
          const sheetItems = rows
            // Filter out empty or unidentifiable rows to prevent empty cards
            .filter((row: any) => row && row.length >= 4 && (row[2] || row[4] || row[5]))
            .map((row: any, idx: number) => ({
              id: row[0] || `sheet-${idx}`,
              timestamp: row[1] || new Date().toISOString(),
              studentName: row[2] || 'Siswa',
              className: row[3] || 'Kelas',
              songTitle: row[4] || 'Judul Lagu',
              artist: row[5] || 'Penyanyi',
              targetPerson: row[6] || '-',
              message: row[7] || '',
              mood: row[8] || '🎧 Vibe Check',
              coverUrl: row[9] || '',
              previewUrl: row[10] || '',
              status: (row[11] as any) || 'Queued',
              likes: parseInt(row[12] || '0', 10),
              youtubeVideoId: row[13] || '',
              sheetRowIndex: idx + 2
            }))
            .filter((item: any) => {
              if (deletedIds.has(item.id)) return false;
              if (deletedInfo.clearedAllAt > 0) {
                const parsedDate = parseSafeDate(item.timestamp);
                if (parsedDate) {
                  if (parsedDate.getTime() <= deletedInfo.clearedAllAt) return false;
                } else {
                  // If timestamp cannot be parsed, assume it is old/deleted
                  return false;
                }
              }
              return true;
            });

          // Merge local requests that might not be in Google Sheet yet
          const existingIds = new Set(sheetItems.map((item: any) => item.id));
          const unsyncedLocal = localData.filter((item: any) => !existingIds.has(item.id));
          const merged = [...unsyncedLocal, ...sheetItems];

          saveLocalRequests(merged);
          return res.json({ requests: merged, synced: true });
        } else {
          saveLocalRequests(localData);
          return res.json({ requests: localData, synced: true });
        }
      }
    } catch (e: any) {
      console.log('Sheet fetch error, using local data:', e.message);
    }
  }

  saveLocalRequests(localData);
  res.json({ requests: localData, synced: false });
});

// 4. Submit new song request
app.post('/api/sheets/request', async (req, res) => {
  const { studentName, className, songTitle, artist, targetPerson, message, mood, coverUrl, previewUrl } = req.body;

  if (!studentName || !className || !songTitle || !artist) {
    return res.status(400).json({ error: 'Data tidak lengkap (Nama, Kelas, Lagu, dan Penyanyi wajib diisi)' });
  }

  const newRequest = {
    id: `req-${Date.now()}`,
    timestamp: new Date().toISOString(),
    studentName: studentName.trim(),
    className: className.trim(),
    songTitle: songTitle.trim(),
    artist: artist.trim(),
    targetPerson: targetPerson ? targetPerson.trim() : 'Semua Teman',
    message: message ? message.trim() : 'Salam hangat!',
    mood: mood || '🎧 Vibe Check',
    coverUrl: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    previewUrl: previewUrl || '',
    status: 'Queued',
    likes: 0,
    youtubeVideoId: ''
  };

  const requests = loadLocalRequests();
  requests.unshift(newRequest);
  saveLocalRequests(requests);

  const config = loadSheetConfig();
  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    try {
      const auth = getGoogleAuth();
      if (auth) {
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range: 'Request Lagu!A2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              newRequest.id,
              newRequest.timestamp,
              newRequest.studentName,
              newRequest.className,
              newRequest.songTitle,
              newRequest.artist,
              newRequest.targetPerson,
              newRequest.message,
              newRequest.mood,
              newRequest.coverUrl,
              newRequest.previewUrl,
              newRequest.status,
              newRequest.likes,
              newRequest.youtubeVideoId
            ]]
          }
        });
        
        config.lastSyncedAt = new Date().toISOString();
        saveSheetConfig(config);
      }
    } catch (err: any) {
      console.log('Error appending to Google Sheet:', err.message);
    }
  }

  res.json({ success: true, request: newRequest });
});

// 5. Update request status (DJ / Admin action: Queued -> Playing -> Played)
app.patch('/api/sheets/status', async (req, res) => {
  const { requestId, status } = req.body;
  const requests = loadLocalRequests();

  const reqIndex = requests.findIndex((r: any) => r.id === requestId);
  if (reqIndex === -1) {
    return res.status(404).json({ error: 'Request tidak ditemukan' });
  }

  // If status is "Playing", demote other "Playing" songs to "Played" or "Queued"
  if (status === 'Playing') {
    requests.forEach((r: any) => {
      if (r.status === 'Playing') r.status = 'Played';
    });
  }

  requests[reqIndex].status = status;
  saveLocalRequests(requests);

  const config = loadSheetConfig();
  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    try {
      const auth = getGoogleAuth();
      if (auth) {
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Find row or rewrite sheet
        const sheetRowIndex = requests[reqIndex].sheetRowIndex || (reqIndex + 2);
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `Request Lagu!L${sheetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[status]]
          }
        });
      }
    } catch (e: any) {
      console.log('Error updating status in Sheet:', e.message);
    }
  }

  res.json({ success: true, requests });
});

// 5b. Update request YouTube Video ID (Admin / DJ action)
app.patch('/api/sheets/youtube', async (req, res) => {
  const { requestId, youtubeVideoId } = req.body;
  const requests = loadLocalRequests();

  const reqIndex = requests.findIndex((r: any) => r.id === requestId);
  if (reqIndex === -1) {
    return res.status(404).json({ error: 'Request tidak ditemukan' });
  }

  requests[reqIndex].youtubeVideoId = youtubeVideoId || '';
  saveLocalRequests(requests);

  const config = loadSheetConfig();
  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    try {
      const auth = getGoogleAuth();
      if (auth) {
        const sheets = google.sheets({ version: 'v4', auth });
        
        const sheetRowIndex = requests[reqIndex].sheetRowIndex || (reqIndex + 2);
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `Request Lagu!N${sheetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[youtubeVideoId || '']]
          }
        });
      }
    } catch (e: any) {
      console.log('Error updating youtubeVideoId in Sheet:', e.message);
    }
  }

  res.json({ success: true, requests });
});

// 6. Like / Vibe Reaction endpoint
app.post('/api/sheets/like', async (req, res) => {
  const { requestId } = req.body;
  const requests = loadLocalRequests();

  const item = requests.find((r: any) => r.id === requestId);
  if (item) {
    item.likes = (item.likes || 0) + 1;
    saveLocalRequests(requests);
    return res.json({ success: true, likes: item.likes });
  }
  res.status(404).json({ error: 'Request not found' });
});

// 6b. Delete a single request by ID (Admin DJ action)
app.delete('/api/sheets/request/:id', async (req, res) => {
  const requestId = req.params.id;
  let requests = loadLocalRequests();

  const filtered = requests.filter((r: any) => r.id !== requestId);
  saveLocalRequests(filtered);

  // Track in deleted_ids
  const deletedInfo = loadDeletedData();
  if (!deletedInfo.ids.includes(requestId)) {
    deletedInfo.ids.push(requestId);
    saveDeletedData(deletedInfo);
  }

  // Update Google Sheet if connected
  const config = loadSheetConfig();
  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    await overwriteSheetRows(config.spreadsheetId, filtered);
  }

  res.json({ success: true, requests: filtered });
});

// 6c. Clear all request history (Admin DJ action)
app.delete('/api/sheets/requests/clear-all', async (req, res) => {
  const currentRequests = loadLocalRequests();
  const deletedInfo = loadDeletedData();

  currentRequests.forEach((r: any) => {
    if (r.id && !deletedInfo.ids.includes(r.id)) {
      deletedInfo.ids.push(r.id);
    }
  });

  deletedInfo.clearedAllAt = Date.now();
  saveDeletedData(deletedInfo);

  saveLocalRequests([]);

  const config = loadSheetConfig();
  if (config.connected && config.spreadsheetId && config.mode !== 'demo') {
    await overwriteSheetRows(config.spreadsheetId, []);
  }

  res.json({ success: true, requests: [] });
});

// 6d. Radio Host / Penyiar Profile endpoints
app.get('/api/radio-host', (req, res) => {
  const hosts = loadRadioHosts();
  res.json({ hosts, host: hosts[0] });
});

app.post('/api/radio-host', (req, res) => {
  const { hosts, name, tagline, photoUrl, instagram, isOnAir } = req.body;
  
  if (Array.isArray(hosts) && hosts.length > 0) {
    const updatedHosts = hosts.map((h: any, idx: number) => ({
      id: h.id || `host-${idx + 1}`,
      name: typeof h.name === 'string' ? h.name.trim() : '',
      tagline: typeof h.tagline === 'string' ? h.tagline.trim() : '',
      photoUrl: (h.photoUrl && typeof h.photoUrl === 'string' ? h.photoUrl.trim() : '') || DEFAULT_HOSTS[idx % 2].photoUrl,
      instagram: typeof h.instagram === 'string' ? h.instagram.trim() : '',
      isOnAir: typeof h.isOnAir === 'boolean' ? h.isOnAir : false
    }));
    while (updatedHosts.length < 2) {
      updatedHosts.push({
        id: `host-${updatedHosts.length + 1}`,
        name: '',
        tagline: '',
        photoUrl: DEFAULT_HOSTS[1].photoUrl,
        instagram: '',
        isOnAir: false
      });
    }
    saveRadioHosts(updatedHosts);
    return res.json({ success: true, hosts: updatedHosts, host: updatedHosts[0] });
  }

  // Single host fallback update
  const existing = loadRadioHosts();
  const updated: RadioHostData = {
    id: existing[0]?.id || 'host-1',
    name: typeof name === 'string' ? name.trim() : '',
    tagline: typeof tagline === 'string' ? tagline.trim() : '',
    photoUrl: (photoUrl && typeof photoUrl === 'string' ? photoUrl.trim() : '') || DEFAULT_HOSTS[0].photoUrl,
    instagram: typeof instagram === 'string' ? instagram.trim() : '',
    isOnAir: typeof isOnAir === 'boolean' ? isOnAir : false
  };

  const newHosts = [updated, existing[1] || DEFAULT_HOSTS[1]];
  saveRadioHosts(newHosts);
  res.json({ success: true, hosts: newHosts, host: updated });
});


// 7. Song Search Proxy (via iTunes Public API for artwork & 30s preview)
app.get('/api/song-search', async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.trim().length === 0) {
    return res.json({ results: [] });
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.json({ results: [] });
    }
    const data: any = await response.json();
    const tracks = (data.results || []).map((t: any) => ({
      trackId: t.trackId,
      trackName: t.trackName,
      artistName: t.artistName,
      collectionName: t.collectionName,
      artworkUrl100: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      previewUrl: t.previewUrl || '',
      primaryGenreName: t.primaryGenreName
    }));

    res.json({ results: tracks });
  } catch (err: any) {
    console.log('iTunes search error:', err.message);
    res.json({ results: [] });
  }
});

// Admin Server-Side PIN Verification and Supabase Admin Session generation
app.post('/api/admin/verify-pin', async (req, res) => {
  const { pin } = req.body;
  const serverAdminPin = (process.env.ADMIN_PIN || '1902').trim();

  if (!pin || typeof pin !== 'string' || pin.trim() !== serverAdminPin) {
    return res.status(401).json({
      success: false,
      error: 'Tidak dapat masuk. PIN salah.'
    });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@emkaradio.sch.id').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || 'emkaradio1902').trim();

  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (!error && data?.session) {
        return res.json({
          success: true,
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          },
          user: data.user
        });
      }
    } catch (err: any) {
      console.warn('[SERVER ADMIN AUTH] Sign in error:', err?.message);
    }
  }

  return res.json({
    success: true,
    email: adminEmail,
    password: adminPassword
  });
});

// 8. Gemini AI Vibe Check & Wingman
app.post('/api/gemini/vibe-check', async (req, res) => {
  const { songTitle, artist, targetPerson, message } = req.body;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        romanceScore: 88,
        vibeCategory: 'Bikin Baper Maksimal! 💖',
        recommendation: 'Lagu ini cocok banget diputar pas jam istirahat kedua biar si doi makin notice!',
        storyCaption: `🎶 ${songTitle} - ${artist} | "Special request for ${targetPerson} ✨"`,
        suggestedEmoji: '🔥'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analisis request lagu & pesan confession sekolah anak Gen Z ini secara fun, kekinian, estetik, dan cerdas:
Lagu: "${songTitle}" oleh "${artist}"
Ditujukan untuk: "${targetPerson}"
Pesan Confession: "${message}"

Berikan respon JSON murni tanpa markdown formatting dalam bahasa Indonesia gaul/Gen Z (santai, baper, relatable, pake emoji kekinian):
{
  "romanceScore": number antara 50 sampai 100,
  "vibeCategory": string judul kategori vibe (misal: "Bapeer Tingkat Dewa 💘", "Kode Keras 🚨", "Galau Sadboi Aesthetic 🌙", "Friendzone Survivor ☕"),
  "recommendation": string 1-2 kalimat saran waktu / cara muter lagu yang pas di radio sekolah,
  "storyCaption": string 1 kalimat aesthetic caption story Instagram/TikTok untuk request ini,
  "suggestedEmoji": string 1-2 emoji terpintar
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (err: any) {
    console.log('Gemini vibe check error:', err.message);
    res.json({
      romanceScore: 92,
      vibeCategory: 'Kode Keras Gen Z 💘',
      recommendation: 'Putar pas jam istirahat biar seangkatan langsung paham kodenya!',
      storyCaption: `✨ ${songTitle} - ${artist} for ${targetPerson} ✨`,
      suggestedEmoji: '💌'
    });
  }
});

function serverDecodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

function serverNormalizeText(text: string): string {
  return serverDecodeHtmlEntities(text || '')
    .replace(/[^\w\s'’]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreYouTubeCandidate(item: any, cleanTitle: string, cleanArtist: string): number {
  if (!item) return 0;
  const rawId = item.videoId || item.id?.videoId || (typeof item.id === 'string' ? item.id : null);
  if (!rawId || typeof rawId !== 'string' || rawId.trim().length !== 11) return 0;

  const videoTitle = serverDecodeHtmlEntities(item.title || item.snippet?.title || '').toLowerCase();
  const channelTitle = serverDecodeHtmlEntities(item.channelTitle || item.snippet?.channelTitle || '').toLowerCase();
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerArtist = cleanArtist.toLowerCase();

  let score = 10;
  if (lowerTitle && videoTitle.includes(lowerTitle)) score += 40;
  if (lowerArtist && (videoTitle.includes(lowerArtist) || channelTitle.includes(lowerArtist))) score += 30;
  if (videoTitle.includes('official music video') || videoTitle.includes('official video') || videoTitle.includes('official audio') || videoTitle.includes('official lyric video') || videoTitle.includes('mv')) score += 15;
  if (channelTitle.includes('topic') || channelTitle.includes('official') || channelTitle.includes('vevo')) score += 15;

  // Penalize unwanted video types if not requested in original title
  const unwanted = ['cover', 'karaoke', 'reaction', 'remix', 'live', 'sped up', 'slowed', 'nightcore', 'instrumental', 'playlist', 'mashup', 'full album'];
  for (const word of unwanted) {
    if (!lowerTitle.includes(word) && videoTitle.includes(word)) {
      score -= 35;
    }
  }

  return score;
}

// Official YouTube Data API v3 Video Search for Track Matching ONLY
async function searchYouTubeOfficial(query: string, rawTitle: string = '', rawArtist: string = ''): Promise<{ videoId: string | null; items: any[]; success: boolean; error?: string; message?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  const cleanT = serverNormalizeText(rawTitle);
  const cleanA = serverNormalizeText(rawArtist);
  const cleanQ = `"${cleanT}" "${cleanA}"`.trim() || serverNormalizeText(query);

  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanQ)}&type=video&videoEmbeddable=true&maxResults=6&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: any = await res.json();
        const rawItems = (data.items || []).map((item: any) => ({
          videoId: item.id?.videoId || '',
          title: serverDecodeHtmlEntities(item.snippet?.title || ''),
          artist: serverDecodeHtmlEntities(item.snippet?.channelTitle || ''),
          channelTitle: serverDecodeHtmlEntities(item.snippet?.channelTitle || ''),
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
        })).filter((i: any) => i.videoId && i.videoId.length === 11);

        if (rawItems.length > 0) {
          const scored = rawItems.map((item: any) => ({
            item,
            score: scoreYouTubeCandidate(item, cleanT, cleanA)
          })).sort((a: any, b: any) => b.score - a.score);

          const best = scored[0];
          // Strict verification: Require at least score 35 (valid title/artist match)
          if (best && best.score >= 35) {
            console.log(`[YOUTUBE MATCH] query: "${cleanQ}", videoId: ${best.item.videoId}, matchedTitle: "${best.item.title}", matchedArtist: "${best.item.artist}"`);
            return { success: true, videoId: best.item.videoId, items: scored.map(s => s.item) };
          }
        }
        console.warn(`[YOUTUBE MATCH] No sufficient title/artist match found for: "${cleanQ}"`);
        return { success: false, videoId: null, items: [], error: 'YOUTUBE_MATCH_NOT_FOUND', message: `Video YouTube yang sesuai tidak ditemukan.` };
      } else {
        const status = res.status;
        const errText = await res.text();
        console.warn('[YouTube Data API v3] Status:', status, errText.slice(0, 200));
        if (status === 403 || status === 429 || errText.includes('quotaExceeded')) {
          return { success: false, videoId: null, items: [], error: 'YOUTUBE_QUOTA_EXCEEDED', message: 'Video YouTube belum dapat dicocokkan saat ini. Silakan coba lagi nanti.' };
        }
      }
    } catch (err: any) {
      console.error('[YouTube Data API v3] Search request failed:', err.message);
    }
  } else {
    console.log('[YouTube Data API v3] API key not configured on server');
  }

  return { success: false, videoId: null, items: [], error: 'YOUTUBE_MATCH_NOT_FOUND', message: 'Video YouTube yang sesuai tidak ditemukan.' };
}

// YouTube Match Function Handler (Supports both Edge Function path & API path)
const handleYoutubeMatchRequest = async (req: express.Request, res: express.Response) => {
  const title = (req.body?.title || req.body?.trackName || req.query?.title || req.query?.trackName || req.query?.q || '') as string;
  const artist = (req.body?.artist || req.body?.artistName || req.query?.artist || req.query?.artistName || '') as string;
  const query = (req.query.q as string) || `${title} ${artist}`;

  if (!query || query.trim().length === 0) {
    return res.json({ success: false, videoId: null, items: [], error: 'QUERY_EMPTY' });
  }

  try {
    const result = await searchYouTubeOfficial(query, title, artist);
    res.json(result);
  } catch (err: any) {
    console.error('API youtube match error:', err.message);
    res.json({ success: false, videoId: null, items: [], error: 'INTERNAL_ERROR' });
  }
};

app.get('/functions/v1/youtube-match', handleYoutubeMatchRequest);
app.post('/functions/v1/youtube-match', handleYoutubeMatchRequest);
app.get('/api/youtube/search', handleYoutubeMatchRequest);
app.post('/api/youtube/search', handleYoutubeMatchRequest);

// 7c. Live Radio State sync endpoints (Admin = write, User = read)
app.get('/api/live-state', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(loadLiveState());
});

app.post('/api/live-state', (req, res) => {
  const newState = req.body;
  const currentState = loadLiveState();

  // Validate sequence (only process if newer or if sequence is 0/reset)
  if (newState.sequence !== undefined && newState.sequence <= currentState.sequence && newState.sequence !== 0) {
    return res.json({ success: false, ignored: true, currentSequence: currentState.sequence });
  }

  const merged: LiveRadioState = {
    videoId: newState.videoId !== undefined ? newState.videoId : currentState.videoId,
    trackId: newState.trackId !== undefined ? newState.trackId : currentState.trackId,
    songTitle: newState.songTitle !== undefined ? newState.songTitle : currentState.songTitle,
    artist: newState.artist !== undefined ? newState.artist : currentState.artist,
    artworkUrl: newState.artworkUrl !== undefined ? newState.artworkUrl : currentState.artworkUrl,
    status: newState.status !== undefined ? newState.status : currentState.status,
    position: newState.position !== undefined ? newState.position : currentState.position,
    updatedAt: newState.updatedAt !== undefined ? newState.updatedAt : Date.now(),
    queueIndex: newState.queueIndex !== undefined ? newState.queueIndex : currentState.queueIndex,
    sequence: newState.sequence !== undefined ? newState.sequence : (currentState.sequence + 1)
  };

  saveLiveState(merged);
  res.json({ success: true, state: merged });
});

// Vite Development or Express Production Static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 Gen Z Radio Request App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
