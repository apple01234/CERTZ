/**
 * SERTZ 멀티플레이 서버 모듈 (v3.1) — server.js / FC standalone 양쪽에서 공용
 *  - attachMultiplayer(httpServer): socket.io 멀티플레이(플레이어 동기화/채팅/파티/친구) 부착
 *
 *  v3.1 분리 배경 (멀티 안됨 근본 수정):
 *   - FC 배포는 .next/standalone 의 자동생성 server.js 로 구동되어 프로젝트 커스텀
 *     server.js 의 socket.io 가 아예 실행되지 않았다 (라이브 /socket.io 404 실측).
 *   - 멀티 로직을 독립 모듈로 뽑아 FC 빌드 시 standalone 서버에 주입(postbuild)한다.
 *  - 게임 상태: 접속자 좌표/레벨/클래스 실시간 브로드캐스트 + 전체 채팅
 *  - 스테이지 기반 AOI — 같은 구역(스테이지) 접속자에게만 동기화
 *  - join 대기열 + connect 플러시, 파티 시스템(생성/참여/탈퇴/파티 채팅/보스 토벌 방송)
 */
const { Server } = require("socket.io");
/* v1.4.8 (#4 보안) — 소켓 gm 플래그 서버 검증 (계정 세션 토큰 → admin 롤 판정) */
const { isVerifiedAdmin } = require("../accounts");
const { ROOM_CAP, TICK_MS, SNAPSHOT_MS, DEFAULT_STAGE } = require("./config");
const { createRoomDirectory } = require("./rooms");
const { metaOf, moveRow, deltaPacket } = require("./packets");

