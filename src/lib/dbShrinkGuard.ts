/**
 * 원격 DB 축소 가드 — 사고 재발 방지.
 *
 * [실제 사고 이력]
 *  2026-11-05 05:37  db-backup/lilac-v2/accounts.enc = 14,100B (계정 2명 + 토큰 9 + 세이브 1)
 *  2026-11-05 07:31  같은 파일 = 964B  ← **93% 축소**
 *  → 이후 운영 전체가 500. 원인은 `DB 복호화 실패 — 키 불일치?`
 *     (964B 는 시드 계정만 든 DB 를 **다른 키**로 암호화한 것이라 현재 키로 안 열린다)
 *
 *  vc245 에서 "키가 없으면 원격 쓰기 거부"(`isRemoteSafeKey`) 가드를 넣었지만
 *  그건 **키 부재**만 막는다. 이번 사고는 키가 *있는데 다른 값*이었던 경우라
 *  그 가드를 통과했다. 즉 가드의 전제가 틀렸다.
 *
 * [이 가드의 원칙]
 *  키가 틀렸는지는 **쓰기 전에 알 수 없다.** 그래서 키 대신 **크기**를 본다.
 *  정상 DB 는 계정·세이브가 늘기만 하고 급감하지 않는다. 한 번의 요청으로
 *  절반 이하로 줄어드는 것은 사고(시드 덮어쓰기·복호화 실패 후 초기화)이거나
 *  관리자의 의도적 초기화뿐이다. 후자는 명시적 플래그로 허용한다.
 */

/** 축소 허용 하한 — 기존 크기의 이 비율 미만이면 거부 */
export const SHRINK_FLOOR_RATIO = 0.5;

export type ShrinkCheck = { ok: true } | { ok: false; reason: string };

/**
 * 새 내용을 원격에 써도 되는지 판정한다.
 *
 * @param prevBytes  현재 원격 파일 크기(바이트). 0/undefined = 원격에 파일 없음(첫 생성) → 허용
 * @param nextText   쓰려는 base64 텍스트 (문자 수 = 파일 크기)
 * @param allowReset 관리자 의도적 초기화 플래그
 */
export function allowRemoteWrite(
  prevBytes: number | null | undefined,
  nextText: string,
  allowReset = false
): ShrinkCheck {
  /* 원격에 파일이 없으면(=첫 생성) 축소 개념이 없다. 단 빈 내용은 막는다. */
  if (!nextText || nextText.length < 32) {
    return { ok: false, reason: "빈 DB 쓰기는 거부됩니다" };
  }
  if (!prevBytes || prevBytes <= 0) return { ok: true };
  if (allowReset) return { ok: true };

  const ratio = nextText.length / prevBytes;
  if (ratio < SHRINK_FLOOR_RATIO) {
    const pct = (ratio * 100).toFixed(1);
    return {
      ok: false,
      reason:
        `DB 가 ${prevBytes}B → ${nextText.length}B (${pct}%) 로 급감해 쓰기를 거부했습니다. ` +
        `키가 다른 서버가 시드본으로 덮어쓰는 사고를 막기 위한 가드입니다. ` +
        `의도된 초기화라면 allowReset 을 지정하세요.`,
    };
  }
  return { ok: true };
}
