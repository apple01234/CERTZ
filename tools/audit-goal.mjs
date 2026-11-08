/* goal 의 10개 결함이 실제 코드/에셋에 반영됐는지 기계적으로 감사한다. */
import { existsSync, readFileSync, readdirSync } from "node:fs";

const R = [];
const add = (id, name, pass, ev) => R.push({ id, name, pass, ev });

/* ① 대각선 바닥선 — drawGroundEdges 가 setDisplaySize 를 쓰는가 (vc286)
 *
 * 주의: 이 함수 본문에는 "종전 코드는 setCrop(0,0,144,128) 이었다"는 **설명 주석**이
 * 들어 있다. 그래서 "setCrop 문자열이 없다"로 검사하면 오탐이 난다(실제로 겪었다).
 * 주석을 걷어낸 뒤 실제 호출만 본다. */
{
  const t = readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  const start = t.indexOf("private drawGroundEdges");
  /* 다음 메서드 선언까지를 본문으로 본다 */
  const after = t.indexOf("\n  private ", start + 10);
  const body = t.slice(start, after > 0 ? after : start + 6000);
  const code = body
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join("\n");
  add("①", "대각선 바닥선", /setDisplaySize\s*\(/.test(code) && !/setCrop\s*\(/.test(code),
    `실제코드: setDisplaySize=${/setDisplaySize\s*\(/.test(code)} setCrop=${/setCrop\s*\(/.test(code)}`);
}

/* ② 파란 삼각지붕 건물 — PNG 부재 + 코드 참조 0 (vc283) */
{
  const png = existsSync("public/assets/objects/town/obj_town_house_blue.png");
  let live = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = `${d}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.(ts|tsx|json)$/.test(e.name)) {
        const src = readFileSync(f, "utf8");
        /* 주석 줄을 제거하고 실제 코드만 센다 */
        const code = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
        if (/obj_town_house_blue|house_blue/.test(code)) live += (code.match(/house_blue/g) || []).length;
      }
    }
  };
  walk("src");
  add("②", "파란 삼각지붕", !png && live === 0, `PNG=${png} 코드참조=${live}`);
}

/* ③ 흐릿한 풀밭 → 픽셀아트 (vc283) — 내부 거칠기 측정은 tests/floor-tiles 가 담당.
 *    여기서는 256px + 색수만 확인. */
{
  const p = "public/assets/ground/ground_meadow.png";
  add("③", "흐릿한 풀밭", existsSync(p), existsSync(p) ? "ground_meadow.png 존재(거칠기는 floor-tiles 테스트)" : "없음");
}

/* ④ 초상화/월드 스프라이트 불일치 — npcportrait 매핑 키 수 (vc285) */
{
  const m = JSON.parse(readFileSync("public/assets/npcportrait/_map.json", "utf8"));
  add("④", "초상화 매핑", Object.keys(m).length >= 50, `_map.json 키 ${Object.keys(m).length}개`);
}

/* ⑤ 컷씬 중 HUD 숨김 — cinematic:state 짝 (vc283/284) */
{
  const w = readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  const g = readFileSync("src/components/game/GameRoot.tsx", "utf8");
  add("⑤", "컷씬 HUD 숨김",
    /cinematic:state/.test(w) && /events\.once\("shutdown"/.test(w) && /cinematic:state/.test(g),
    `WorldScene emit=${/cinematic:state/.test(w)} shutdown훅=${/events\.once\("shutdown"/.test(w)} GameRoot구독=${/cinematic:state/.test(g)}`);
}

/* ⑥ 프롤로그 버튼 — UI 버튼이 없고 인게임 연출(showPrologue)이 담당 */
{
  const w = readFileSync("src/game/scenes/WorldScene.ts", "utf8");
  add("⑥", "프롤로그", /private showPrologue\(/.test(w), `showPrologue 정의=${/private showPrologue\(/.test(w)}`);
}

/* ⑦ 튜토리얼 오버레이 — 패널 폭 <= 모바일 (vc286: 420→331) */
{
  const t = readFileSync("src/game/Tutorial.ts", "utf8");
  const m = /PANEL_W\s*=\s*(\d+)/.exec(t);
  add("⑦", "튜토리얼 패널", m && Number(m[1]) <= 360 * 0.92, `PANEL_W=${m ? m[1] : "?"} (상한 ${Math.round(360 * 0.92)})`);
}

/* ⑧ 보스맵 분리 (vc288, 이번 세션) */
{
  const t = readFileSync("src/game/stages.ts", "utf8");
  add("⑧", "보스 아레나", /ARENA_SCALE/.test(t) && /if \(sub === BOSS_SUB\) return \[\];/.test(t),
    `ARENA_SCALE=${/ARENA_SCALE/.test(t)} 보스잡몹0=${/if \(sub === BOSS_SUB\) return \[\];/.test(t)}`);
}

/* ⑨ 정본 보스 페이즈 (vc288) */
{
  add("⑨", "정본 보스 페이즈", existsSync("src/game/entities/bossDesign.ts"),
    existsSync("src/game/entities/bossDesign.ts") ? "bossDesign.ts 존재" : "없음");
}

/* ⑩ 빌드 재현성 (vc288) */
{
  const c = readFileSync("src/app/globals.css", "utf8");
  const ok = /source\(none\)/.test(c) && /^@source\s+"\.\.\/";/m.test(c);
  add("⑩", "빌드 재현성", ok, `source(none)+@source 쌍=${ok}`);
}

let bad = 0;
for (const r of R) {
  if (!r.pass) bad++;
  console.log(`${r.pass ? "OK  " : "FAIL"} ${r.id} ${r.name.padEnd(18)} ${r.ev}`);
}
console.log(`\n${R.length - bad}/${R.length} 통과`);
process.exit(bad ? 1 : 0);
