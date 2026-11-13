/**
 * 방 나누기(Room Partitioning) — 2026-11-13
 *
 * [왜] 같은 구역에 N명이 있으면 한 명의 이동이 N-1명에게 가야 하므로 전송량이 N² 로 는다.
 *  100명이면 50명일 때의 4배다. 구역(stage)마다 정원(ROOM_CAP)짜리 방을 여러 개 두면
 *  방 하나의 전송량은 정원² 에서 멈추고, 인원이 늘면 방 개수만 선형으로 는다.
 *
 * [어떻게]
 *  · 방 키는 `${구역}#${번호}` (예: village#0, village#1). socket.io 의 room 이름으로 그대로 쓴다.
 *  · 입장 시: ① 같은 구역에서 함께 있고 싶은 사람(파티원)이 있는 방에 자리가 있으면 그 방
 *            ② 아니면 번호가 가장 낮은, 자리가 남은 방  ③ 다 차 있으면 새 방
 *    → 낮은 번호부터 채우므로 사람이 흩어지지 않고, 빈자리가 생기면 다음 입장자가 메운다.
 *  · 같은 구역으로 다시 입장하면(맵 재입장·하트비트) 방을 옮기지 않는다.
 *  · 퇴장으로 빈 방은 끝 번호부터 정리한다(중간 번호는 남겨 키가 바뀌지 않게).
 *
 * ponytail: 방 사이 재배치(인원이 줄었을 때 방 합치기)는 하지 않는다. 필요해지면
 *  leave() 뒤에 "가장 높은 번호 방의 인원을 낮은 번호 빈자리로 옮기는" 단계를 추가한다.
 */

function createRoomDirectory(cap) {
  /** 구역 → 방 배열 (인덱스 = 방 번호, 값 = 그 방 소켓 id 집합) */
  const byStage = new Map();
  /** 소켓 id → { stage, n, key } */
  const where = new Map();

  const keyOf = (stage, n) => `${stage}#${n}`;

  function leave(id) {
    const at = where.get(id);
    if (!at) return null;
    where.delete(id);
    const list = byStage.get(at.stage);
    list[at.n].delete(id);
    while (list.length && list[list.length - 1].size === 0) list.pop();
    if (!list.length) byStage.delete(at.stage);
    return at.key;
  }

  /**
   * 소켓을 구역의 방에 배치한다.
   * @param {string} id 소켓 id
   * @param {string} stage 구역 키
   * @param {string[]} prefer 같은 방에 있고 싶은 소켓 id 목록(파티원)
   * @returns {{ key: string, prev: string|null, moved: boolean }}
   */
  function assign(id, stage, prefer = []) {
    const cur = where.get(id);
    if (cur && cur.stage === stage) return { key: cur.key, prev: cur.key, moved: false };
    const prev = leave(id);
    if (!byStage.has(stage)) byStage.set(stage, []);
    const list = byStage.get(stage);
    let n = -1;
    for (const other of prefer) {
      const o = where.get(other);
      if (o && o.stage === stage && list[o.n].size < cap) { n = o.n; break; }
    }
    if (n < 0) n = list.findIndex((s) => s.size < cap);
    if (n < 0) { list.push(new Set()); n = list.length - 1; }
    list[n].add(id);
    const key = keyOf(stage, n);
    where.set(id, { stage, n, key });
    return { key, prev, moved: true };
  }

  /** 방 키 → 그 방 소켓 id 목록 */
  function members(key) {
    const i = key.lastIndexOf("#");
    const list = byStage.get(key.slice(0, i));
    return list?.[Number(key.slice(i + 1))] ? [...list[Number(key.slice(i + 1))]] : [];
  }

  /** 현재 존재하는 모든 방 키 */
  function keys() {
    const out = [];
    for (const [stage, list] of byStage) list.forEach((s, n) => { if (s.size) out.push(keyOf(stage, n)); });
    return out;
  }

  return { assign, leave, members, keys, roomOf: (id) => where.get(id)?.key ?? null };
}

module.exports = { createRoomDirectory };
