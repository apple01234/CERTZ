// YouTube access probe via real headless browser
// - Detect bot wall / consent
// - Capture innertube /player response (streamingData) + googlevideo requests
// - Detect chapters presence in ytInitialData
// - Dump cookies for yt-dlp reuse
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/home/z/my-project/tmp/music';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const vid = process.argv[2] || 'SgmbEs86h94';
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--mute-audio'],
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1366, height: 850 },
  });
  const page = await ctx.newPage();
  let playerResp = null;
  const gvideoHosts = new Set();
  page.on('response', async (r) => {
    const url = r.url();
    try {
      if (url.includes('youtubei/v1/player')) {
        const j = await r.json();
        if (j && j.streamingData) playerResp = j;
      }
    } catch {}
    if (url.includes('googlevideo.com/videoplayback')) {
      try { gvideoHosts.add(new URL(url).host); } catch {}
    }
  });

  await page.goto(`https://www.youtube.com/watch?v=${vid}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  // consent dialog handling
  for (const label of ['Accept all', '모두 동의', '동의', 'Accept']) {
    const btn = await page.$(`button[aria-label*="${label}"]`);
    if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(4000); break; }
  }
  // also generic consent form submit
  try {
    const form = await page.$('form[action*="consent"] button');
    if (form) { await form.click(); await page.waitForTimeout(4000); }
  } catch {}
  await page.waitForTimeout(4000);

  const title = await page.title();
  const botWall = (await page.content()).match(/confirm you.{0,3}re not a bot|Sign in to confirm/i) ? true : false;
  const state = await page.evaluate(() => {
    const p = document.getElementById('movie_player');
    if (!p) return 'no-player';
    try { return p.getPlayerState(); } catch { return 'err'; }
  }).catch(() => 'eval-err');

  const html = await page.content();
  const hasChapters = html.includes('macroMarkersListRenderer');
  fs.writeFileSync(path.join(OUT, 'watch_page.html'), html);

  const audioFormats = [];
  if (playerResp) {
    const afs = (playerResp.streamingData && playerResp.streamingData.adaptiveFormats) || [];
    for (const f of afs) {
      if ((f.mimeType || '').startsWith('audio/')) {
        audioFormats.push({ itag: f.itag, mime: f.mimeType, bitrate: f.bitrate, hasUrl: !!f.url, urlHead: (f.url || '').slice(0, 80) });
      }
    }
    fs.writeFileSync(path.join(OUT, 'player_resp.json'), JSON.stringify(playerResp, null, 1));
  }

  const cookies = await ctx.cookies();
  fs.writeFileSync(path.join(OUT, 'cookies.json'), JSON.stringify(cookies));

  console.log(JSON.stringify({
    vid, title: title.slice(0, 70), botWall, playerState: state,
    hasChapters, gvideoHosts: [...gvideoHosts],
    hasStreamingData: !!playerResp, audioFormatCount: audioFormats.length,
    audioFormats: audioFormats.slice(0, 6),
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
