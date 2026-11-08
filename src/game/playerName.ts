/**
 * 캐릭터 이름 검증 — 클라이언트·서버 **단일 출처**
 *
 * 왜 뽑았나
 *   이름을 받는 곳이 세 군데(Overlays 이름 패널 / Lobby 캐릭터 생성 / AuthPanel 가입)인데
 *   규칙이 전부 달랐다:
 *     · Overlays  : maxLength=8, 필터 없음 → 공백만·제어문자도 통과
 *     · Lobby     : trim().length >= 1 → **1자 통과**. 그런데 서버(claimname)는 2자 미만을 400으로 거부
 *     · AuthPanel : maxLength=8, 검증 없음
 *   그래서 1자를 넣으면 화면에서는 "다음"이 활성화되고 서버에서 400이 떨어졌다 —
 *   사용자에게는 "이름이 안 만들어짐"으로만 보이는 증상(요구사항 6.1).
 *
 * 무엇
 *   · normalizeName — 제어문자/제로폭 제거 + trim + 8자 절단 (서버가 하던 정화를 그대로)
 *   · validateName  — 규칙 판정 + 사용자에게 보여줄 한국어 사유
 *   · NAME_MIN / NAME_MAX — 렌더(maxLength 등)에서 쓰는 상수
 *
 * 규칙 (클라·서버 공통)
 *   · 2~8자 (공백 제거 후)
 *   · 공백만 / 빈 문자열 불가
 *   · 제어문자·제로폭 문자 불가 (정화 후 남는 것으로 판정)
 *   · 한글·영문·숫자 혼합 허용. **숫자 0-9 는 명시적으로 허용**한다
 *     ("숫자를 못 쓴다"는 제보는 재현되지 않았다 — 원인은 위의 1자 통과 불일치였다)
 *
 * 계약
 *   · Phaser / DOM / Math.random 의존 없음 — Node 테스트에서 그대로 import 한다.
 *   · 서버(route.ts)도 이 파일을 import 하므로 여기 규칙을 바꾸면 양쪽이 함께 바뀐다.
 */

/** 최소 길이 — 서버 claimname 의 `name.length < 2` 와 동일해야 한다. */
export const NAME_MIN = 2;
/** 최대 길이 — 입력 maxLength / 서버 slice(0,8) 와 동일해야 한다. */
export const NAME_MAX = 8;

/** 제어문자 + 제로폭 문자. 서버 claimname 이 쓰던 집합과 **정확히 같게** 유지한다. */
const BAD_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g;

/** 정화 — 제어문자/제로폭 제거 → trim → NAME_MAX 자 절단. */
export function normalizeName(raw: unknown): string {
  return String(raw ?? "").replace(BAD_CHARS, "").trim().slice(0, NAME_MAX);
}

export type NameCheck =
  | { ok: true; name: string }
  | { ok: false; name: string; reason: "empty" | "tooShort" | "tooLong"; message: string };

/**
 * 이름 검증. `ok:true` 면 `name` 은 **정화된 값**이라 그대로 저장/전송하면 된다.
 * 실패 사유는 UI 문구로 바로 쓸 수 있게 한국어 message 를 함께 준다.
 */
export function validateName(raw: unknown): NameCheck {
  const name = normalizeName(raw);
  if (!name) return { ok: false, name, reason: "empty", message: "이름을 입력해 주세요" };
  /* code point 기준 길이 — 이모지/서로게이트 페어를 1자로 센다(서버 slice 와는 다를 수 있으나
   * 사용자 체감("두 글자 이상")을 우선한다. 저장은 정화된 문자열 그대로). */
  const len = [...name].length;
  if (len < NAME_MIN) {
    return { ok: false, name, reason: "tooShort", message: `이름은 ${NAME_MIN}~${NAME_MAX}자로 입력해 주세요` };
  }
  /* normalizeName 이 이미 NAME_MAX 로 자르므로 tooLong 은 실질적으로 발생하지 않는다.
   * 그래도 규칙을 명시해 두면 나중에 normalize 정책이 바뀌어도 판정이 함께 따라간다. */
  if (len > NAME_MAX) {
    return { ok: false, name, reason: "tooLong", message: `이름은 ${NAME_MIN}~${NAME_MAX}자로 입력해 주세요` };
  }
  return { ok: true, name };
}

/** 한 줄 편의 — UI 의 disabled 판정용. */
export function isNameValid(raw: unknown): boolean {
  return validateName(raw).ok;
}
