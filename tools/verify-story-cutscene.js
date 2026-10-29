/**
 * 스토리 컷씬 계약 검증 (v1.4.41 — 유저 지시: "스토리 진행마다 필요한 대화 및 연출 컷씬")
 *
 * 검증 축
 *  1. 13개 챕터(9 + DLC 3 + 여유) 모두 진입 연출이 정의돼 있다
 *  2. 샷이 "위 → 아래 / 좌 → 우 훑기 → 진행 방향" 구도를 지킨다
 *  3. 카메라 안전: camCinema 게이트 · 보간 팬 · 자가치유 · 물리 재개
 *  4. 챕터당 1회만 재생되고 세이브에 영속된다
 *  5. 연출 실패가 게임을 막지 않는다
 *
 *   node tools/verify-story-cutscene.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const story = fs.readFileSync(path.join(root, "src/game/storyCutscenes.ts"), "utf8");
const cine = fs.readFileSync(path.join(root, "src/game/fx/StoryCutscene.ts"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/game/scenes/WorldScene.ts"), "utf8");
const cfg = fs.readFileSync(path.join(root, "src/game/config.ts"), "utf8");
const stages = fs.readFileSync(path.join(root, "src/game/stages.ts"), "utf8");

/* stages.ts 의 챕터 키 */
/* 챕터 키 — 일반 챕터(title 이 먼저)와 DLC(dlc: true 가 먼저) 형식이 다르다 */
const chapterKeys = [...new Set([
  ...[...stages.matchAll(/key:\s*"([a-z]+)",\s*num:\s*\d+,\s*title:/g)].map((m) => m[1]),
  ...[...stages.matchAll(/key:\s*"([a-z]+)",\s*num:\s*\d+,\s*dlc:\s*true/g)].map((m) => m[1]),
])];

check("stages.ts 챕터 수를 읽었다 (9 + DLC)", () => {
  if (chapterKeys.length < 9) throw new Error(`챕터 ${chapterKeys.length}개 — 파싱 실패`);
});

