// vc238 검증 — 경계 장식(rea:edge:*)과 영프편 테마 날씨가 실제 씬에 생성되는지 확인.
// 기존 verify-rea-runtime.mjs 와 같은 격리 프로필/로비 생성 흐름을 재사용한다.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.env.QA_OUT ?? '/root/.hermes/cache/scratch/qa-vc238';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const results = { stages: [] };
try {
  await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('button', { hasText: '게임 시작' }).first().click({ timeout: 120000 });
  await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
  await page.locator('input').first().fill(`검증${String(Date.now()).slice(-5)}`);
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    for (const obj of [...s.children.list]) if (obj.text === '건너뛰기') obj.emit('pointerdown');
    s.tutorialDone = true;
    s.tutStep = -1;
  });
  const transition = async stage => {
    await page.evaluate(stage => window.__SERTZ_SCENE__.startTransition(stage), stage);
    await page.waitForFunction(stage => {
      const s = window.__SERTZ_SCENE__;
      return s?.stageDef?.key === stage && s.player && !s.transitioning;
    }, stage, { timeout: 30000 });
    await page.waitForTimeout(900); // 날씨/장식 생성 안정화
  };

  for (const stage of ['howlrstone1x1', 'howlrstone1x2', 'howlrstone3x1', 'howlrstone6x1', 'howlrstone10x1', 'howlrstone13x1']) {
    await transition(stage);
    const info = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const list = s.children.list;
      const edge = list.filter(o => typeof o.name === 'string' && o.name.startsWith('rea:edge:'));
      const props = list.filter(o => typeof o.name === 'string' && o.name.startsWith('rea:prop:'));
      const emitters = list.filter(o => o.type === 'ParticleEmitter' || (o.emitParticle && o.frequency !== undefined));
      // 날씨 emitter: depth 54 근처 + 파티클 설정 보유
      const weather = emitters.filter(o => o.depth === 54);
      return {
        edges: edge.length,
        edgeKeys: [...new Set(edge.map(o => o.key))],
        edgeColliders: edge.filter(o => o.getData && o.getData('footCollider')).length,
        props: props.length,
        weatherEmitters: weather.length,
        weatherTints: [...new Set(weather.map(o => o.tintTopLeft ?? o.particleTint ?? null))],
        playerOnGround: !!s.player,
        tileLayers: list.filter(o => typeof o.name === 'string' && o.name.startsWith('rea:')).map(o => o.name),
      };
    });
    results.stages.push({ stage, ...info });
    await page.screenshot({ path: path.join(out, `${stage}.png`) });
  }
  results.pageErrors = pageErrors;
  results.consoleErrors = consoleErrors.slice(0, 5);
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
