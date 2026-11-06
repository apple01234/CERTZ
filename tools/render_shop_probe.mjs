/**
 * render_shop_probe.mjs — ShopPanel / PassPanel / ContentPanel 마크업을 실제로 렌더해 검증
 *
 * [왜 필요한가]
 *  브라우저(헤드리스)가 이 환경에서 앱을 하이드레이션하지 못한다(WebGL/Phaser 초기화).
 *  그래서 UI 개편이 실제로 "의도한 구조"로 렌더되는지 눈으로 확인할 수단이 없었다.
 *  → React 를 서버사이드로 직접 렌더해 HTML 을 뽑고, 구조(카테고리 탭/카드 그리드)를 검사한다.
 *
 * 검증 항목
 *  1) ShopPanel : 좌측 카테고리 탭(회복 물약/장비/…)과 카드 그리드가 렌더되는가
 *  2) PassPanel : 프리미엄/무료 트랙이 위아래로 분리되고 레벨 마커가 사이에 있는가
 *  3) ContentPanel : 콘텐츠가 카드 그리드(2열 이상)로 렌더되는가
 */
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const OUT = [];
const log = (...a) => { OUT.push(a.join(" ")); };

/* ---- RpgState 최소 목업 (패널이 참조하는 필드만) ---- */
const baseRpg = {
  gold: 123456, emerald: 789, lv: 120, cls: "warrior", name: "테스터",
  hp: 5000, maxHp: 5000, mp: 1200, maxMp: 1200,
  weapon: "weapon_3", armor: "armor_3", upWea: 5, upArm: 3,
  owned: ["potion_hp", "potion_mp", "weapon_2", "armor_2"],
  shopStock: ["potion_hp", "potion_mp", "potion_hp2", "buff_atk", "buff_def",
              "weapon_2", "weapon_3", "armor_2", "armor_3", "pet_slime"],
  buffItems: { buff_atk: 2 },
  pet: null, cosmetic: [], accessories: [], accUp: {},
  quickPots: { hp: "potion_hp", mp: "potion_mp" },
  starBless: 1, starPity: 0, eertCube: 0, unlockedSets: [],
  autoUse: { hpPct: 0, mpPct: 0, mpOn: false, buffs: [] },
  stats: { atk: 300, def: 200, crit: 10, hp: 5000 },
  inf: { towerBest: 42, abyss: 1500, trialDone: "", parkTickets: 3, gateTickets: 2, riftTickets: 1 },
  pass: {
    season: "S1", daysLeft: 22, lv: 7, lvXp: 120, prem: false,
    claimedF: [1, 2], claimedP: [], 
    missions: { d: {}, w: {}, cd: [], cw: [] },
  },
};

function tryRender(label, factory) {
  try {
    const el = factory(baseRpg);
    const html = renderToStaticMarkup(el);
    log(`# ${label}: OK (${html.length} chars)`);
    return html;
  } catch (e) {
    log(`# ${label}: FAIL — ${String(e.message).slice(0, 300)}`);
    return null;
  }
}

/* ---- Panels.tsx 를 직접 import (TSX → esbuild 번들 필요) ---- */
const mod = await import("../src/components/game/Panels.tsx");
const { ShopPanel, PassPanel, ContentPanel } = mod;

const noop = () => {};

const shopHtml = tryRender("ShopPanel", (rpg) => h(ShopPanel, { rpg, onClose: noop }));
if (shopHtml) {
  const checks = [
    ["카테고리 탭 존재(회복 물약)", shopHtml.includes("회복 물약")],
    ["카테고리 개수 표시", /class="ml-1[^"]*">\d+</.test(shopHtml)],
    ["상품 카드 그리드(grid-cols-2)", shopHtml.includes("grid-cols-2")],
    ["구매 버튼(가격)", /G<\/span>|<span class="text-\[9px\] opacity-80">G/.test(shopHtml)],
    ["스타포스 섹션 제거됨(상점)", !shopHtml.includes("스타포스 강화")],
    ["가방 안내 문구 노출", shopHtml.includes("가방")],
  ];
  log("");
  for (const [name, ok] of checks) log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  // 카테고리 이름 목록 추출
  const cats = [...shopHtml.matchAll(/<button[^>]*>([가-힣A-Za-z ]{2,10})<span[^>]*>(\d+)<\/span>/g)]
    .map((m) => `${m[1]}(${m[2]})`);
  log(`  카테고리: ${cats.slice(0, 10).join(", ")}`);
}

const passHtml = tryRender("PassPanel", (rpg) => h(PassPanel, { rpg, onClose: noop }));
if (passHtml) {
  const checks = [
    ["프리미엄 트랙 라벨", passHtml.includes("프리미엄")],
    ["무료 트랙 라벨", passHtml.includes("무료")],
    ["레벨 마커 렌더", /rounded-full[^>]*>\d+<\/span>/.test(passHtml)],
  ];
  log("");
  for (const [name, ok] of checks) log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  // 순서 검증: 프리미엄 라벨이 무료 라벨보다 앞에 나오는가
  const pi = passHtml.indexOf("프리미엄");
  const fi = passHtml.lastIndexOf("무료");
  log(`  트랙 순서: 프리미엄@${pi} / 무료@${fi} → ${pi >= 0 && fi > pi ? "PASS(위=프리미엄)" : "FAIL"}`);
}

const contentHtml = tryRender("ContentPanel", (rpg) => h(ContentPanel, { rpg, onClose: noop }));
if (contentHtml) {
  const checks = [
    ["탭 4열 그리드", contentHtml.includes("grid-cols-4")],
    ["콘텐츠 카드 아이콘", /text-\[13px\] leading-none">[^\x00-\x7F]/.test(contentHtml)],
    ["탭 라벨(심연의 탑)", contentHtml.includes("심연의 탑")],
  ];
  log("");
  for (const [name, ok] of checks) log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
}

console.log(OUT.join("\n"));
