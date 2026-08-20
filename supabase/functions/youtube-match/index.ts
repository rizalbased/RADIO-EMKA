// Supabase Edge Function: youtube-match
// Endpoint: /functions/v1/youtube-match
// Secret: YOUTUBE_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

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
  }

  // 2. Artist match in video title or channel title
  if (lowerArtist && (videoTitle.includes(lowerArtist) || channelTitle.includes(lowerArtist))) {
    score += 30;
  }

  // 3. Official video / Audio / MV markers
  if (
    videoTitle.includes('official music video') ||
    videoTitle.includes('official video') ||
    videoTitle.includes('official audio') ||
    videoTitle.includes('official lyric video') ||
    videoTitle.includes('mv')
  ) {
    score += 15;
  }

  // 4. Topic channel or Official Artist Channel
  if (channelTitle.includes('topic') || channelTitle.includes('official')) {
    score += 15;
  }

  // 5. Penalties for non-original content
  if (
    (!lowerTitle.includes('cover') && videoTitle.includes('cover')) ||
    (!lowerTitle.includes('karaoke') && videoTitle.includes('karaoke')) ||
    (!lowerTitle.includes('reaction') && videoTitle.includes('reaction')) ||
    (!lowerTitle.includes('instrumental') && videoTitle.includes('instrumental'))
  ) {
    score -= 25;
  }

  return score;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const query = `${cleanTitle} ${cleanArtist}`.replace(/\s+/g, ' ').trim();

    console.log(`[YOUTUBE MATCH EDGE FUNCTION] Query: "${query}"`);

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'QUERY_EMPTY', message: 'Judul dan artis lagu wajib diisi.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('[YOUTUBE MATCH EDGE FUNCTION] YOUTUBE_API_KEY secret is missing');
      return new Response(
        JSON.stringify({ success: false, error: 'YOUTUBE_API_KEY_MISSING', message: 'Secret YOUTUBE_API_KEY belum dikonfigurasi pada Edge Function.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=6&key=${apiKey}`;
    const ytRes = await fetch(ytUrl);

    if (!ytRes.ok) {
      const status = ytRes.status;
      const errText = await ytRes.text();
      console.warn(`[YOUTUBE QUOTA] Status: ${status}`, errText.slice(0, 200));

      if (status === 403 || status === 429 || errText.includes('quotaExceeded')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'YOUTUBE_QUOTA_EXCEEDED',
            message: 'Kuota YouTube API sedang habis. Silakan coba link YouTube langsung.'
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'YOUTUBE_API_ERROR', message: `Gagal memanggil YouTube API (Status ${status}).` }),
        { status: 500, headers: corsHeaders }
      );
    }

    const ytData = await ytRes.json();
    const items = ytData.items || [];

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'YOUTUBE_MATCH_NOT_FOUND', message: `Tidak ditemukan video YouTube untuk "${query}".` }),
        { status: 444, headers: corsHeaders }
      );
    }

    // Score candidates and choose best match
    const scored = items.map((item: any) => ({
      item,
      score: scoreCandidate(item, cleanTitle, cleanArtist)
    })).sort((a: any, b: any) => b.score - a.score);

    const best = scored[0];

    if (!best || best.score < 15 || !best.item?.id?.videoId) {
      console.log(`[YOUTUBE MATCH EDGE FUNCTION] Best candidate score too low (${best?.score || 0}) for "${query}"`);
      return new Response(
        JSON.stringify({ success: false, error: 'YOUTUBE_MATCH_NOT_FOUND', message: `Hasil YouTube tidak relevan untuk "${query}".` }),
        { status: 200, headers: corsHeaders }
      );
    }

    const bestItem = best.item;
    const videoId = bestItem.id.videoId;
    const videoTitle = decodeHtmlEntities(bestItem.snippet?.title || cleanTitle);
    const channelTitle = decodeHtmlEntities(bestItem.snippet?.channelTitle || cleanArtist);
    const thumbnail = bestItem.snippet?.thumbnails?.high?.url || bestItem.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    console.log(`[YOUTUBE MATCH EDGE FUNCTION] Matched videoId: ${videoId} (score: ${best.score}) for "${query}"`);

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: videoTitle,
        channelTitle,
        thumbnail,
        score: best.score
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error('[YOUTUBE MATCH EDGE FUNCTION] Error:', err.message || err);
    return new Response(
      JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: err.message || 'Terjadi kesalahan internal.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
