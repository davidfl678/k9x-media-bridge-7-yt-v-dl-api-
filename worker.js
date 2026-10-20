const PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '19.09.37',
  androidSdkVersion: 30,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function videoIdFromUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
  if (hostname !== 'youtube.com' && !hostname.endsWith('.youtube.com')) return null;
  if (parsed.pathname === '/watch') return parsed.searchParams.get('v');

  const [route, id] = parsed.pathname.split('/').filter(Boolean);
  return ['shorts', 'embed', 'live'].includes(route) ? (id || null) : null;
}

function qualityNumber(label) {
  const match = typeof label === 'string' && label.match(/^(\d+)p$/i);
  return match ? Number(match[1]) : 0;
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed. Use GET.' }, 405);
    }

    const requestUrl = new URL(request.url);
    const youtubeUrl = requestUrl.searchParams.get('url');
    if (!youtubeUrl) {
      return json({ error: 'Missing required query parameter: url', usage: '/?url=https://www.youtube.com/watch?v=VIDEO_ID&quality=360p' }, 400);
    }

    const videoId = videoIdFromUrl(youtubeUrl);
    if (!videoId) return json({ error: 'Invalid or unsupported YouTube URL.' }, 400);

    const wantedQuality = requestUrl.searchParams.get('quality') || '360p';
    if (!/^\d+p$/i.test(wantedQuality)) {
      return json({ error: 'Invalid quality; use a value such as 360p or 720p.' }, 400);
    }

    try {
      const playerResponse = await fetch(PLAYER_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoId,
          context: { client: CLIENT },
        }),
      });

      if (!playerResponse.ok) {
        return json({ error: 'YouTube player API request failed.', status: playerResponse.status }, 502);
      }

      const player = await playerResponse.json();
      if (player.playabilityStatus?.status && player.playabilityStatus.status !== 'OK') {
        return json({
          error: 'YouTube could not provide this video.',
          status: player.playabilityStatus.status,
          reason: player.playabilityStatus.reason || null,
        }, 502);
      }

      const streaming = player.streamingData || {};
      const formats = [...(streaming.formats || []), ...(streaming.adaptiveFormats || [])]
        .filter((format) => format.mimeType?.toLowerCase().startsWith('video/mp4') && format.url);

      if (!formats.length) {
        return json({ error: 'No direct MP4 format URLs were returned by YouTube.' }, 404);
      }

      const matching = formats.filter((format) => format.qualityLabel?.toLowerCase() === wantedQuality.toLowerCase());
      const candidates = matching.length ? matching : formats;
      candidates.sort((a, b) => {
        const distanceA = Math.abs(qualityNumber(a.qualityLabel) - qualityNumber(wantedQuality));
        const distanceB = Math.abs(qualityNumber(b.qualityLabel) - qualityNumber(wantedQuality));
        return distanceA - distanceB || qualityNumber(b.qualityLabel) - qualityNumber(a.qualityLabel);
      });

      return Response.redirect(candidates[0].url, 302);
    } catch (error) {
      console.error('YouTube player request failed:', error);
      return json({ error: 'Unable to resolve a direct MP4 URL.', details: error instanceof Error ? error.message : String(error) }, 502);
    }
  },
};
