// Debug: observe all network + console on nocookie embed page
const { chromium } = require('playwright');
const fs = require('fs');

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
  const requests = [];
  page.on('request', (r) => { if (r.url().includes('youtube') || r.url().includes('googlevideo')) requests.push(r.method() + ' ' + r.url().slice(0, 110)); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));

  await page.goto(`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&hl=ko`, { waitUntil: 'networkidle', timeout: 60000, referer: 'https://blog.naver.com/' }).catch((e) => console.log('goto:', e.message.slice(0, 80)));
  await page.waitForTimeout(12000);

  const info = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const player = document.getElementById('movie_player');
    let playerState = 'no-player';
    try { playerState = player ? player.getPlayerState() : 'no-player'; } catch (e) { playerState = 'err:' + e.message.slice(0, 40); }
    return {
      title: document.title.slice(0, 60),
      bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
      hasIframe: !!iframe, iframeSrc: iframe ? iframe.src.slice(0, 100) : null,
      hasPlayerEl: !!player, playerState,
    };
  }).catch((e) => ({ evalErr: e.message.slice(0, 100) }));

  console.log(JSON.stringify(info, null, 2));
  console.log('--- youtube requests (' + requests.length + '):');
  requests.slice(0, 25).forEach((r) => console.log(' ', r));
  fs.writeFileSync('/home/z/my-project/tmp/music/embed_debug_reqs.txt', requests.join('\n'));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