/* storyCutscenes.ts 의 키 */
const defined = [...story.matchAll(/^  ([a-z]+):\s*\{$/gm)].map((m) => m[1]);

check("모든 챕터에 진입 연출이 정의됨", () => {
  const missing = chapterKeys.filter((k) => !defined.includes(k));
  if (missing.length) throw new Error(`미정의 ${missing.length}개: ${missing.join(", ")}`);
});

check("연출이 정의됐지만 챕터에 없는 키가 없다 (오타 방지)", () => {
  const orphan = defined.filter((k) => !chapterKeys.includes(k));
  if (orphan.length) throw new Error(`유령 키: ${orphan.join(", ")}`);
});

check("모든 챕터 연출이 샷 3개 이상", () => {
  const blocks = story.split(/^  [a-z]+: \{$/gm).slice(1);
  const few = blocks.map((b, i) => ({ i, n: (b.match(/\{ rx:/g) || []).length })).filter((x) => x.n < 3);
  if (few.length) throw new Error(`샷이 3개 미만인 챕터 ${few.length}개`);
});

check("첫 샷이 화면 위쪽(ry <= 0.30)에서 시작한다", () => {
  const blocks = [...story.matchAll(/^  ([a-z]+): \{[\s\S]*?shots: \[([\s\S]*?)\n    \]/gm)];
  if (blocks.length === 0) throw new Error("샷 블록 파싱 실패");
  const bad = [];
  for (const [, key, body] of blocks) {
    const firsts = [...body.matchAll(/rx:\s*([\d.]+),\s*ry:\s*([\d.]+)/g)];
    if (firsts.length === 0) continue;
    const ry = parseFloat(firsts[0][2]);
    if (ry > 0.30) bad.push(`${key}(ry=${ry})`);
  }
  if (bad.length) throw new Error(`위에서 시작하지 않음: ${bad.join(", ")}`);
});

check("마지막 샷이 아래쪽(ry >= 0.70) — 복귀 팬이 자연스럽게 이어진다", () => {
  const blocks = [...story.matchAll(/^  ([a-z]+): \{[\s\S]*?shots: \[([\s\S]*?)\n    \]/gm)];
  const bad = [];
  for (const [, key, body] of blocks) {
    const all = [...body.matchAll(/rx:\s*([\d.]+),\s*ry:\s*([\d.]+)/g)];
    if (all.length === 0) continue;
    const ry = parseFloat(all[all.length - 1][2]);
    if (ry < 0.70) bad.push(`${key}(ry=${ry})`);
  }
  if (bad.length) throw new Error(`아래로 끝나지 않음: ${bad.join(", ")}`);
});

check("좌표가 전부 0~1 비율 범위 안", () => {
  const bad = [...story.matchAll(/r[xy]:\s*([\d.]+)/g)]
    .map((m) => parseFloat(m[1]))
    .filter((v) => v < 0 || v > 1);
  if (bad.length) throw new Error(`범위 이탈 ${bad.length}건: ${bad.slice(0, 5).join(", ")}`);
});

/* ── 카메라 안전 ── */
check("camCinema 게이트로 팔로우와 충돌하지 않는다", () => {
  if (!/camCinema = true/.test(cine)) throw new Error("팬 중 팔로우 보류가 없음");
  if (!/camCinema = false/.test(cine)) throw new Error("팬 후 해제가 없음");
  const order = cine.indexOf("camCinema = false");
  const after = cine.indexOf("physics.world.resume", order);
  if (order < 0 || after < 0) throw new Error("해제 → 물리 재개 순서가 없음");
});

check("복귀가 보간 팬 (순간이동 금지)", () => {
  if (!/cam\.pan\(px, py, \d+/.test(cine)) throw new Error("복귀 팬이 없음 — 스냅은 어지럽다");
});

check("자가치유 타임아웃이 있다 (12초 내 강제 복귀)", () => {
  if (!/delayedCall\(12000/.test(cine)) throw new Error("watchdog 없음 — 연출 실패 시 입력 잠금");
});

check("중첩 재생을 거부한다 (WeakSet 가드)", () => {
  if (!/playing\.has\(scene\)/.test(cine)) throw new Error("중첩 가드 없음");
  if (!/return false/.test(cine)) throw new Error("거부 반환 없음");
});

check("연출 파일이 피해를 계산하지 않는다 (view/rule 분리)", () => {
  if (/takeDamage|rollDamage|applyDamage/.test(cine)) throw new Error("연출에서 피해 계산");
});

check("모든 임시 오브젝트를 파괴한다", () => {
  const created = (cine.match(/scene\.add\./g) || []).length;
  const destroyed = (cine.match(/\.destroy\(\)/g) || []).length;
  if (created > 0 && destroyed < created) throw new Error(`생성 ${created} / 파괴 ${destroyed}`);
});

/* ── 씬 연결 ── */
check("구역 1에서만 재생된다 (중간 구역 재진입 방해 금지)", () => {
  if (!/parsed\.sub !== 1/.test(scene)) throw new Error("구역 게이트 없음");
});

check("챕터당 1회만 — 시청 기록을 검사한다", () => {
  if (!/this\.cutsceneSeen\.includes\(parsed\.ch\)/.test(scene)) throw new Error("1회 가드 없음");
  if (!/this\.cutsceneSeen = \[\.\.\.this\.cutsceneSeen, parsed\.ch\]/.test(scene)) {
    throw new Error("시청 기록 갱신 없음");
  }
});

check("시청 기록이 세이브에 영속된다", () => {
  if (!/cutsceneSeen\?: string\[\]/.test(cfg)) throw new Error("SaveData 필드 없음");
  if (!/cutsceneSeen: this\.cutsceneSeen/.test(scene)) throw new Error("buildSave 미기록");
  if (!/this\.cutsceneSeen = \[\.\.\.\(data\.save\?\.cutsceneSeen/.test(scene)) {
    throw new Error("init 복원 없음");
  }
});

check("연출 실패가 게임을 막지 않는다 (try/catch 안전망)", () => {
  if (!/챕터 컷씬 생략/.test(scene)) throw new Error("실패 시 생략 경로 없음");
});

check("대사는 DIALOGUES 키로만 연결된다 (하드코딩 문장 금지)", () => {
  if (!/showDialogue: \(key\) => this\.showDialogueOnce\(key\)/.test(scene)) {
    throw new Error("대사 연결이 없음");
  }
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(`\n챕터 ${chapterKeys.length}개 / 연출 ${defined.length}개`);
console.log(
  fail.length === 0
    ? `ALL CHECKS PASS (${results.length}항목)`
    : `${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
