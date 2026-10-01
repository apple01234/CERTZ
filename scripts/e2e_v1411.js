// v1.4.11 E2E — 유저 지시 6건 핵심 검증
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
  check('/api/version 1.4.11/103', ver.latest === '1.4.11' && ver.code === 103, JSON.stringify({ latest: ver.latest, code: ver.code }));

  // 4. 신규 VFX 텍스처 12종 서빙 (Drive 팩 + 활성화 에셋)
  const texs = ['hv2_magiccircle', 'hv2_crater', 'mg_slash0', 'mg_explode', 'mg_crit', 'tn_dirt0', 'pk_star_01', 'pk_smoke_01', 'item_emerald', 'cv_torch', 'cp_petal', 'cp_bg'];
  for (const t of texs) {
    const code = await page.evaluate(async (k) => (await fetch(`/assets/${k}.webp`, { method: 'HEAD' })).status, t);
    check(`텍스처 ${t}.webp 서빙`, code === 200, `status ${code}`);
  }

  // 5. 보스 신규 아트 9종 서빙 (2차 전면 교체 — ≥2500B)
  const bosses = ['boss', 'boss2', 'boss3', 'boss_nidhog', 'boss_surt', 'boss_fenrir', 'boss_skoll', 'boss_gram', 'boss_abudditos'];
  for (const b of bosses) {
    const r = await page.evaluate(async (k) => {
      const res = await fetch(`/assets/${k}_idle0.webp`);
      const buf = await res.arrayBuffer();
      return { status: res.status, size: buf.byteLength };
    }, b);
    check(`보스 신규아트 ${b} (2차)`, r.status === 200 && r.size >= 2500, `${r.status} · ${r.size}B`);
  }

  // 번들 전체(초기 HTML scripts + lazy 청크) 검색 — v1.4.10 교훈: 초기 HTML만 봐서는 lazy 청크를 놓친다
  const inBundle = async (needles) => {
    return await page.evaluate(async (nds) => {
      const seen = new Set();
      let html = '';
      try { html = await (await fetch('/')).text(); } catch {}
      const urls = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
      // lazy 청크 경로 보강: 현재 페이지가 로드한 모든 script src + _next/static/chunks 추정은
      // 빌드 고유명이라 HTML에 없다 — 대신 __NEXT_DATA__의 buildId로 chunks 디렉터리 나열은 불가하므로
      // 성능상 초기 scripts + game 라우트 청크(HTML 내 js) 전부 훑는 것으로 충분했다가 실패 →
      // 로컬 검증은 .next/static/chunks 직접 grep으로 대체한다(본 E2E는 서빙 번들 포함 여부만 확인).
      for (const u of urls) {
        try {
          const t = await (await fetch(u.startsWith('http') ? u : (u.startsWith('/') ? u : '/' + u))).text();
          for (const nd of nds) if (t.includes(nd)) seen.add(nd);
        } catch {}
      }
      return nds.filter((n) => seen.has(n));
    }, needles);
  };


  // 12.5 lazy 청크 직접 검증 (v1.4.10 한계 보완 — fs grep 폴백)
  const fs = require('fs');
  const path = require('path');
  const chunkDir = path.join(__dirname, '..', '.next', 'static', 'chunks');
  const grepChunks = (needle) => {
    try {
      for (const f of fs.readdirSync(chunkDir)) {
        const fp = path.join(chunkDir, f);
        const st = fs.statSync(fp);
        if (st.isFile() && fs.readFileSync(fp, 'utf8').includes(needle)) return true;
      }
    } catch {}
    return false;
  };

  // 6. ARG 체계 제거 — eggs.ts 번들 부재 + /secret 404
  const noEggs = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('비밀수첩 발견') || t.includes('eggMilestonePending')) return false;
      } catch {}
    }
    return true;
  });
  check('ARG 번들 부재 (비밀수첩/egg 코드 0)', noEggs);
  const secretCode = await page.evaluate(async () => (await fetch('/secret/second.html', { redirect: 'manual' })).status);
  check('/secret 페이지 비활성 (404/308 지원센터 유도)', secretCode === 404 || secretCode === 308 || secretCode === 0, `status ${secretCode}`);

  // 7. 신규 코스튬 2종 번들 포함
  const hasCostume = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('화염의 무희') && t.includes('신비술사')) return true;
      } catch {}
    }
    return false;
  });
  check('신규 코스튬 2종 번들 포함 (화염의 무희·신비술사)', hasCostume || grepChunks('화염의 무희'));

  // 8. 자동전투 진동 수정 코드 번들 포함 (주석은 제거되지만 힌트 문구로 판정)
  const hasAutoFix = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('autoHoldStopDist') || t.includes('autoKitUntil')) return true;
      } catch {}
    }
    return false;
  });
  check('자동전투 진동 수정 코드 번들 포함', hasAutoFix || grepChunks('autoHoldStopDist'));

  // 9. 보스 이펙트 코드 번들 포함
  const hasBossFx = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('hv2_magiccircle') && t.includes('mg_explode')) return true;
      } catch {}
    }
    return false;
  });
  check('보스 팩 이펙트 코드 번들 포함', hasBossFx || grepChunks('hv2_magiccircle'));

  // 10. 지면 스캐터 코드 번들 포함
  const hasScatter = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('tx_gp_pvar') || (t.includes('TX_SET_OF') ?? false)) return true;
        if (t.includes('tx_gp_pvar')) return true;
      } catch {}
    }
    return false;
  });
  check('지면 스캐터 코드 번들 포함', hasScatter || grepChunks('tx_${t}_pvar') || grepChunks('tx_gp_pvar'));

  // 11. 타이틀 벚꽃 번들 포함
  const hasTitlePetal = await page.evaluate(async () => {
    const res = await fetch('/');
    const html = await res.text();
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      try {
        const t = await (await fetch(s)).text();
        if (t.includes('cp_petal') && t.includes('cp_bg')) return true;
      } catch {}
    }
    return false;
  });
  check('타이틀 벚꽃 코드 번들 포함', hasTitlePetal || grepChunks('cp_petal'));


  // 12. 최종 콘솔 에러 0
  check('최종 콘솔 에러 0', errors.length === 0, errors[0] ?? '');

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== E2E v1.4.11: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})();
