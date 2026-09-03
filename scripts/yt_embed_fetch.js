// Fetch YouTube player data via youtube-nocookie.com embed (bypasses watch-page block)
// Usage: node yt_embed_fetch.js <videoId>
// - intercepts /youtubei/v1/player responses (streamingData)
// - records googlevideo media request URLs
// - saves result JSON for downstream ffmpeg pipeline
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/home/z/my-project/tmp/music';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const vid = process.argv[2] || 'SgmbEs86h94';
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  const playerResponses = [];
  const mediaUrls = [];

  page.on('response', async (r) => {
    const url = r.url();
    try {
      if (url.includes('/youtubei/v1/player')) {
        const j = await r.json();
        if (j && (j.streamingData || j.playabilityStatus)) {
          playerResponses.push({ url, body: j });
        }
      }
    } catch {}
    if (url.includes('googlevideo.com/videoplayback')) mediaUrls.push(url);
  });

  await page.goto(`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&hl=ko&rel=0`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForTimeout(9000);

  // click play if not started
  const st1 = await page.evaluate(() => {
    const p = document.getElementById('movie_player');
    try { return p ? p.getPlayerState() : 'no-player'; } catch { return 'err'; }
  }).catch(() => 'eval-err');
  if (st1 === 'no-player' || st1 === -1 || st1 === 5) {
    const btn = await page.$('.ytp-large-play-button, button[aria-label*="재생"], button[aria-label*="Play"]');
    if (btn) await btn.click().catch(() => {});
    await page.waitForTimeout(6000);
  }
  const st2 = await page.evaluate(() => {
    const p = document.getElementById('movie_player');
    try { return p ? p.getPlayerState() : 'no-player'; } catch { return 'err'; }
  }).catch(() => 'eval-err');

  // choose best player response (one with streamingData + adaptiveFormats)
  let best = null;
  for (const pr of playerResponses) {
    const sd = pr.body.streamingData;
    if (sd && (sd.adaptiveFormats || sd.serverAbrStreamingUrl)) {
      if (!best || ((sd.adaptiveFormats || []).length > ((best.body.streamingData.adaptiveFormats || []).length))) best = pr;
    }
  }
  const out = {
    vid,
    playerStates: [st1, st2],
    playerResponseCount: playerResponses.length,
    mediaUrlCount: mediaUrls.length,
    playability: playerResponses.map((p) => p.body.playabilityStatus && p.body.playabilityStatus.status).filter(Boolean),
  };
  if (best) {
    const sd = best.body.streamingData;
    const afs = sd.adaptiveFormats || [];
    const audio = afs.filter((f) => (f.mimeType || '').startsWith('audio/'));
    out.audioFormats = audio.map((f) => ({ itag: f.itag, mime: (f.mimeType || '').split(';')[0], bitrate: f.bitrate, hasUrl: !!f.url, clength: f.contentLength }));
    out.hasServerAbr = !!sd.serverAbrStreamingUrl;
    out.title = best.body.videoDetails && best.body.videoDetails.title;
    out.duration = best.body.videoDetails && best.body.videoDetails.lengthSeconds;
    out.descriptionHead = ((best.body.videoDetails && best.body.videoDetails.shortDescription) || '').slice(0, 1200);
    fs.writeFileSync(path.join(OUT, `${vid}_player.json`), JSON.stringify(best.body, null, 1));
  }
  if (mediaUrls.length) fs.writeFileSync(path.join(OUT, `${vid}_mediaurls.json`), JSON.stringify(mediaUrls, null, 1));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
