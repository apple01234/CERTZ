/**
 * 멀티플레이 서버 설정 — 코드와 분리된 수치 (2026-11-13)
 *
 * 서버 로직을 고치지 않고 이 파일만 바꿔 운영값을 조정한다.
 * 환경변수로 덮어쓸 수 있다(배포마다 다른 값을 쓰기 위해).
 */
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

module.exports = {
  /** 방(채널) 하나의 정원. 같은 구역이라도 이 인원을 넘으면 다음 방으로 배치한다. */
  ROOM_CAP: num(process.env.SERTZ_ROOM_CAP, 50),
  /** 좌표 묶음 전송 주기(ms). 이 간격마다 바뀐 좌표만 모아 방마다 한 번 보낸다. */
  TICK_MS: num(process.env.SERTZ_TICK_MS, 100),
  /** 전체 스냅샷(이름·레벨·직업 포함) 재전송 주기(ms) — 묶음 패킷을 놓친 클라이언트 복구용. */
  SNAPSHOT_MS: num(process.env.SERTZ_SNAPSHOT_MS, 2000),
  /** 구역 정보가 없을 때의 기본 구역 */
  DEFAULT_STAGE: "village",
};
