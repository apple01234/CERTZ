/**
 * vc184 (지시 — 액터 기반 결정적 시뮬레이션 문서 ③) — 상태 해시.
 *
 * 문서의 요구:
 *  "주기적(예: 60틱 마다)으로 액터의 상태 정보를 해시화해 StateHash 를 추출하고,
 *   서버·클라이언트 해시가 다르면 동기화 이탈(Desync)로 판정한다."
 *
 * 이 게임에서 할 수 있는 범위:
 *  위치·속도·스탯을 전부 고정소수점으로 바꾸는 건 엔진 재작성급이라 하지 않았다.
 *  대신 **비파괴적 관측**만 넣는다 — 클라이언트가 주기적으로 자기 상태 요약을 해시로
 *  보내면 서버가 들고 있는 값과 대조해 어긋난 횟수를 센다.
 *  어긋남이 잦으면 그 자체가 "동기화가 깨지고 있다"는 신호이므로 로그·통계로 남긴다.
 *  게임 진행에는 영향이 없다(판정만 하고 되돌리지 않는다) — 잘못된 되감기가
 *  정상 상태를 망치는 것이 desync 자체보다 위험하기 때문.
 *
 * 왜 좌표를 반올림해서 해시하나:
 *  부동소수점은 같은 값이라도 전송 과정에서 미세하게 달라질 수 있다. 1px 단위로
 *  양자화하면 "실제로 어긋난 것"만 잡히고 노이즈는 걸러진다.
 */

/** 상태 해시에 넣을 필드 — 위치/스테이지/레벨/직업. */
export type HashableState = {
  x: number;
  y: number;
  lv: number;
  cls: string | null;
  stage?: string;
};

/**
 * FNV-1a 32bit — 문서의 "비트 해시"에 해당. 정수 연산만 써서 플랫폼 간 결과가 같다.
 * 암호학적 해시(SHA)는 초당 여러 번 돌리기엔 무겁고, 여기선 충돌 확률만 낮으면 된다.
 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    /* 32비트 곱셈 — Math.imul 로 오버플로를 정확히 처리 */
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 상태를 정규화 문자열로 만든 뒤 해시한다. 좌표는 1px 양자화. */
export function stateHash(s: HashableState): number {
  /* 반올림 좌표 + 레벨 + 직업 + 스테이지. 순서를 고정해야 서버/클라가 같은 값을 낸다. */
  const norm = [
    Math.round(s.x),
    Math.round(s.y),
    Math.round(s.lv),
    s.cls ?? "-",
    s.stage ?? "-",
  ].join("|");
  return fnv1a(norm);
}

/** 해시를 8자리 16진수로 (로그 가독성) */
export function hashHex(h: number): string {
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * 클라이언트 측 desync 통계 — 주기적으로 남겨 "얼마나 자주 어긋나는지" 본다.
 * 서버가 해시를 돌려주면(ack) 여기 누적된다.
 */
export const desyncStats = {
  checks: 0,
  mismatches: 0,
  lastLocal: 0,
  lastRemote: 0,
  /** 최근 불일치 시각 (ms) — 디버그 표시용 */
  lastMismatchAt: 0,
  reset() {
    this.checks = 0;
    this.mismatches = 0;
    this.lastMismatchAt = 0;
  },
};

/** 서버 응답과 내 해시를 비교해 통계를 갱신한다. */
export function noteHashAck(localHash: number, remoteHash: number): boolean {
  desyncStats.checks++;
  desyncStats.lastLocal = localHash;
  desyncStats.lastRemote = remoteHash;
  const ok = (localHash >>> 0) === (remoteHash >>> 0);
  if (!ok) {
    desyncStats.mismatches++;
    desyncStats.lastMismatchAt = Date.now();
  }
  return ok;
}

/** desync 비율 (0~1) */
export function desyncRate(): number {
  return desyncStats.checks === 0 ? 0 : desyncStats.mismatches / desyncStats.checks;
}
