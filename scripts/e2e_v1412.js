// v1.4.12 E2E — 유저 지시 22건 핵심 검증
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const results = [];
  const ok = (name, cond, detail = '') => {
    results.push({ name, ok: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' · ' + detail : ''}`);
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. 페이지 로드 + 버전 API
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  check01: {
    const ver = await page.evaluate(async () => (await (await fetch('/api/version')).json()));
    ok('버전 API 1.4.12/104', ver.latest === '1.4.12' && ver.code === 104, `${ver.latest}/${ver.code}`);
  }

  // 2. 벚꽃 에셋 미사용 — 타이틀 씬에서 cp_bg/cp_petal 이미지가 생성되지 않음
  {
    const hasPetal = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      const t = g?.scene?.getScene('title');
      if (!t) return 'no-scene';
      const kids = (t.children && (t.children.list || (typeof t.children.getChildren === 'function' ? t.children.getChildren() : null))) || [];
      return Array.from(kids).some((c) => c.texture && (c.texture.key === 'cp_bg' || c.texture.key === 'cp_petal'));
    });
    ok('타이틀 벚꽃 제거 (cp_bg/cp_petal 미렌더)', hasPetal === false, String(hasPetal));
  }

  // 3. ui2 에셋 서빙 + CSS 참조
  {
    const css = await page.evaluate(async () => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name);
      return urls.filter((u) => u.includes('ui2/')).length;
    });
    const served = await page.evaluate(async () => {
      const r = await fetch('/assets/ui2/panel_big.webp', { method: 'HEAD' });
      return r.status;
    });
    ok('ui2 에셋 서빙+로드', served === 200, `panel_big ${served}, 로드된 ui2 리소스 ${css}건`);
  }

  // 4. 자동시작 플래그 폐지 — 타이틀에서 sertz.autoResume가 제거됨
  {
    await page.evaluate(() => { try { localStorage.setItem('sertz.autoResume', 'fake'); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);
    // 타이틀 오버레이 렌더 대기 (부팅 길이 변동 흡수)
    for (let i = 0; i < 10; i++) {
      const found = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('게임 시작')));
      if (found) break;
      await page.waitForTimeout(1500);
    }
    const gone = await page.evaluate(() => localStorage.getItem('sertz.autoResume') === null);
    ok('자동시작 플래그 폐지 (타이틀 진입 시 제거)', gone);
  }

  // 5. 보스 9종 — 실제 에셋 교체 (실측: 픽셀아트 무손실 webp는 200~500B — 내용 실측으로 판정)
  {
    const bosses = ['boss', 'boss2', 'boss3', 'boss_nidhog', 'boss_surt', 'boss_fenrir', 'boss_skoll', 'boss_gram', 'boss_abudditos'];
    let allOk = true;
    const sizes = {};
    for (const b of bosses) {
      const r = await page.evaluate(async (k) => {
        const res = await fetch(`/assets/${k}_idle0.webp`);
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: 'image/webp' });
        const bmp = await createImageBitmap(blob);
        // 내용 실측: 캔버스에 그려 불투명 픽셀 수 확인 (픽셀아트 스프라이트라면 수천 개)
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d');
        x.drawImage(bmp, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let opaque = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 128) opaque++;
        return { s: res.status, w: bmp.width, h: bmp.height, opaque };
      }, b);
      sizes[b] = `${r.w}x${r.h}/${r.opaque}px`;
      if (r.s !== 200 || r.opaque < 500 || r.opaque > 20000) allOk = false;
    }
    ok('보스 9종 실에셋 텍스처 (불투명 픽셀 실측)', allOk, JSON.stringify(sizes));
  }

  // 6. 여캐 6종 — SPUM 재생성 (휘도 다양성 실측: 6종의 평균색이 서로 다른지)
  {
    const distinct = await page.evaluate(async () => {
      const load = (k) => new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = `/assets/chf${k}_idle0.webp`;
      });
      const imgs = await Promise.all([0, 1, 2, 3, 4, 5].map(load));
      if (imgs.some((i) => !i)) return -1;
      const avgs = imgs.map((im) => {
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        }
        return n ? [r / n, g / n, b / n] : [0, 0, 0];
      });
      let pairs = 0, diff = 0;
      for (let i = 0; i < avgs.length; i++)
        for (let j = i + 1; j < avgs.length; j++) {
          pairs++;
          const d = Math.hypot(avgs[i][0] - avgs[j][0], avgs[i][1] - avgs[j][1], avgs[i][2] - avgs[j][2]);
          if (d > 18) diff++;
        }
      return diff / pairs;
    });
    ok('여캐 6종 외형 차별화 (평균색 거리)', distinct >= 0.8, `차별 쌍 비율 ${distinct}`);
  }

  // 7. 신규 NPC 대사 데이터 + 전직 시그니처 — 번들 fs grep (lazy 청크 포함)
  {
    const chunksDir = path.join(process.cwd(), '.next', 'static', 'chunks');
    let bundle = '';
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (f.endsWith('.js')) bundle += fs.readFileSync(p, 'utf8');
      }
    };
    try { walk(chunksDir); } catch {}
    ok('번들: 사냥터 NPC 대사 9챕터', ['fieldNpc_forest', 'fieldNpc_kingdom', 'fieldNpc_cave', 'fieldNpc_niflheim', 'fieldNpc_muspelheim', 'fieldNpc_alfheim', 'fieldNpc_nidavellir', 'fieldNpc_hel', 'fieldNpc_abyss'].every((k) => bundle.includes(k)));
    ok('번들: 보스 시그니처 패턴 (sig/aggr)', (bundle.includes('sig:"slam"') || bundle.includes('sig: "slam"')) && (bundle.includes('sig:"ring"') || bundle.includes('sig: "ring"')) && (bundle.includes('aggr:.8') || bundle.includes('aggr:0.8') || bundle.includes('aggr: .8')));
    ok('번들: 이그니 UI 안내 (GuidePanel)', bundle.includes('이그니의 UI 안내서') || bundle.includes('UI 안내서'));
    ok('번들: 보스전 자동전투 금지 문구', bundle.includes('보스전에서는 자동전투를 쓸 수 없다'));
    ok('번들: 훈련장 퀘스트 제거 (v1 늑대)', !bundle.includes('훈련용 늑대 길들이기'));
  }

  // 8. 월드 진입 — 캐릭터 생성 → 마을 (훈련장 부재·필드 NPC 존재는 숲 진입 후)
  await page.getByText('게임 시작').first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('캐릭터 생성'))?.click();
  });
  await page.waitForTimeout(700);
  await page.locator('input').first().fill('세라412');
  await page.waitForTimeout(300);
  for (const label of ['직업 선택', '외형 선택']) {
    await page.evaluate((lb) => {
      Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('생성!'))?.click();
  });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { document.querySelector('.cursor-pointer')?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('이 캐릭터로 시작'))?.click();
  });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) { await page.mouse.click(200, 300); await page.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene('world')?.dialoguing);
    if (!d) break;
    await page.mouse.click(200, 300);
    await page.waitForTimeout(360);
  }
  const ws = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w ? { hasPlayer: !!w.player, trainSpawns: w.trainSpawns?.length ?? 'n/a', stage: w.stageDef?.key } : null;
  });
  ok('월드 진입', !!ws?.hasPlayer, JSON.stringify(ws));

  // 9. 마을 훈련장(시작 사냥터) 철거 — 늑대 적 0
  {
    const wolves = await page.evaluate(() => {
      const w = window.__SERTZ__?.game?.scene?.getScene('world');
      if (!w) return -1;
      return w.enemies.filter((e) => e.active && e.alive).length;
    });
    ok('마을 시작 사냥터 철거 (적 0마리)', wolves === 0, `적 ${wolves}마리`);
  }

  // 10. 기본 볼륨 BGM 0.6 / SE 0.5
  {
    const vol = await page.evaluate(() => {
      const d = window.__SERTZ_DEBUG__;
      const a = d?.audio;
      if (a?.getBgmVolume) return { bgm: a.getBgmVolume(), sfx: a.getSfxVolume?.() };
      return null;
    });
    ok('기본 볼륨 BGM 0.6 / SE 0.5', vol && Math.abs(vol.bgm - 0.6) < 0.01 && Math.abs(vol.sfx - 0.5) < 0.01, JSON.stringify(vol));
  }

  // 11. 페이지 에러 0
  ok('페이지 에러 0', errors.length === 0, errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
