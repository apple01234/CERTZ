// vc217 — 단축키 배지 동기화 계약 검증
import { applyKeyBinding, keyLabel, DEFAULT_KEYMAP, resetKeyMap } from "/root/workspace/CERTZ/src/game/keymap.ts";

let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

// 1) 기본값: skill5b = Q (사용자가 예시로 든 Q)
t("기본 skill5b = Q", DEFAULT_KEYMAP.skill5b === "Q", `(${DEFAULT_KEYMAP.skill5b})`);
t("keyLabel(Q) = Q", keyLabel("Q") === "Q");

// 2) 화살표 코드는 기호로
t("keyLabel(UP) = ↑", keyLabel("UP") === "↑");
t("keyLabel(LEFT) = ←", keyLabel("LEFT") === "←");

// 3) 재배치: catch 처럼 다른 키로 바꾸면 표시도 따라간다
let km = { ...DEFAULT_KEYMAP };
const before = keyLabel(km.skill5b);
km = applyKeyBinding(km, "skill5b", "T", "arrows");
const after = keyLabel(km.skill5b);
t("skill5b Q→T 반영", before === "Q" && after === "T", `(${before} → ${after})`);

// 4) 중복 배정 시 swap — 두 버튼 표시가 함께 바뀐다 (한쪽만 바뀌면 HUD 불일치)
km = { ...DEFAULT_KEYMAP };
const atk0 = km.attack, s1_0 = km.skill1;   // X, Z
km = applyKeyBinding(km, "skill1", "X", "arrows"); // skill1 에 X(공격 키) 배정
t("중복 배정은 swap", km.skill1 === "X" && km.attack === s1_0,
  `(attack ${atk0}→${km.attack}, skill1 ${s1_0}→${km.skill1})`);

// 5) 이동 전용 키는 배정 거부 — 배지가 이동키로 바뀌면 안 된다
km = { ...DEFAULT_KEYMAP };
const kept = applyKeyBinding(km, "skill5b", "W", "wasd"); // wasd 스킴에서 W 는 이동
t("이동 전용 키 거부", kept.skill5b === DEFAULT_KEYMAP.skill5b, `(${kept.skill5b})`);

// 6) 스킴별 기본값이 실제로 다르다 (표시도 스킴 따라감)
/* 스킴별 차이는 attack/skill1 처럼 **겹치는 키**가 아니라 전체로 봐야 한다.
 * (arrows atk=X s1=Z / wasd atk=X s1=Z 로 둘이 같아 오탐이 났었다) */
const arrows = resetKeyMap("arrows"), wasd = resetKeyMap("wasd");
const diffKeys = Object.keys(arrows).filter((k) => arrows[k] !== wasd[k]);
t("스킴별 키맵 분리", diffKeys.length > 0,
  `(${diffKeys.length}개 액션에서 다름: ${diffKeys.slice(0,5).join(",")}…)`);
// 궁극기 2차가 스킴마다 실제로 다른 키를 쓰는지 (표시가 따라가야 하는 대표 사례)
t("skill5b 스킴별 상이", arrows.skill5b !== wasd.skill5b,
  `(arrows=${arrows.skill5b} / wasd=${wasd.skill5b})`);

// 7) 모든 스킬 액션에 표시 가능한 라벨이 있다 (빈 배지 방지)
const acts = ["attack","skill1","skill2","skill3","skill4","skill5","skill5b"];
let ok = true;
for (const a of acts) if (!keyLabel(DEFAULT_KEYMAP[a])) ok = false;
t("모든 스킬/공격에 라벨 존재", ok, `(${acts.map(a=>a+"="+keyLabel(DEFAULT_KEYMAP[a])).join(" ")})`);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
