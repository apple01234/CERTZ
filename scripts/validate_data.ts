/**
 * SERTZ 데이터 무결성 검사 (v1.0.2 — 유저 지시 Phase 30)
 * 실행: bun scripts/validate_data.ts
 * 검사: 중복 아이콘 / 0 가격 / 누락 아이콘 파일 / 잘못된 아이템·몬스터 참조 /
 *       대사 화자 초상화 매핑 / BGM 파일 존재 / 보스-챕터 일관성 / 퀘스트 targetKey
 */
import { ITEMS, SHOP_STOCK, BM_STOCK, TRADE_STOCK, TRADE_PRICES, CHEST_TABLES, PACK_CONTENTS, DAILY_DEAL_POOL, DIALOGUES, COSMETIC_DEFS, ENEMIES } from "../src/game/data";
import { BOSS_DEFS, CHAPTERS } from "../src/game/stages";
import { BGM_ALL_TRACKS } from "../src/game/audio";
import { readFileSync, existsSync } from "node:fs";

type ItemDefLite = { key: string; name: string; icon: string; price: number; bmPrice?: number; bmOnly?: boolean; tradeLock?: boolean; tier: string };
type BmGrant = { item?: string; label: string; gold?: number; emerald?: number };

let issues = 0;
const sec = (t: string) => console.log(`\n=== ${t} ===`);
const bad = (msg: string) => { console.log("  ✗ " + msg); issues++; };
const warn = (msg: string) => console.log("  ⚠ " + msg);
const ok = (msg: string) => console.log("  ✓ " + msg);
const IT = ITEMS as unknown as Record<string, ItemDefLite>;

