/**
 * 패킷 직렬화 — 2026-11-13
 *
 * [왜] 종전에는 좌표가 바뀔 때마다 같은 구역 전원의 전체 정보
 *  {id(20자 소켓 id), name, lv, cls, x, y, flip, moving, stage, code, gm, t} 를
 *  접속자마다 따로 보냈다. 이동 중에 실제로 바뀌는 건 x·y·flip·moving 뿐이다.
 *
 * [어떻게] 두 종류로 나눈다.
 *  ① 스냅샷 "players"  — 방 전체의 표시 정보. 입장·전직·레벨업 때와 SNAPSHOT_MS 마다.
 *     각 항목에 짧은 번호 n 을 붙인다. 기본값(gm=false, code="")·서버 전용 값(stage, t)은 뺀다.
 *  ② 묶음 "pd"          — 틱 동안 바뀐 좌표만: { m: [[n, x, y, flags], ...], l: [n, ...] }
 *     · 키 이름 대신 배열 순서로 의미를 정한다(키 문자열 반복 제거).
 *     · 좌표는 정수로 반올림(화면은 보간하므로 소수점이 필요 없다).
 *     · flip/moving 두 불리언은 비트 하나씩 묶는다: bit0 = flip, bit1 = moving.
 *     · 빈 배열 필드는 아예 넣지 않는다.
 *  클라이언트(src/game/net.ts)는 스냅샷으로 n→플레이어 표를 만들고 묶음을 그 위에 덮어
 *  종전과 같은 플레이어 목록으로 되돌린다.
 */

const FLIP = 1;
const MOVING = 2;

/** 스냅샷 항목 — 표시에 필요한 것만 */
function metaOf(id, p) {
  const o = { id, n: p.n, name: p.name, lv: p.lv, cls: p.cls, x: Math.round(p.x), y: Math.round(p.y), flip: p.flip, moving: p.moving };
  if (p.gm) o.gm = true;
  if (p.code) o.code = p.code;
  return o;
}

/** 묶음 좌표 행 — [n, x, y, flags] */
function moveRow(p) {
  return [p.n, Math.round(p.x), Math.round(p.y), (p.flip ? FLIP : 0) | (p.moving ? MOVING : 0)];
}

/** 묶음 패킷. 보낼 것이 없으면 null */
function deltaPacket(rows, left) {
  if (!rows.length && !left.length) return null;
  const pkt = {};
  if (rows.length) pkt.m = rows;
  if (left.length) pkt.l = left;
  return pkt;
}

module.exports = { metaOf, moveRow, deltaPacket, FLIP, MOVING };
