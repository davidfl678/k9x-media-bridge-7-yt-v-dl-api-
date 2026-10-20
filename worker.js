const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.privacy.computer',
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function extractVideoId(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');

  const [route, id] = url.pathname.split('/').filter(Boolean);
  return ['shorts', 'embed', 'live'].includes(route) ? (id || null) : null;
}

function qualityRank(stream) {
  const quality = String(stream.quality || '').toLowerCase();
  if (/720p/.test(quality)) return 0;
  if (/360p/.test(quality)) return 1;
  return 2;
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed. Use GET.' }, 405);

    const youtubeUrl = new URL(request.url).searchParams.get('url');
    if (!youtubeUrl) {
      return json({ error: 'Missing required query parameter: url', usage: '/?url=https://www.youtube.com/watch?v=VIDEO_ID' }, 400);
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return json({ error: 'Invalid or unsupported YouTube URL.' }, 400);

    const failures = [];
    for (const instance of PIPED_INSTANCES) {
      try {
        const response = await fetch(`${instance}/streams/${encodeURIComponent(videoId)}`, {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          failures.push(`${instance}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const streams = Array.isArray(data.videoStreams) ? data.videoStreams : [];
        const candidates = streams
          .filter((stream) => typeof stream.url === 'string' && /^https?:\/\//i.test(stream.url))
          .filter((stream) => /(?:360p|720p)/i.test(String(stream.quality || '')))
          .sort((a, b) => qualityRank(a) - qualityRank(b));

        if (candidates.length) return Response.redirect(candidates[0].url, 302);
        failures.push(`${instance}: no 720p or 360p video stream with a URL`);
      } catch (error) {
        failures.push(`${instance}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return json({ error: 'Could not retrieve a 720p or 360p stream from any Piped instance.', failures }, 502);
  },
};