function attachMultiplayer(httpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    /* v1.0.2 (#보안) — SERTZ_ORIGIN env 설정 시 해당 origin만 허용 (미설정 시 기존 동작 유지) */
    cors: { origin: process.env.SERTZ_ORIGIN || "*" },
  });

  /* ---------- 멀티플레이 방 상태 ---------- */
  /** sockId → { name, lv, cls, x, y, flip, moving, stage, t } */
  const players = new Map();
  let chatLog = [];

  /* ---------- 2026-11-13 방 나누기 + 틱 묶음 전송 ----------
   *  [종전] 좌표가 올 때마다(최소 90ms 간격) 접속자 **한 명씩** 같은 구역 전원의 전체 정보를
   *   emit 했다. 한 구역 N명이면 틱당 N번 직렬화 · N×N 항목 전송, 바뀌지 않은 사람까지 매번 보냈다.
   *  [지금]
   *   ① 방 나누기(rooms.js) — 구역마다 ROOM_CAP(50)명짜리 방. 전송은 같은 방 안에서만 일어난다.
   *   ② 틱 묶음(TICK_MS=100ms) — "state" 수신 시 바로 보내지 않고 그 방의 dirty 집합에 표시만 한다.
   *      틱마다 방 하나당 **한 번** io.to(방).emit("pd", 바뀐 좌표만) — 직렬화도 방당 1회다.
   *      0.1초 안에 같은 사람이 좌표를 여러 번 보내도 마지막 값 하나만 나간다.
   *   ③ 스냅샷(packets.js metaOf) — 이름·레벨·직업은 입장/변경 때와 SNAPSHOT_MS 마다만 방 단위로 보낸다.
   *  사람이 아무도 안 움직이는 방은 틱에 아무것도 보내지 않는다. */
  const rooms = createRoomDirectory(ROOM_CAP);
  let shortSeq = 0; // 묶음 패킷용 짧은 번호 (소켓 id 20자 대신)
  /** 방 키 → 이번 틱에 좌표가 바뀐 소켓 id */
  const dirty = new Map();
  /** 방 키 → 이번 틱에 나간 사람의 짧은 번호 */
  const left = new Map();
  /** 이번 틱에 전체 스냅샷을 다시 보낼 방 */
  const needSnapshot = new Set();

  const bucket = (map, key) => { if (!map.has(key)) map.set(key, map === dirty ? new Set() : []); return map.get(key); };

  function roomSnapshot(key) {
    const list = [];
    for (const id of rooms.members(key)) {
      const p = players.get(id);
      if (p) list.push(metaOf(id, p));
    }
    return list;
  }

  /** 소켓을 구역의 방에 넣는다(파티원이 있는 방 우선). 방이 바뀌면 socket.io room 도 옮긴다. */
  function placeInRoom(sock, stage) {
    const prefer = [];
    for (const pt of parties.values()) if (pt.members.has(sock.id)) prefer.push(...pt.members);
    const { key, prev, moved } = rooms.assign(sock.id, stage || DEFAULT_STAGE, prefer);
    if (moved) {
      if (prev) { sock.leave(prev); bucket(left, prev).push(players.get(sock.id)?.n); dirty.get(prev)?.delete(sock.id); }
      sock.join(key);
    }
    needSnapshot.add(key);
  }

  function leaveRoom(sockId, n) {
    const prev = rooms.leave(sockId);
    if (!prev) return;
    dirty.get(prev)?.delete(sockId);
    if (n != null) bucket(left, prev).push(n);
  }

  function flushTick() {
    for (const key of needSnapshot) {
      io.to(key).emit("players", roomSnapshot(key));
      dirty.delete(key); // 스냅샷에 최신 좌표가 들어 있다
    }
    for (const key of new Set([...dirty.keys(), ...left.keys()])) {
      const rows = [];
      if (!needSnapshot.has(key)) for (const id of dirty.get(key) ?? []) { const p = players.get(id); if (p) rows.push(moveRow(p)); }
      const pkt = deltaPacket(rows, needSnapshot.has(key) ? [] : (left.get(key) ?? []).filter((n) => n != null));
      if (pkt) io.to(key).emit("pd", pkt);
    }
    needSnapshot.clear();
    dirty.clear();
    left.clear();
  }
  const tick = setInterval(flushTick, TICK_MS);

  function sysChat(text) {
    const msg = { id: "sys", name: "", text: String(text).slice(0, 120), sys: true, t: Date.now() };
    chatLog.push(msg);
    chatLog = chatLog.slice(-30);
    io.emit("chat", msg); // 새 메시지 1건만 브로드캐스트 (히스토리는 접속 시 1회)
  }

  /* v2.1 친구 시스템 — 전체 접속자 요약 (코드/이름/레벨/클래스/구역) */
  function friendsPayload() {
    const list = [];
    for (const p of players.values()) {
      list.push({ code: p.code || "", name: p.name, lv: p.lv, cls: p.cls, stage: p.stage || "village" });
      if (list.length >= 300) break;
    }
    return list;
  }

  /* ---------- 파티 상태 (v2.0) ---------- */
  /** partyId → { id, leader( sockId ), max, members: Set<sockId> } */
  const parties = new Map();
  let partySeq = 0;
  const PARTY_MAX = 4;

  /* ---------- 랭킹 (v4.0.0 — 무릉도장/바르가 수비전/균열 던전 기록전) ----------
   *  메모리 저장 (서버 재시작 시 초기화) — 모드별 상위 50명 보관 */
  const RANK_MODES = new Set(["dojang", "gate", "closet", "tower"]); // v1.0.8 — 심연의 탑
  const RANK_MAX = 50;
  const rankings = { dojang: [], gate: [], closet: [], tower: [] };

  function rankTop(mode) {
    return (rankings[mode] ?? []).slice(0, 20).map((e) => ({ name: e.name, score: e.score, lv: e.lv }));
  }

  function partyPayload(p) {
    const members = [...p.members]
      .map((id) => {
        const m = players.get(id);
        return m ? { id, name: m.name, lv: m.lv, cls: m.cls, leader: id === p.leader } : null;
      })
      .filter(Boolean);
    return { id: p.id, leader: players.get(p.leader)?.name ?? "?", members, max: p.max };
  }

  function broadcastParty(partyId) {
    const p = parties.get(partyId);
    if (!p) return;
    const payload = partyPayload(p);
    for (const mid of p.members) {
      io.of("/").sockets.get(mid)?.emit("party", payload);
    }
  }

  io.on("connection", (sock) => {
    // 접속 직전 채팅 히스토리 전달
    sock.emit("chat", chatLog);

    sock.on("join", (p = {}) => {
      const known = players.has(sock.id);
      const n = known ? players.get(sock.id).n : ++shortSeq;
      players.set(sock.id, {
        n,
        name: String(p.name || "이름없음").slice(0, 8),
        lv: Math.max(1, Number(p.lv) || 1),
        cls: typeof p.cls === "string" ? p.cls : null,
        x: Number(p.x) || 200,
        y: Number(p.y) || 300,
        flip: false,
        moving: false,
        stage: typeof p.stage === "string" ? p.stage.slice(0, 24) : "village",
        code: typeof p.code === "string" ? p.code.slice(0, 12) : "",
        /* v1.0.16 — GM 계정 플래그 릴레이 (이름표/오라 코스메틱용)
         * v1.4.8 (#4 보안) — 클라 선언 gm 스푸핑 차단: 세션 토큰이 admin 계정으로 검증될 때만 릴레이 */
        gm: isVerifiedAdmin(p.token),
        t: Date.now(),
      });
      placeInRoom(sock, players.get(sock.id).stage);
      // v3.0.2 — 접속 공지는 소켓당 최초 1회만 (맵 이동마다 join으로 구역 AOI를 갱신하므로
      // 매번 "접속했습니다"가 도배되던 버그 수정)
      if (!known) sysChat(`${players.get(sock.id).name} 님이 접속했습니다`);
    });

    /* vc184 (액터 결정 문서 ③) — 상태 해시 검증.
     *  클라가 주기적으로 보낸 해시를 들고 있는 값으로 다시 계산해 대조한다.
     *  불일치는 "동기화가 어긋나고 있다"는 신호 — 되돌리지 않고 세기만 한다
     *  (잘못된 되감기가 정상 상태를 망치는 게 desync 자체보다 위험).
     *  FNV-1a 32bit — 클라 stateHash 와 동일 구현이어야 한다. */
    const hashState = (p) => {
      const norm = [Math.round(p.x), Math.round(p.y), Math.round(p.lv), p.cls ?? "-", p.stage ?? "-"].join("|");
      let h = 0x811c9dc5;
      for (let i = 0; i < norm.length; i++) {
        h ^= norm.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    };
    sock.on("hash:check", (raw = {}) => {
      const p = players.get(sock.id);
      if (!p) return;
      const local = Number(raw.h) >>> 0;
      const remote = hashState(p);
      sock.emit("hash:ack", { h: remote, ok: local === remote });
    });

    sock.on("state", (s = {}) => {
      const p = players.get(sock.id);
      if (!p) return;
      const before = [Math.round(p.x), Math.round(p.y), p.flip, p.moving, p.lv, p.cls, p.stage];
      if (Number.isFinite(s.x)) p.x = Number(s.x);
      if (Number.isFinite(s.y)) p.y = Number(s.y);
      p.flip = !!s.flip;
      p.moving = !!s.moving;
      if (Number.isFinite(s.lv)) p.lv = Math.max(1, Math.min(999, Number(s.lv))); // v1.0.2 — 비정상 레벨 표시 차단
      if (s.cls === null || typeof s.cls === "string") p.cls = s.cls;
      if (typeof s.stage === "string") p.stage = s.stage.slice(0, 24);
      /* 바뀐 것만 다음 틱에 보낸다 — 구역 변경은 방 이동, 레벨·직업은 스냅샷, 좌표는 묶음 */
      if (p.stage !== before[6]) { placeInRoom(sock, p.stage); return; }
      const key = rooms.roomOf(sock.id);
      if (!key) return;
      if (p.lv !== before[4] || p.cls !== before[5]) needSnapshot.add(key);
      else if (Math.round(p.x) !== before[0] || Math.round(p.y) !== before[1] || p.flip !== before[2] || p.moving !== before[3]) bucket(dirty, key).add(sock.id);
    });

    /* v1.0.2 (#보안) — 채팅 도배 레이트리밋 (소켓별 8통/5초) */
    let chatWin = 0, chatN = 0;
    sock.on("chat", (raw) => {
      const now = Date.now();
      if (now - chatWin > 5000) { chatWin = now; chatN = 0; }
      if (++chatN > 8) return;
      const p = players.get(sock.id);
      const text = String(raw ?? "").trim().slice(0, 80);
      if (!p || !text) return;
      const msg = { id: sock.id, name: p.name, text, t: Date.now() };
      chatLog.push(msg);
      chatLog = chatLog.slice(-30);
      io.emit("chat", msg); // 새 메시지 1건만 브로드캐스트 (히스토리는 접속 시 1회)
    });

    /* v4.1.0 — 공격/스킬 코스메틱 릴레이 (파티원 공격 보임)
     *  같은 구역(AOI) 플레이어에게만 전달, 보낸 사람 제외. 페이로드 화이트리스트로 위생 처리 */
    const ACT_KINDS = new Set(["atk", "s1", "s2", "s3", "s4", "s5"]);
    sock.on("act", (raw = {}) => {
      const p = players.get(sock.id);
      if (!p || !ACT_KINDS.has(raw.kind)) return;
      const payload = {
        id: sock.id,
        kind: raw.kind,
        x: Math.max(-9999, Math.min(99999, Number(raw.x) || 0)),
        y: Math.max(-9999, Math.min(99999, Number(raw.y) || 0)),
        flip: !!raw.flip,
        cls: typeof raw.cls === "string" ? raw.cls.slice(0, 16) : null,
      };
      /* 같은 방(AOI)에만, 보낸 사람 제외 — 종전엔 전체 소켓을 돌며 구역을 비교했다 */
      const key = rooms.roomOf(sock.id);
      if (key) sock.to(key).emit("act", payload);
    });

    sock.on("job", (cls) => {
      const p = players.get(sock.id);
      if (!p || typeof cls !== "string") return;
      p.cls = cls;
      const key = rooms.roomOf(sock.id);
      if (key) needSnapshot.add(key);
      const names = {
        warrior: "전사", ranger: "궁수", mage: "마법사",
        berserker: "버서커", guardian: "가디언",
        sniper: "스나이퍼", windrunner: "윈드러너",
        archmage: "아크메이지", sage: "세이지",
        warlord: "워로드", paladin: "팔라딘",
        eagleeye: "이글아이", tempest: "템페스트",
        stormbringer: "스톰브링어", chronicle: "크로니컬",
      };
      sysChat(`${p.name} 님이 ${names[cls] || cls}(으)로 전직했습니다!`);
    });

    /* ---------- 파티 (v2.0 — 지시 #5) ---------- */
    sock.on("party:create", () => {
      const p = players.get(sock.id);
      if (!p) return;
      // 이미 가입한 파티가 있으면 무시
      for (const pt of parties.values()) {
        if (pt.members.has(sock.id)) { sock.emit("party", partyPayload(pt)); return; }
      }
      const id = `P${++partySeq}`;
      parties.set(id, { id, leader: sock.id, max: PARTY_MAX, members: new Set([sock.id]) });
      sock.emit("party", partyPayload(parties.get(id)));
      sysChat(`${p.name} 님이 파티를 창설했습니다 — 코드 ${id}`);
    });

    sock.on("party:join", (rawId) => {
      const p = players.get(sock.id);
      const id = String(rawId ?? "").trim().toUpperCase();
      const pt = parties.get(id);
      if (!p || !pt) {
        sock.emit("party:error", "없는 파티 코드예요");
        if (![...parties.values()].some((party) => party.members.has(sock.id))) sock.emit("party", null);
        return;
      }
      if (pt.members.has(sock.id)) { sock.emit("party", partyPayload(pt)); return; }
      if (pt.members.size >= pt.max) { sock.emit("party:error", "파티가 가득 찼어요 (최대 4인)"); return; }
      // 다른 파티 가입 중이면 먼저 탈퇴
      for (const other of parties.values()) {
        other.members.delete(sock.id);
        if (other.members.size === 0) parties.delete(other.id);
        else {
          if (other.leader === sock.id) other.leader = [...other.members][0];
          broadcastParty(other.id);
        }
      }
      pt.members.add(sock.id);
      broadcastParty(pt.id);
      sysChat(`${p.name} 님이 파티 ${id}에 참여했습니다 (${pt.members.size}/${pt.max})`);
    });

    sock.on("party:leave", () => {
      for (const pt of parties.values()) {
        if (!pt.members.has(sock.id)) continue;
        pt.members.delete(sock.id);
        if (pt.members.size === 0) {
          parties.delete(pt.id);
        } else {
          if (pt.leader === sock.id) pt.leader = [...pt.members][0];
          broadcastParty(pt.id);
        }
      }
      sock.emit("party", null);
    });

    sock.on("party:chat", (raw) => {
      const p = players.get(sock.id);
      const text = String(raw ?? "").trim().slice(0, 80);
      if (!p || !text) return;
      const msg = { id: sock.id, name: p.name, text, party: true, t: Date.now() };
      for (const pt of parties.values()) {
        if (pt.members.has(sock.id)) {
          for (const mid of pt.members) {
            io.of("/").sockets.get(mid)?.emit("chat", msg);
          }
          break;
        }
      }
    });

    /** 보스 출현/토벌 방송 — 파티원 전체 공지 (지시 #5 보스 토벌 콘텐츠) */
    sock.on("boss:announce", (b = {}) => {
      const p = players.get(sock.id);
      if (!p) return;
      const name = String(b.name ?? "").slice(0, 24);
      const stage = String(b.stage ?? "").slice(0, 24);
      if (!name) return;
      for (const pt of parties.values()) {
        if (!pt.members.has(sock.id)) continue;
        for (const mid of pt.members) {
          if (mid === sock.id) continue;
          io.of("/").sockets.get(mid)?.emit("chat", {
            id: "sys", name: "", sys: true, t: Date.now(),
            text: `[파티] ${p.name} — ${stage}에서 ${name}와 조우!`,
          });
        }
        break;
      }
    });

    /* ---------- v4.0.0 — 랭킹 (기록 제출/조회) ---------- */
    sock.on("rank:submit", (r = {}) => {
      const p = players.get(sock.id);
      const mode = RANK_MODES.has(r.mode) ? r.mode : null;
      const score = Math.max(0, Math.floor(Number(r.score) || 0));
      if (!mode || score <= 0) return;
      /* v1.0.2 (#보안) — 모드별 물리 상한 (현실 도달 불가능한 변조 점수 슬라이스) */
      const RANK_SCORE_CAP = { dojang: 5000000, gate: 200, closet: 100000, tower: 100000 };
      if (score > RANK_SCORE_CAP[mode]) return;
      const name = String(r.name || (p ? p.name : "이름없음")).slice(0, 8);
      const lv = Math.max(1, Math.floor(Number(r.lv) || (p ? p.lv : 1)));
      const list = rankings[mode];
      const existing = list.find((e) => e.name === name);
      if (existing) {
        if (score > existing.score) { existing.score = score; existing.lv = lv; existing.t = Date.now(); }
      } else {
        list.push({ name, score, lv, t: Date.now() });
      }
      list.sort((a, b) => b.score - a.score);
      rankings[mode] = list.slice(0, RANK_MAX);
      /* 제출자에게 최신 랭킹 즉시 회신 */
      sock.emit("rank:top", mode, rankTop(mode));
      /* 신기록 진입 시 전체 방송 (상위 10 진입만 — 도배 방지) */
      const idx = rankings[mode].findIndex((e) => e.name === name);
      if (idx >= 0 && idx < 10) {
        sysChat(`[랭킹] ${name} 님이 ${mode === "dojang" ? "무릉도장" : mode === "gate" ? "바르가 수비전" : mode === "tower" ? "심연의 탑" : "균열 던전"} ${idx + 1}위 기록 달성!`);
      }
    });

    sock.on("rank:top", (rawMode) => {
      const mode = RANK_MODES.has(rawMode) ? rawMode : null;
      if (!mode) return;
      sock.emit("rank:top", mode, rankTop(mode));
    });

    sock.on("disconnect", () => {
      const p = players.get(sock.id);
      if (p) sysChat(`${p.name} 님이 접속을 종료했습니다`);
      leaveRoom(sock.id, p?.n);
      players.delete(sock.id);
      for (const pt of parties.values()) {
        if (!pt.members.has(sock.id)) continue;
        pt.members.delete(sock.id);
        if (pt.members.size === 0) parties.delete(pt.id);
        else {
          if (pt.leader === sock.id) pt.leader = [...pt.members][0];
          broadcastParty(pt.id);
        }
      }
    });
  });

  /* v2.1 하트비트 동기화 (2초) — join/이동 브로드캐스트를 놓친 클라이언트 자동 복구
   *  (증상: 먼저 접속한 클라이언트가 나중 접속자를 영원히 못 보는 문제 — 가만히 있으면 트래픽 0)
   *  friends 목록도 같은 주기로 전파 (친구 온라인 표시용) */
  const heartbeat = setInterval(() => {
    if (players.size === 0) return;
    for (const key of rooms.keys()) needSnapshot.add(key); // 방 단위 전체 스냅샷 (다음 틱에 1회씩)
    io.emit("friends", friendsPayload());
    for (const party of parties.values()) broadcastParty(party.id);
  }, 2000);

  return { io, heartbeat, tick };
}

module.exports = { attachMultiplayer };
