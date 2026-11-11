#!/usr/bin/env node
/**
 * CrossCode 공식 데모를 Craft CDP 세션에 붙어 관찰하기 위한 재현 스크립트.
 *
 * 전제:
 *   1) /usr/local/bin/chromium 래퍼(--no-sandbox) 가 있어야 Craft 가 브라우저를 찾는다.
 *   2) Craft MCP 세션이 살아 있어야 하고, web_site_open 으로 데모가 열려 있어야 한다.
 *   3) below EP 는 그 세션의 web_pages_list 결과 endpoint 다. 재사용하지 말고 매번 새로 얻는다.
 *
 * 사용:
 *   EP=http://127.0.0.1:PORT node scripts/crosscode-observe.mjs title
 *   EP=... node scripts/crosscode-observe.mjs enter      # 모달 닫고 New Game 진입 + 컷신 스킵
 *   EP=... node scripts/crosscode-observe.mjs state      # 현재 인게임 상태 수치 출력
 *
 * 주의: 이 스크립트는 **관찰만** 한다. CrossCode 코드/이미지/음악을 복사하지 않는다.
 */
import { chromium } from '../node_modules/playwright/index.mjs';

const EP = process.env.EP;
if (!EP) {
  console.error('EP 환경변수가 필요합니다 (Craft web_pages_list 의 endpoint).');
  process.exit(2);
}

const cmd = process.argv[2] || 'state';

const browser = await chromium.connectOverCDP(EP);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('cross-code'));
if (!page) {
  console.error('CrossCode 페이지를 찾지 못했습니다. web_site_open 먼저 실행하세요.');
  process.exit(3);
}

const readState = () =>
  page.evaluate(() => {
    const ig = window.ig;
    const t = ig?.t;
    const sys = ig?.system;
    const c = document.querySelector('#canvas');
    const r = c ? c.getBoundingClientRect() : null;
    return {
      hasShell: !!t,
      logical: sys ? { w: sys.width, h: sys.height, scale: sys.scale } : null,
      backing: c ? { w: c.width, h: c.height } : null,
      css: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
      cam: t?.screen ? { x: Math.round(t.screen.x), y: Math.round(t.screen.y) } : null,
      entities: t?.entities?.length ?? null,
      loadingAssets: t?.dJ?.Ho?.length ?? null,
      loadingBgm: t?.dJ?.vca ?? null,
    };
  });

async function closeAnnouncementAndConfirm() {
  const box = await page.locator('#canvas').boundingBox();
  if (!box) throw new Error('#canvas 없음');
  // 첫 실행 안내 모달을 닫는다 (이게 진입 막힘의 원인이었다).
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(2500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000);
}

async function skipCutscene(maxTaps = 40) {
  for (let i = 0; i < maxTaps; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
}

switch (cmd) {
  case 'title': {
    console.log(JSON.stringify(await readState(), null, 1));
    break;
  }
  case 'enter': {
    console.log('before', JSON.stringify(await readState()));
    await closeAnnouncementAndConfirm();
    await skipCutscene();
    console.log('after ', JSON.stringify(await readState()));
    await page.screenshot({ path: '/tmp/crosscode-ingame.png' });
    console.log('screenshot: /tmp/crosscode-ingame.png');
    break;
  }
  case 'state':
  default: {
    console.log(JSON.stringify(await readState(), null, 1));
    break;
  }
}

await browser.close();
