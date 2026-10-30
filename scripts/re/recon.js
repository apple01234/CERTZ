// sertz3 / sertz4 배포본 정찰: 로드되는 에셋 목록 + 스크린샷 + 콘솔 로그
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/root/.hermes/cache/scratch/deploy';
const SITES = [
  { key: 's3', url: 'https://sertz3.space-z.ai/' },
  { key: 's4', url: 'https://sertz4.space-z.ai/' },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const report = {};

  for (const site of SITES) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const requests = [];
    const console_ = [];
    const errors = [];

    page.on('requestfinished', (req) => {
      const url = req.url();
      requests.push({ url, method: req.method() });
    });
    page.on('console', (m) => console_.push(`${m.type()}: ${m.text()}`.slice(0, 400)));
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 400)));

    try {
      await page.goto(site.url, { waitUntil: 'load', timeout: 90000 });
    } catch (e) {
      errors.push('goto: ' + e.message);
    }

    // 게임 부팅 대기
    await page.waitForTimeout(25000);

    const dir = path.join(OUT, site.key);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'title.png') });

    // 시작 버튼 탐색(캔버스 클릭 or UI 버튼)
    const canvasCount = await page.locator('canvas').count();
    const bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 1500);

    report[site.key] = {
      url: site.url,
      canvasCount,
      bodyText,
      requestCount: requests.length,
      requests,
      console: console_.slice(0, 120),
      errors,
    };

    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'recon.json'), JSON.stringify(report, null, 2));
  for (const k of ['s3', 's4']) {
    const r = report[k];
    console.log(`\n===== ${k} =====`);
    console.log('canvas:', r.canvasCount, 'reqs:', r.requestCount);
    console.log('bodyText:', JSON.stringify(r.bodyText.slice(0, 300)));
    console.log('errors:', r.errors.slice(0, 5));
    const assets = r.requests.filter((x) => /\/(assets|audio|fonts)\//.test(x.url));
    console.log('asset total:', assets.length);
    console.log(assets.slice(0, 40).map((a) => a.url).join('\n'));
  }
})();
