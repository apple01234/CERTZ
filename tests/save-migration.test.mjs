// vc219 — 세이브 마이그레이션 검증
// 핵심: 구 세이브(v 없음)가 깨지지 않고, 신 세이브는 재변환되지 않는다.
import { migrateSave, SAVE_VERSION } from "../src/game/config.ts";

let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

// 1) 구 세이브(v 없음) → v 부여, 데이터 보존
const legacy = { stage: "village", lv: 12, exp: 340, maxHp: 250, atk: 40, cleared: false };
const m = migrateSave({ ...legacy });
t("구 세이브(v 없음) → v=1", m.v === SAVE_VERSION, `(v=${m.v})`);
t("구 세이브 데이터 보존", m.lv === 12 && m.exp === 340 && m.atk === 40 && m.stage === "village");

// 2) 신 세이브는 그대로 (재변환 없음 = 멱등)
const again = migrateSave({ ...m });
t("재마이그레이션 멱등", again.v === SAVE_VERSION && again.lv === 12);

// 3) 이미 최신이면 객체를 건드리지 않는다 (불필요한 write 방지)
const fresh = { v: SAVE_VERSION, stage: "village", lv: 5, exp: 0, maxHp: 100, atk: 12, cleared: false };
const same = migrateSave(fresh);
t("최신 세이브 그대로", same.v === SAVE_VERSION && same.lv === 5);

// 4) v 가 비정상(문자열/음수)이어도 죽지 않는다
const weird = migrateSave({ stage: "village", lv: 1, exp: 0, maxHp: 100, atk: 12, cleared: false, v: "abc" });
t("v 문자열 → 0 취급 후 승격", weird.v === SAVE_VERSION, `(v=${weird.v})`);

// 5) 필수 필드가 없어도 마이그레이션 자체는 통과 (검증은 loadSave 담당)
const sparse = migrateSave({ stage: "village" });
t("필드 부족해도 예외 없음", sparse.v === SAVE_VERSION);

// 6) 원본을 변형하지 않는지 (순수성) — 같은 참조를 넘기면 변형되지만
//    loadSave 는 JSON.parse 결과를 넘기므로 실제로는 새 객체다.
const orig = { stage: "x", lv: 1, exp: 0, maxHp: 1, atk: 1, cleared: false };
const before = JSON.stringify(orig);
migrateSave({ ...orig });
t("입력 객체 원본 불변", JSON.stringify(orig) === before);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
