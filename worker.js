import { Innertube } from 'youtubei.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
  });
}

function extractVideoId(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
  if (parsed.pathname === '/watch') return parsed.searchParams.get('v');

  const [route, id] = parsed.pathname.split('/').filter(Boolean);
  return ['shorts', 'embed'].includes(route) ? (id || null) : null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed. Use GET.' }, 405);
    }

    const requestUrl = new URL(request.url);
    const youtubeUrl = requestUrl.searchParams.get('url');
    if (!youtubeUrl) {
      return json({
        error: 'Missing required query parameter: url',
        usage: '/?url=https://www.youtube.com/watch?v=VIDEO_ID&quality=720p',
        supported_urls: ['youtu.be', 'youtube.com/watch', 'youtube.com/shorts', 'youtube.com/embed'],
        supported_quality: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p', 'best'],
      }, 400);
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return json({ error: 'Invalid or unsupported YouTube URL.' }, 400);

    const quality = requestUrl.searchParams.get('quality') || '360p';
    const allowedQualities = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p', 'best'];
    if (!allowedQualities.includes(quality)) {
      return json({ error: 'Unsupported quality.', allowed: allowedQualities }, 400);
    }

    try {
      const youtube = await Innertube.create({ generate_session_locally: true });
      const info = await youtube.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      const format = info.chooseFormat({
        type: 'video+audio',
        quality,
        format: 'mp4',
      });

      if (!format) throw new Error(`No combined MP4 format found for ${quality}.`);

      const resolved = typeof format.decipher === 'function'
        ? await format.decipher(youtube.session.player)
        : format;
      const directUrl = resolved.url || format.url;
      if (!directUrl) throw new Error('Could not resolve the direct media URL.');

      return new Response(null, {
        status: 302,
        headers: { ...CORS_HEADERS, location: directUrl, 'cache-control': 'no-store' },
      });
    } catch (error) {
      console.error('YouTube URL resolution failed:', error);
      return json({
        error: 'Unable to resolve a direct video URL.',
        details: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  },
};
