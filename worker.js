export default {
  async fetch(request) {
    const u = new URL(request.url);
    const ytUrl = u.searchParams.get('url');
    const quality = u.searchParams.get('quality') || '720';
    if (!ytUrl) return new Response(JSON.stringify({usage:"/?url=https://youtu.be/ID"}), {headers:{"content-type":"application/json","Access-Control-Allow-Origin":"*"}});
    
    const payload = { url: ytUrl, vQuality: quality.replace('p',''), filenamePattern: "basic", isNoTTWatermark: true };

    const cobaltApis = [
      "https://api.cobalt.tools/api/json",
      "https://cobalt-api.kavin.rocks/api/json",
      "https://api.co.wuk.sh/api/json"
    ];

    for (let api of cobaltApis) {
      try {
        const r = await fetch(api, {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!r.ok) continue;
        const j = await r.json();
        if (j.url) return Response.redirect(j.url, 302);
      } catch(e) { continue; }
    }
    return new Response(JSON.stringify({error:"Cobalt also failed, try again"}), {status:500, headers:{"Access-Control-Allow-Origin":"*","content-type":"application/json"}});
  }
}
