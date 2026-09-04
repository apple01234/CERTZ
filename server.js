/**
 * SERTZ 커스텀 서버 (v2.0) — Next.js + socket.io 멀티플레이
 *  - `npm run dev` / `npm start` 모두 이 서버를 사용 (기존 워크플로 유지)
 *  - 게임 상태: 접속자 좌표/레벨/클래스 실시간 브로드캐스트 + 전체 채팅
 *  - v2.0 (지시 #9/#15 최적화): 스테이지 기반 AOI — 같은 구역(스테이지) 접속자에게만 동기화
 *  - v2.0 (지시 #14): join 전 채팅 폐기 문제 — join 대기열 + connect 플러시 (클라 net.ts)
 *  - v2.0 (지시 #5): 파티 시스템 (생성/참여/탈퇴/파티 채팅/보스 토벌 방송)
 */
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  /* v3.0.24: 배포 APK 직접 다운로드 — 140MB 단일 파일이 파일 패널 한도 초과로 미표시되어
 *  게임 서버(http://<서버주소>/SERTZ-v3.0.28.apk)에서 브라우저 다운로드를 제공 */
const { createReadStream, statSync } = require("node:fs");
const path = require("node:path");
const DOWNLOAD_FILES = {
  "/SERTZ-v3.0.28.apk": {
    file: "download/SERTZ-v3.0.28.apk",
    type: "application/vnd.android.package-archive",
    attach: true,
  },
  "/APK_download_guide.txt": {
    file: "download/APK_다운로드_안내.txt",
    type: "text/plain; charset=utf-8",
    attach: false,
  },
};
const httpServer = createServer((req, res) => {
  const url = (req.url || "").split("?")[0];
  /* v3.0.28 — 구버전 APK 링크(v3.0.24~27)를 최신본으로 자동 연결 (404 방지) */
  if (/^\/SERTZ-v3\.0\.(2[4-7])\.apk$/.test(url)) {
    res.writeHead(307, { Location: "/SERTZ-v3.0.28.apk" }).end();
    return;
  }
  const entry = DOWNLOAD_FILES[url];
  if (entry) {
    try {
      const fp = path.join(__dirname, entry.file);
      const size = statSync(fp).size;
      res.writeHead(200, {
        "Content-Type": entry.type,
        "Content-Length": size,
        ...(entry.attach
          ? { "Content-Disposition": 'attachment; filename="SERTZ-v3.0.28.apk"' }
          : {}),
      });
      createReadStream(fp).pipe(res);
      return;
    } catch (e) {
      res.writeHead(404).end("not found");
      return;
    }
  }
  handle(req, res);
});

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*" },
  });

  /* ---------- 멀티플레이 방 상태 ---------- */
  /** sockId → { name, lv, cls, x, y, flip, moving, stage, t } */
  const players = new Map();
  let chatLog = [];

  const playerList = () =>
    [...players.entries()].map(([id, p]) => ({ id, ...p }));

  let lastBroadcast = 0;
  let broadcastTimer = null;
  function broadcastPlayers(force = false) {
    const now = Date.now();
    if (!force && now - lastBroadcast < 90) {
      if (!broadcastTimer) {
        broadcastTimer = setTimeout(() => {
          broadcastTimer = null;
          broadcastPlayers(true);
        }, 90);
      }
      return;
    }
    lastBroadcast = now;
    /* v2.0 AOI — 스테이지별로 그룹핑해 같은 구역 플레이어에게만 전송 (페이로드 절감) */
    const byStage = new Map();
    for (const [id, p] of players) {
      const key = p.stage || "village";
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key).push({ id, ...p });
    }
    for (const [id, sock] of io.of("/").sockets) {
      const me = players.get(id);
      const list = byStage.get(me?.stage || "village") || [];
      sock.emit("players", list);
    }
  }

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

  function partyPayload(p) {
    const members = [...p.members]
      .map((id) => players.get(id))
      .filter(Boolean)
      .map((m) => ({ id: m.id, name: m.name, lv: m.lv, cls: m.cls }));
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
      players.set(sock.id, {
        name: String(p.name || "이름없음").slice(0, 8),
        lv: Math.max(1, Number(p.lv) || 1),
        cls: typeof p.cls === "string" ? p.cls : null,
        x: Number(p.x) || 200,
        y: Number(p.y) || 300,
        flip: false,
        moving: false,
        stage: typeof p.stage === "string" ? p.stage.slice(0, 24) : "village",
        code: typeof p.code === "string" ? p.code.slice(0, 12) : "",
        t: Date.now(),
      });
      broadcastPlayers(true);
      // v3.0.2 — 접속 공지는 소켓당 최초 1회만 (맵 이동마다 join으로 구역 AOI를 갱신하므로
      // 매번 "접속했습니다"가 도배되던 버그 수정)
      if (!known) sysChat(`${players.get(sock.id).name} 님이 접속했습니다`);
    });

    sock.on("state", (s = {}) => {
      const p = players.get(sock.id);
      if (!p) return;
      if (Number.isFinite(s.x)) p.x = Number(s.x);
      if (Number.isFinite(s.y)) p.y = Number(s.y);
      p.flip = !!s.flip;
      p.moving = !!s.moving;
      if (Number.isFinite(s.lv)) p.lv = Math.max(1, Number(s.lv));
      if (s.cls === null || typeof s.cls === "string") p.cls = s.cls;
      if (typeof s.stage === "string") p.stage = s.stage.slice(0, 24);
      broadcastPlayers();
    });

    sock.on("chat", (raw) => {
      const p = players.get(sock.id);
      const text = String(raw ?? "").trim().slice(0, 80);
      if (!p || !text) return;
      const msg = { id: sock.id, name: p.name, text, t: Date.now() };
      chatLog.push(msg);
      chatLog = chatLog.slice(-30);
      io.emit("chat", msg); // 새 메시지 1건만 브로드캐스트 (히스토리는 접속 시 1회)
    });

    sock.on("job", (cls) => {
      const p = players.get(sock.id);
      if (!p || typeof cls !== "string") return;
      p.cls = cls;
      broadcastPlayers(true);
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
        if (pt.members.has(sock.id)) return;
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
        sock.emit("party", null);
        return;
      }
      if (pt.members.size >= pt.max || pt.members.has(sock.id)) return;
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

    sock.on("disconnect", () => {
      const p = players.get(sock.id);
      if (p) sysChat(`${p.name} 님이 접속을 종료했습니다`);
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
      broadcastPlayers(true);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> SERTZ 서버 준비됨 — http://localhost:${port} (멀티플레이 소켓 + 파티 + 친구 포함)`);
  });

  /* v2.1 하트비트 동기화 (2초) — join/이동 브로드캐스트를 놓친 클라이언트 자동 복구
   *  (증상: 먼저 접속한 클라이언트가 나중 접속자를 영원히 못 보는 문제 — 가만히 있면 트래픽 0)
   *  friends 목록도 같은 주기로 전파 (친구 온라인 표시용) */
  setInterval(() => {
    if (players.size === 0) return;
    broadcastPlayers(true);
    io.emit("friends", friendsPayload());
  }, 2000);
});
