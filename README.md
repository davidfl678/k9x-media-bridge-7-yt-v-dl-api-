# youtube-redirect-api

Stateless Cloudflare Worker that resolves a YouTube URL to a direct combined video+audio MP4 URL using `youtubei.js` and responds with a 302 redirect. It does not use KV, R2, or any storage, and does not proxy video bytes.

## Usage

```text
GET /?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID&quality=720p
```

`quality` defaults to `360p`. Supported values: `144p`, `240p`, `360p`, `480p`, `720p`, `1080p`, `1440p`, `2160p`, `best`.

Accepted YouTube URL forms: `youtu.be`, `youtube.com/watch`, `/shorts/`, and `/embed/`. Missing URL and invalid input return JSON errors. CORS is enabled for all origins, including OPTIONS preflight.

## Develop and deploy

```sh
npm install
npm run dev
npm run deploy
```

`youtubei.js` is set to `latest`; install with `npm install` to resolve the current published version and commit the generated lockfile for reproducible deployments. Direct media URLs are temporary, and availability/format selection depends on YouTube and youtubei.js behavior. Use only in compliance with applicable terms and law.
