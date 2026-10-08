/**
 * v1.4.32 (#세이브복원 버그) 단위 검증 — slots.importCloudSave
 *  시나리오 5종: ①동일이름 교체 ②활성 캐릭터 교체 ③신규 편입(새 기기)
 *  ④형식 불량 거부 ⑤슬롯 풀 거부 + 레거시 미러 항상 유지
 */
import { importCloudSave, loadSlots } from "../src/game/slots.ts";
import type { SaveData } from "../src/game/config.ts";

/* --- 브라우저 모의 --- */
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

let pass = 0, fail = 0;
const ok = (c: boolean, name: string, extra = "") => { if (c) { pass++; console.log("  PASS", name, extra); } else { fail++; console.log("  FAIL", name, extra); } };

const cloud: SaveData = { stage: "village", lv: 42, exp: 100, maxHp: 900, atk: 55, cleared: false, playerName: "레오", gold: 777, emerald: 12 } as SaveData;

/* ① 기존 기기 — 동일 이름 캐릭터(c1 "레오") 교체 */
store.set("sertz_slots_v1", JSON.stringify({ v: 1, slots: 8, activeId: null, chars: { c1: { id: "c1", name: "레오", cls: null, lv: 3, stage: "village", cleared: false, lastSeen: 1, createdAt: 1, rebirths: 0 } } }));
store.set("sertz_char_c1", JSON.stringify({ stage: "village", lv: 3, exp: 0, maxHp: 100, atk: 10, cleared: false, playerName: "레오" }));
const r1 = importCloudSave({ ...cloud });
const s1 = loadSlots();
ok(r1.ok && r1.mode === "name", "① 동일이름 → 기존 캐릭터 교체", JSON.stringify(r1));
ok(JSON.parse(store.get("sertz_char_c1")!).lv === 42, "① sertz_char_c1 세이브가 클라우드분으로 교체(lv42)");
ok(JSON.parse(store.get("sertz_save_v2")!).lv === 42, "① 레거시 키(sertz_save_v2) 미러 유지");
ok(s1.chars["c1"].lv === 42 && s1.activeId === "c1", "① 슬롯 메타 갱신+활성 지정");

/* ② 게임 중 복원 — 이름 미일치 + 활성 캐릭터 있음 → 활성 교체 */
store.set("sertz_slots_v1", JSON.stringify({ v: 1, slots: 8, activeId: "c9", chars: { c9: { id: "c9", name: "가온", cls: null, lv: 7, stage: "village", cleared: false, lastSeen: 1, createdAt: 1, rebirths: 0 } } }));
store.set("sertz_char_c9", JSON.stringify({ stage: "village", lv: 7, exp: 0, maxHp: 100, atk: 10, cleared: false, playerName: "가온" }));
const r2 = importCloudSave({ ...cloud, playerName: "레오" });
ok(r2.ok && r2.mode === "active" && r2.id === "c9", "② 활성 캐릭터 교체", JSON.stringify(r2));
ok(JSON.parse(store.get("sertz_char_c9")!).playerName === "레오", "② 활성 키 내용 교체 확인");

/* ③ 새 기기 — 슬롯 비어있음 → 신규 편입 */
store.set("sertz_slots_v1", JSON.stringify({ v: 1, slots: 8, activeId: null, chars: {} }));
const r3 = importCloudSave({ ...cloud });
const s3 = loadSlots();
const ids = Object.keys(s3.chars);
ok(r3.ok && r3.mode === "new" && ids.length === 1, "③ 신규 슬롯 편입", JSON.stringify(r3));
ok(!!store.get(`sertz_char_${ids[0]}`) && s3.activeId === ids[0], "③ 캐릭터 키 기록+활성");

/* ④ 형식 불량 거부 */
const r4 = importCloudSave({ foo: 1 } as unknown as SaveData);
ok(!r4.ok && /형식/.test((r4 as { reason: string }).reason), "④ 형식 불량 거부", JSON.stringify(r4));

/* ⑤ 슬롯 풀 거부 */
store.set("sertz_slots_v1", JSON.stringify({ v: 1, slots: 1, activeId: null, chars: { x1: { id: "x1", name: "다른이", cls: null, lv: 1, stage: "village", cleared: false, lastSeen: 1, createdAt: 1, rebirths: 0 } } }));
const r5 = importCloudSave({ ...cloud });
ok(!r5.ok && /슬롯이 부족/.test((r5 as { reason: string }).reason), "⑤ 슬롯 풀 거부", JSON.stringify(r5));

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
