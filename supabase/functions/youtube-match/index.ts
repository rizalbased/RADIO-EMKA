// Supabase Edge Function: youtube-match
// Endpoint: /functions/v1/youtube-match
// Secret: YOUTUBE_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function decodeHtmlEntities(str: string): string {
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

function normalizeText(text: string): string {
  return decodeHtmlEntities(text || '')
    .replace(/[^\w\s'’]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCandidate(item: any, cleanTitle: string, cleanArtist: string): number {
  if (!item || !item.id?.videoId) return 0;
  const videoTitle = decodeHtmlEntities(item.snippet?.title || '').toLowerCase();
  const channelTitle = decodeHtmlEntities(item.snippet?.channelTitle || '').toLowerCase();
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerArtist = cleanArtist.toLowerCase();

  let score = 10; // Base score for valid videoId

  // 1. Title match
  if (lowerTitle && videoTitle.includes(lowerTitle)) {
    score += 40;
  } else if (lowerTitle) {
    const titleWords = lowerTitle.split(/\s+/).filter((w: string) => w.length > 2);
    let matchedWords = 0;
    for (const w of titleWords) {
      if (videoTitle.includes(w)) matchedWords++;
    }
    if (titleWords.length > 0 && matchedWords / titleWords.length >= 0.6) {
      score += 25;
    }
  }

  // 2. Artist match in video title or channel title
  if (lowerArtist && (videoTitle.includes(lowerArtist) || channelTitle.includes(lowerArtist))) {
    score += 30;
  } else if (lowerArtist) {
    const artistWords = lowerArtist.split(/\s+/).filter((w: string) => w.length > 2);
    let matchedArtistWords = 0;
    for (const w of artistWords) {
      if (videoTitle.includes(w) || channelTitle.includes(w)) matchedArtistWords++;
    }
    if (artistWords.length > 0 && matchedArtistWords / artistWords.length >= 0.5) {
      score += 15;
    }
  }

  // 3. Official video / Audio / MV markers
  if (
    videoTitle.includes('official music video') ||
    videoTitle.includes('official video') ||
    videoTitle.includes('official audio') ||
    videoTitle.includes('official lyric video') ||
    videoTitle.includes('lyric video') ||
    videoTitle.includes('mv')
  ) {
    score += 15;
  }

  // 4. Topic channel or Official Artist Channel
  if (channelTitle.includes('topic') || channelTitle.includes('official') || channelTitle.includes('vevo')) {
    score += 15;
  }

  // 5. Penalties for non-original / undesired content
  if (!lowerTitle.includes('cover') && videoTitle.includes('cover')) {
    score -= 30;
  }
  if (!lowerTitle.includes('karaoke') && videoTitle.includes('karaoke')) {
    score -= 30;
  }
  if (!lowerTitle.includes('reaction') && videoTitle.includes('reaction')) {
    score -= 30;
  }
  if (!lowerTitle.includes('instrumental') && videoTitle.includes('instrumental')) {
    score -= 30;
  }
  if (!lowerTitle.includes('remix') && videoTitle.includes('remix')) {
    score -= 20;
  }
  if (videoTitle.includes('parodi') || videoTitle.includes('parody')) {
    score -= 40;
  }

  return score;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    let title = '';
    let artist = '';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      title = body.title || body.trackName || body.songTitle || '';
      artist = body.artist || body.artistName || '';
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      title = url.searchParams.get('title') || url.searchParams.get('trackName') || url.searchParams.get('q') || '';
      artist = url.searchParams.get('artist') || url.searchParams.get('artistName') || '';
    }

    const cleanTitle = normalizeText(title);
    const cleanArtist = normalizeText(artist);
    const query = cleanArtist ? `${cleanTitle} ${cleanArtist}`.replace(/\s+/g, ' ').trim() : cleanTitle;

    console.log(`[YOUTUBE MATCH EDGE FUNCTION] Query: "${query}"`);

    if (!cleanTitle && !query) {
      return new Response(
        JSON.stringify({ success: false, error: 'QUERY_EMPTY', message: 'Judul dan artis lagu wajib diisi.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('[YOUTUBE MATCH EDGE FUNCTION] YOUTUBE_API_KEY secret is missing in Supabase Edge Function environment');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'YOUTUBE_API_KEY_MISSING',
          message: 'Secret YOUTUBE_API_KEY belum dikonfigurasi pada Supabase Edge Function.'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=8&key=${apiKey}`;
    const ytRes = await fetch(ytUrl);

    if (!ytRes.ok) {
      const status = ytRes.status;
      const errText = await ytRes.text();
      console.warn(`[YOUTUBE MATCH EDGE FUNCTION] YouTube API Error Status: ${status}`, errText.slice(0, 200));

      if (status === 400 || status === 401 || errText.includes('keyInvalid') || errText.includes('API key not valid')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'YOUTUBE_AUTH_ERROR',
            message: 'Secret YOUTUBE_API_KEY di Supabase Edge Function tidak valid.'
          }),
          { status: 401, headers: corsHeaders }
        );
      }

      if (status === 403 || status === 429 || errText.includes('quotaExceeded')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'YOUTUBE_QUOTA_EXCEEDED',
            message: 'Kuota pencarian YouTube API pada server sedang habis.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'YOUTUBE_API_ERROR',
          message: `Gagal memanggil YouTube API (Status ${status}).`
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const ytData = await ytRes.json();
    const items = ytData.items || [];

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_MATCH',
          message: `Video YouTube yang sesuai tidak ditemukan untuk "${query}".`
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Score candidates and choose best match
    const scored = items.map((item: any) => ({
      item,
      score: scoreCandidate(item, cleanTitle, cleanArtist)
    })).sort((a: any, b: any) => b.score - a.score);

    const best = scored[0];

    if (!best || best.score < 25 || !best.item?.id?.videoId) {
      console.log(`[YOUTUBE MATCH EDGE FUNCTION] Best candidate score too low (${best?.score || 0}) for "${query}"`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_MATCH',
          message: `Video YouTube yang sesuai tidak ditemukan untuk "${query}".`
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const bestItem = best.item;
    const videoId = bestItem.id.videoId;
    const videoTitle = decodeHtmlEntities(bestItem.snippet?.title || cleanTitle);
    const channelTitle = decodeHtmlEntities(bestItem.snippet?.channelTitle || cleanArtist);
    const thumbnailUrl = bestItem.snippet?.thumbnails?.high?.url || bestItem.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    console.log(`[YOUTUBE MATCH EDGE FUNCTION] Matched videoId: ${videoId} (score: ${best.score}) for "${query}"`);

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: videoTitle,
        channelTitle,
        thumbnailUrl,
        matchScore: best.score,
        score: best.score
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error('[YOUTUBE MATCH EDGE FUNCTION] Error:', err.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_ERROR',
        message: err.message || 'Terjadi kesalahan internal pada Edge Function.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