/* 1. 중복 아이콘 */
sec("1. 중복 아이콘 (서로 다른 item key가 동일 icon)");
const byIcon = new Map<string, string[]>();
for (const it of Object.values(IT)) {
  const arr = byIcon.get(it.icon) ?? []; arr.push(it.key); byIcon.set(it.icon, arr);
}
let dupGroups = 0, dupItems = 0;
for (const [icon, keys] of [...byIcon.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (keys.length > 1) { dupGroups++; dupItems += keys.length; console.log(`  ${icon}: ${keys.join(", ")}`); }
}
console.log(`  → ${dupGroups}그룹 / 중복 아이템 ${dupItems}종`);

/* 2. 0 가격 */
sec("2. price 0 아이템 분류");
const zero = Object.values(IT).filter((it) => !it.price);
const zBm = zero.filter((i) => i.bmPrice), zBd = zero.filter((i) => i.tradeLock), zOther = zero.filter((i) => !i.bmPrice && !i.tradeLock);
console.log(`  BM 전용(price0+bmPrice): ${zBm.length}종`);
console.log(`  보스 드롭(tradeLock): ${zBd.length}종`);
console.log(`  기타: ${zOther.length ? zOther.map((i) => i.key).join(", ") : "없음"}`);
for (const i of zOther) bad(`price 0 일반 아이템: ${i.key} (${i.name})`);

/* 3. 아이콘 파일 */
sec("3. 아이콘 파일 존재");
let missingIcon = 0;
for (const it of Object.values(IT)) {
  if (!existsSync(`public/assets/${it.icon}.webp`)) { bad(`${it.key} → ${it.icon}.webp 없음`); missingIcon++; }
}
for (const [k, c] of Object.entries(COSMETIC_DEFS as unknown as Record<string, { icon: string }>)) {
  if (!existsSync(`public/assets/${c.icon}.webp`)) { bad(`cosmetic ${k} → ${c.icon}.webp 없음`); missingIcon++; }
}
if (!missingIcon) ok("전부 존재");

/* 4. 참조 유효성 */
sec("4. 아이템/몬스터 참조 유효성");
const refGroups: Record<string, readonly string[]> = { SHOP_STOCK, BM_STOCK, TRADE_STOCK, DAILY_DEAL_POOL };
for (const [name, arr] of Object.entries(refGroups)) {
  const miss = arr.filter((k) => !(k in IT));
  if (miss.length) bad(`${name} 미정의: ${miss.join(", ")}`); else ok(`${name} (${arr.length}종) 정상`);
}
for (const [chest, tbl] of Object.entries(CHEST_TABLES as unknown as Record<string, { w: number; g: BmGrant }[]>)) {
  const miss = tbl.filter((e) => e.g.item && !(e.g.item in IT));
  if (miss.length) bad(`CHEST ${chest} 미정의 아이템: ${miss.map((e) => e.g.item).join(", ")}`);
}
for (const [pack, cont] of Object.entries(PACK_CONTENTS as unknown as Record<string, BmGrant[]>)) {
  const miss = cont.filter((g) => g.item && !(g.item in IT));
  if (miss.length) bad(`PACK ${pack} 미정의 아이템: ${miss.map((g) => g.item).join(", ")}`);
}
const tradeMiss = Object.keys(TRADE_PRICES).filter((k) => !(k in IT));
if (tradeMiss.length) bad(`TRADE_PRICES 미정의: ${tradeMiss.join(", ")}`); else ok("TRADE_PRICES 정상");
const tradeNoPrice = TRADE_STOCK.filter((k) => !(k in TRADE_PRICES));
if (tradeNoPrice.length) bad(`TRADE_STOCK 가격 누락: ${tradeNoPrice.join(", ")}`);
/* 퀘스트 hunt targetKey → ENEMIES */
const enemyKeys = new Set(Object.keys(ENEMIES as unknown as Record<string, unknown>));
let badTarget = 0;
for (const ch of CHAPTERS as unknown as { key: string; title: string; boss?: string; beats: { quest?: { id: string; type: string; targetKey?: string } }[] }[]) {
  if (ch.boss && !(ch.boss in (BOSS_DEFS as unknown as Record<string, unknown>))) bad(`${ch.key}: 존재하지 않는 보스 키 ${ch.boss}`);
  for (const b of ch.beats ?? []) {
    const q = b.quest;
    if (q?.type === "hunt" && q.targetKey && !enemyKeys.has(q.targetKey)) { bad(`${ch.key}/${q.id}: hunt targetKey "${q.targetKey}"가 ENEMIES에 없음`); badTarget++; }
  }
}
if (!badTarget) ok("퀘스트 targetKey 전부 유효");

/* 5. 대사 화자 → 초상화 */
sec("5. 대사 화자 초상화 매핑");
const dbx = readFileSync("src/components/game/DialogueBox.tsx", "utf8");
const pStart = dbx.indexOf("const NPC_PORTRAITS");
const portraitBlock = dbx.slice(pStart, pStart + 4000);
const portraitSpeakers = new Set<string>();
for (const m of portraitBlock.matchAll(/^\s*"([^"]+)":\s*\{/gm)) portraitSpeakers.add(m[1]);
const bossNames = [...new Set(Object.values(BOSS_DEFS as unknown as Record<string, { name: string }>).map((b) => b.name))];
let noPortrait = 0;
for (const [id, d] of Object.entries(DIALOGUES as unknown as Record<string, { speaker: string }>)) {
  const s = d.speaker;
  if (portraitSpeakers.has(s)) continue;
  const bossHit = bossNames.find((n) => n === s || n.includes(s) || s.includes(n));
  if (!bossHit) { warn(`"${s}" (${id}) → 초상화 매핑 없음`); noPortrait++; }
  else warn(`fallback 매칭(하드코딩 우회): "${s}" (${id}) ≈ 보스 "${bossHit}"`);
}
if (!noPortrait) ok("직접 매핑 누락 없음 (fallback 제외)");

/* 6. BGM 파일 */
sec("6. BGM 트랙 파일 존재");
let missingBgm = 0;
for (const t of BGM_ALL_TRACKS as unknown as string[]) {
  if (!existsSync(`public/assets/audio/${t}.ogg`)) { bad(`${t}.ogg 없음`); missingBgm++; }
}
if (!missingBgm) ok(`${(BGM_ALL_TRACKS as unknown as string[]).length}곡 전부 존재`);

/* 7. 보스-챕터 일관성 */
sec("7. 보스-챕터 일관성");
const seenBoss = new Map<string, string>();
for (const ch of CHAPTERS as unknown as { key: string; title: string; boss?: string }[]) {
  if (ch.boss) {
    const bd = (BOSS_DEFS as unknown as Record<string, { name: string }>)[ch.boss];
    const prev = seenBoss.get(ch.boss);
    if (prev) warn(`보스 ${ch.boss}(${bd?.name})가 ${prev}와 ${ch.key} 양쪽 챕터에 배치`);
    else seenBoss.set(ch.boss, ch.key);
    if (bd && !existsSync(`public/assets/${ch.boss}.webp`)) warn(`보스 텍스처 ${ch.boss}.webp 없음(다른 스프라이트 재사용 여부 확인)`);
  }
}
ok(`챕터 보스 ${seenBoss.size}종 배치 확인`);

console.log(`\n====== 결과: 치명 이슈 ${issues}건 ======`);
