import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 8 } = await req.json().catch(() => ({}));

    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "EMPTY_QUERY",
          message: "Masukkan judul lagu atau nama artis.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "CONFIG_ERROR",
          message: "YOUTUBE_API_KEY belum dikonfigurasi di Supabase secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanQ = query.trim();
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(cleanQ)}&maxResults=${maxResults}&key=${apiKey}`;

    const ytRes = await fetch(ytUrl);
    const data = await ytRes.json();

    if (!ytRes.ok) {
      const errReason = data.error?.errors?.[0]?.reason || "";
      const isQuota = ytRes.status === 429 ||
        data.error?.status === "RESOURCE_EXHAUSTED" ||
        errReason === "rateLimitExceeded" ||
        errReason === "quotaExceeded";

      if (isQuota) {
        return new Response(
          JSON.stringify({
            success: false,
            code: "YOUTUBE_QUOTA_EXCEEDED",
            message: "Kuota pencarian YouTube sedang habis.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          code: "YOUTUBE_API_ERROR",
          message: "Pencarian YouTube sedang mengalami gangguan.",
        }),
        {
          status: ytRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const items = (data.items || [])
      .map((item: any) => ({
        videoId: item.id?.videoId || "",
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
      }))
      .filter((item: any) => item.videoId && item.videoId.length === 11);

    return new Response(
      JSON.stringify({
        success: true,
        items,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        code: "SERVER_ERROR",
        message: "Terjadi kesalahan internal server.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
