// 튜토리얼 패널 — 크기 축소 / 컷씬 자동 숨김 / 리스너 누수 방지
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/tutorial-panel-hide.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/game/Tutorial.ts"), "utf8");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const code = codeOnly(SRC);

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };
const eq = (n, a, b) => { assert.deepEqual(a, b, `✗ ${n}`); checks++; };

/* ═══ 1. 패널 크기 — "게임 화면을 필요 이상으로 덮지 않는다" (요구사항 6.3) ═══ */
{
  const w = Number((code.match(/const PANEL_W\s*=\s*(\d+)/) ?? [])[1]);
  const h = Number((code.match(/const PANEL_H\s*=\s*(\d+)/) ?? [])[1]);
  ok("PANEL_W 를 수치로 읽었다", Number.isFinite(w) && w > 0);
  ok("PANEL_H 를 수치로 읽었다", Number.isFinite(h) && h > 0);
  /* 종전 520×96 에서 축소. 상한을 수치로 고정해 다시 커지지 않게 한다. */
  ok(`PANEL_W ${w} <= 440 (종전 520)`, w <= 440);
  ok(`PANEL_H ${h} <= 88 (종전 96)`, h <= 88);

  /* ═══ vc286 — 절대 상한만으로는 부족하다 (실측) ═══
   *  위 `<=440` 조건은 PANEL_W=420 을 통과시키는데, 모바일 CSS 폭은 360~414 다.
   *  420 은 360 화면의 117%, 390 화면의 108% → **패널이 화면 밖으로 삐져나온다**.
   *  사용자 지적 "튜토리얼이 정신없다"의 직접 원인 중 하나다.
   *  그래서 가장 좁은 기준 화면(360px)에서도 화면 안에 들어오도록 상한을 건다. */
  const NARROWEST = 360;
  ok(`PANEL_W ${w} 가 최소 화면폭 ${NARROWEST}px 의 92% 이하`, w <= NARROWEST * 0.92);

  const before = 520 * 96, after = w * h;
  ok(`면적 ${after} < 종전 ${before}`, after < before);
  ok(`면적 감소율 ${Math.round((1 - after / before) * 100)}% >= 20%`, 1 - after / before >= 0.2);

  /* desc 최대 길이가 새 랩폭에 들어가는지 — 데이터와 레이아웃이 어긋나면 패널이 넘친다 */
  const descs = [...SRC.matchAll(/desc:\s*"([^"]*)"/g)].map((m) => m[1]);
  ok("desc 를 하나 이상 찾았다", descs.length > 0);
  const maxLen = Math.max(...descs.map((d) => [...d].length));
  /* 랩폭 = PANEL_W - 124, 12px 폰트 ≈ 한글 1자 12px */
  const perLine = Math.floor((w - 124) / 12);
  const needLines = Math.ceil(maxLen / perLine);
  /* 제목(18) + desc(2줄×16) + 키배지(22) + 여백 ≈ 84px 안에 들어와야 한다 */
  ok(`desc 최대 ${maxLen}자 → ${needLines}줄 @ ${perLine}자/줄 — 3줄 이하`, needLines <= 3);
}

/* ═══ 2. 표시/숨김 API 가 존재한다 ═══ */
{
  ok("setHidden 공개 메서드", /setHidden\s*\(\s*on:\s*boolean\s*\)/.test(code));
  ok("hud.setVisible 를 호출", /this\.hud\?\.setVisible\(/.test(code));
  /* ★ 함정: 마커는 컨테이너 밖이라 hud.setVisible 로 안 가려진다 */
  ok("마커 mkGlow 를 개별로 숨긴다", /this\.mkGlow\?\.setVisible\(false\)/.test(code));
  ok("마커 mkSpark 를 개별로 숨긴다", /this\.mkSpark\?\.setVisible\(false\)/.test(code));
}

/* ═══ 3. ★ update() 가 숨김을 덮어쓰지 않는다 (리드가 지적한 함정) ═══
 *  update() 안에서 `mkGlow.setVisible(true)` 를 무조건 호출하므로,
 *  숨김 상태에서 조기 반환하지 않으면 매 프레임 다시 보인다. */
{
  const upd = code.slice(code.indexOf("update()"), code.indexOf("private finish()"));
  ok("update 안에 hidden 조기 반환이 있다", /if\s*\(\s*this\.hidden\s*\)/.test(upd));
  const guardIdx = upd.indexOf("this.hidden");
  const visTrueIdx = upd.indexOf("setVisible(true)");
  ok("조기 반환이 setVisible(true) 보다 앞이다", guardIdx >= 0 && visTrueIdx > guardIdx);
  /* hidden 상태에서 마커를 명시적으로 끈다 */
  const guardBlock = upd.slice(guardIdx, guardIdx + 220);
  ok("조기 반환 블록에서 마커를 숨긴다",
    /setVisible\(false\)/.test(guardBlock));
}

/* ═══ 4. cinematic:state 구독 + destroy 에서 해제 (누수 방지) ═══ */
{
  ok("cinematic:state 를 구독한다", /EventBus\.on\(\s*["']cinematic:state["']/.test(code));
  ok("destroy 에서 구독 해제한다", /EventBus\.off\(\s*["']cinematic:state["']/.test(code));
  /* 구독 해제가 destroy 함수 안에 있는지 */
  const destroyBody = code.slice(code.indexOf("destroy()"));
  ok("off 가 destroy 본문에 있다", /cinematic:state/.test(destroyBody));
  /* 같은 핸들러 참조를 쓰는지 (인라인 람다면 off 가 안 먹는다) */
  ok("핸들러를 인스턴스 프로퍼티로 보관", /onCinematic/.test(code));
  ok("on/off 가 같은 심볼을 쓴다", (code.match(/onCinematic/g) ?? []).length >= 3);
}

/* ═══ 5. 세이브 호환 — tutStep 키 이름 유지 ═══ */
{
  ok("saveTutorialProgress 호출 유지", /saveTutorialProgress\(/.test(code));
  ok("completeTutorialSave 호출 유지", /completeTutorialSave\(/.test(code));
  /* WorldScene/config 의 키 이름을 바꾸지 않았는지 (이 파일은 tutStep 을 직접 안 다룸) */
  const ws = fs.readFileSync(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
  ok("WorldScene 에 tutStep 키가 그대로 있다", /tutStep/.test(ws));
}

/* ═══ 6. 기존 공개 API 보존 ═══ */
{
  for (const m of ["notify", "update", "skip", "destroy"]) {
    ok(`공개 메서드 ${m} 유지`, new RegExp(`\\b${m}\\s*\\(`).test(code));
  }
  ok("currentId getter 유지", /get currentId\(\)/.test(code));
}

/* ═══ 7. depth 관계 — 튜토리얼(9200)이 프롤로그(3000)보다 위라 숨김이 유일한 해법임을 기록 ═══ */
{
  ok("튜토리얼 depth 9200 유지", /setDepth\(9200\)/.test(code));
  const ws = fs.readFileSync(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
  /* 프롤로그 오버레이가 3000 대라면 튜토리얼이 위 — 자동 숨김이 필요하다는 근거 */
  const m = ws.match(/const d = 3000/);
  ok("프롤로그 오버레이 depth < 튜토리얼 depth (숨김 필요 근거)", !!m || /setDepth\(3000\)/.test(ws));
}

console.log(`tutorial-panel-hide: ${checks} checks OK`);
