// v1.4.10 E2E — 유저 지시 8건 핵심 검증
const { chromium } = require('playwright');

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' · ' + detail : ''}`);
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (r.url().includes('bgm_boss')) errors.push('BGM-FAIL ' + r.url()); });

  // 1. 타이틀 로드
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  check('게임 로드 (페이지 에러 0)', errors.length === 0, errors[0] ?? '');

  // 2. 캔버스 부팅
  const canvas = await page.$('canvas');
  check('게임 캔버스 렌더', !!canvas);

  // 3. 버전 API
  const ver = await page.evaluate(async () => {
    const r = await fetch('/api/version');
    return await r.json();
  });
  check('/api/version 1.4.10/102', ver.latest === '1.4.10' && ver.code === 102, JSON.stringify({ latest: ver.latest, code: ver.code }));

  // 4. 신규 보스 BGM 4종 HTTP 200
  const bgms = ['bgm_boss6', 'bgm_boss7', 'bgm_boss8', 'bgm_boss9'];
  for (const b of bgms) {
    const code = await page.evaluate(async (k) => (await fetch(`/assets/audio/${k}.ogg`, { method: 'HEAD' })).status, b);
    check(`신규 보스곡 ${b}.ogg 서빙`, code === 200, `status ${code}`);
  }

  // 5. 튜토리얼 상세 설명 번들 포함 여부 (소스 코드에 새 문구가 번들됐는지)
  const hasTutText = await page.evaluate(async () => {
    // 클라이언트 JS 번들에서 튜토리얼 문구 검색
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('머리 위에 표시가 뜬 주민에게')) return true;
      } catch {}
    }
    return false;
  });
  check('튜토리얼 상세 설명 번들 포함', hasTutText);

  // 6. 힌트 문구 번들 포함
  const hasHintText = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('보스 구역! 끝까지 가면 강력한 보스가 기다린다')) return true;
        if (t.includes('HP가 위험하다!')) return true;
      } catch {}
    }
    return false;
  });
  check('컨텍스트 힌트 문구 번들 포함', hasHintText);

  // 7. 구매 수량 입력 aria-label 번들 포함
  const hasQtyInput = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('구매 수량 직접 입력')) return true;
      } catch {}
    }
    return false;
  });
  check('구매 수량 직접 입력 UI 번들 포함', hasQtyInput);

  // 8. apk-guide 갱신 확인
  const guide = await page.evaluate(async () => await (await fetch('/apk-guide.html')).text());
  check('apk-guide v1.4.10 갱신', guide.includes('v1.4.10') && guide.includes('6d94a95b9b656b248e08293ed780afa1'));

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== E2E 결과: ${pass}/${results.length} PASS ===`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
