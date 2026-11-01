/**
 * vc225 — 키 등록 로직 분리 (`WorldScene.setupInput` 1,861줄 중 첫 조각).
 *
 * 배경 (`docs/VC223_ARCH_AUDIT.md`):
 *   `WorldScene.ts` 17,609줄 · 385메서드 · `setupInput` 단일 함수 **1,861줄**.
 *   위험도 1순위가 "`setupInput` 분리"였다.
 *
 * 이 모듈이 옮긴 것:
 *   `setupInput` 첫 25줄 — 배정 가능 키 전체 등록 + 숫자/ESC 별칭 테이블.
 *   원래 `this` 참조가 `this.keys`(할당)와 `this.keyObjs`(3곳)뿐인 **순수 배선**이었다.
 *
 * 왜 여기부터인가:
 *   `setupInput` 110개 핸들러 대부분이 `this.` 를 쓰고 클로저 변수(`onAtk`/`queueSkill`)에
 *   의존해 통째 이동이 위험하다. 반면 이 구간은 씬 상태를 **쓰기만** 하므로 이동 안전성이
 *   가장 높다. 큰 함수를 한 번에 쪼개는 대신 의존도가 낮은 순서로 좁혀 들어간다.
 *
 * 동작 보존:
 *   등록 키 집합 · 별칭 · 할당 순서가 원본과 동일하다. 키가 빠지면 재배치된 단축키가
 *   먹지 않던 기존 버그가 재발하므로 목록은 그대로 유지한다.
 */

/** 배정 가능한 모든 키 코드. 이동(W/A/S/D·화살표)은 고정이고 나머지는 keymap 에서 조회한다. */
export const ALL_KEYS =
  "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC,TAB,Q,E,R,T,Y,U,I,O,P,F,G,H,J,K,L,V,B,N,M,Z,X,C," +
  "ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,ZERO";

/**
 * Phaser 키 코드 → keymap 표기 별칭.
 *  숫자키는 keymap 이 `"1".."0"` 으로 적고 Phaser 코드는 `ONE..ZERO` 라 둘 다 등록해야 조회된다.
 *  ESC 역시 `"Escape"` 표기와 매핑한다.
 */
export const KEY_ALIAS: Record<string, string> = {
  ONE: "1", TWO: "2", THREE: "3", FOUR: "4", FIVE: "5",
  SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9", ZERO: "0",
  ESC: "Escape",
};

/**
 * 키 오브젝트 테이블을 채운다.
 *
 * @param raw       `kb.addKeys(ALL_KEYS)` 결과
 * @param keyObjs   채울 대상 (씬의 `this.keyObjs`). 기존 항목은 유지하고 덮어쓴다.
 * @returns         채운 항목 수 (검증용)
 */
export function fillKeyObjects(
  raw: Record<string, unknown>,
  keyObjs: Record<string, unknown>,
): number {
  let n = 0;
  for (const letter of ALL_KEYS.split(",")) {
    const obj = raw[letter];
    if (letter.length === 1) keyObjs[letter] = obj;
    else if (letter === "SPACE") keyObjs[letter] = obj;
    const alias = KEY_ALIAS[letter];
    if (alias) keyObjs[alias] = obj;
    n += 1;
  }
  return n;
}
