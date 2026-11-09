import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/* vc291 — Windows 하드코딩 경로를 걷어냈다. 종전 `C:\\coding\\CERTZ` 는
 *  개발자 PC 에서만 맞고 리눅스 CI·컨테이너에서는 ENOENT 로 5개 테스트가
 *  통째로 실패했다(경로 문제를 게임 결함으로 오독하게 만든다).
 *  테스트 파일 위치 기준 상대경로로 해석하므로 어느 OS 에서도 맞는다. */
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* ═══ vc285 — 초상화 매핑 누락 감사 ═══
 *
 * [사용자 지적] "초상화와 월드 캐릭터가 따로 논다" (스크린샷 2·9).
 *
 * [실측으로 확인한 실제 결함] 대사 데이터의 화자 **85명 중 54명**이 어떤 초상화로도
 *  해석되지 않았다. 초상화가 없으면 DialogueBox 는 얼굴 없이 이름만 그린다
 *  (portraitOf → null → portraitSrc = ""). 그중 **"라일락 연합의 기록자" 27회**는
 *  라일락 월드의 핵심 화자인데도 라일락 초상화(npc_lilac.png)를 못 쓰고 있었다.
 *
 * [이 테스트가 고정하는 것]
 *  1) 라일락/스칼렛처럼 **이름으로 신원이 확정**되는 수식어 화자는 초상화를 갖는다.
 *  2) 나레이터(해설·이야기꾼·수호신…)는 초상화가 없는 것이 **정상**이므로
 *     억지 매핑하지 않는다 — 이 예외를 함께 못박아 두지 않으면 나중에
 *     "54명 전부 매핑" 같은 잘못된 목표가 생긴다.
 *  3) npc_*.png 로 배포되는 파일은 _map.json 이 반드시 참조한다
 *     (참조되지 않는 파일은 영원히 쓰이지 않는 죽은 에셋이다).
 */

async function loadTable() {
  const src = await readFile(path.join(ROOT, "src/components/game/DialogueBox.tsx"), "utf8");
  const start = src.indexOf("const NPC_PORTRAITS");
  const block = src.slice(start, src.indexOf("};", start));
  const table = {};
  for (const m of block.matchAll(/"([^"]+)":\s*\{\s*tex:\s*"([^"]+)"/g)) table[m[1]] = m[2];
  return table;
}

async function loadMap() {
  return JSON.parse(
    await readFile(path.join(ROOT, "public/assets/npcportrait/_map.json"), "utf8"),
  );
}

/** portraitOf() 의 해석 순서 재현: map(npc_) > NPC_PORTRAITS */
function resolves(map, table, speaker) {
  const gen = map[speaker];
  if (gen?.src && String(gen.src).includes("/npc_")) return speaker;
  if (table[speaker]) return table[speaker];
  return null;
}

test('라일락 월드의 수식어 화자가 라일락 초상화로 해석된다', async () => {
  const [map, table] = [await loadMap(), await loadTable()];
  /* 27회로 가장 많이 등장하는 화자. 초상화가 없으면 얼굴 없는 대사창이 뜬다.
   *
   * [vc291 수정] 종전에는 `resolves()` 가 돌려주는 **tex(화자 이름)** 에 대해
   *  /lilac/ 을 기대했다. 그런데 tex 는 화자 이름이라 절대 "lilac" 이 될 수 없고,
   *  그래서 이 테스트는 항상 실패했다 — 검사 대상이 틀렸던 것이다.
   *  진짜로 봐야 하는 것은 **어떤 얼굴 파일이 붙었는가**다.
   *  "라일락 연합의 기록자" 에 임의의 AI 얼굴(dxp_26br)이 붙어 있어도
   *  종전 테스트는 그것을 잡지 못했다. 이제 파일명으로 검사한다. */
  const cases = [
    ["라일락 연합의 기록자", "npc_lilac.png"],
    ["라일락 월드의 안내인", "npc_lilac.png"],
    ["라일락 연합", "npc_lilac.png"],
    ["스칼렛의 환영", "npc_scarlet.png"],
    ["어둠의 군주 스칼렛", "npc_scarlet.png"],
    ["에벤트왕국 근위대장 아리스텔라", "npc_aristella.png"],
  ];
  for (const [speaker, wantFile] of cases) {
    const entry = map[speaker];
    assert.ok(entry?.src, `"${speaker}" 가 _map.json 에 없다 — 대사창에 얼굴이 안 나온다`);
    const got = String(entry.src).split("/").pop();
    assert.equal(
      got,
      wantFile,
      `"${speaker}" 는 ${wantFile} 인데 ${got} 로 해석됐다`,
    );
  }
});

test('아리스텔라는 아리 초상화를 쓰지 않는다 (다른 캐릭터)', async () => {
  const map = await loadMap();
  /* npc_aristella.png = 은발 성기사, npc_ari.png = 금발 전사. 서로 다른 인물이다.
   * 배포되는 npc_aristella.png 는 _map.json 이 참조해야 하며,
   * 근위대장 아리스텔라 화자는 그쪽으로 해석돼야 한다. */
  const used = new Set(Object.values(map).map((v) => String(v.src)));
  assert.ok(
    used.has("/assets/npcportrait/npc_aristella.png"),
    "npc_aristella.png 가 어떤 키로도 참조되지 않는다 — 배포되지만 영원히 안 쓰이는 죽은 에셋이다",
  );
  const viaMap = Object.keys(map).filter(
    (k) => String(map[k]?.src).includes("npc_aristella"),
  );
  assert.ok(viaMap.length > 0, "npc_aristella 를 가리키는 키가 없다");
});

test('나레이터 화자는 억지로 매핑하지 않는다 (초상화 없음이 정상)', async () => {
  const [map, table] = [await loadMap(), await loadTable()];
  /* 이들이 초상화를 갖게 되면 나레이션에 엉뚱한 얼굴이 붙는다.
   * "해설"·"이야기꾼"은 세계관 낭독이므로 화자 얼굴이 없는 게 맞다. */
  for (const narrator of ["해설", "이야기꾼", "수호신", "연대기 기록관", "사서"]) {
    assert.equal(
      resolves(map, table, narrator),
      null,
      `"${narrator}" 는 나레이터인데 초상화가 붙었다 — 낭독에 얼굴이 튀어나온다`,
    );
  }
});

test('배포되는 npc_ 초상화는 _map.json 이 전부 참조한다', async () => {
  const map = await loadMap();
  const used = new Set(Object.values(map).map((v) => String(v.src)));
  const files = (await readdir(path.join(ROOT, "public/assets/npcportrait")))
    .filter((f) => f.startsWith("npc_") && f.endsWith(".png"));
  assert.ok(files.length > 0, "npc_ 초상화가 하나도 없다");
  const orphans = files.filter((f) => !used.has(`/assets/npcportrait/${f}`));
  assert.deepEqual(
    orphans,
    [],
    `_map.json 이 참조하지 않는 초상화 = 영원히 쓰이지 않는 죽은 에셋: ${orphans.join(", ")}`,
  );
});
