/**
 * v1.4.0 전역 수치 포맷터 (마스터 프롬프트 규칙 1-1 — 유저 지시 #12)
 *  - 게임 내 모든 표시 수치는 "소수점 둘째 자리에서 반올림" → 화면에는 소수 첫째 자리까지만 노출
 *  - 예: 12.34→12.3 / 12.35→12.4 / 7→7 / 99.96→100
 *  - 내부 계산은 실수 그대로, 표시 직전에만 이 함수를 거친다. 화면마다 자체 반올림 로직 신설 금지.
 */

/** 소수 둘째 자리에서 반올림한 표시용 문자열 (정수는 소수점 없이) */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 10) / 10; // 둘째 자리에서 반올림 → 첫째 자리까지
  if (Object.is(r, -0)) return "0";
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** fmt + 천 단위 콤마 (골드/르쯔 등 큰 재화) */
export function fmtC(n: number): string {
  const r = Math.round(Number(n) * 10) / 10;
  if (!Number.isFinite(r)) return "0";
  return Number.isInteger(r)
    ? r.toLocaleString("ko-KR")
    : r.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 퍼센트 표기 (값이 이미 % 스케일) — "10.3%" */
export function fmtPct(n: number): string {
  return `${fmt(n)}%`;
}
