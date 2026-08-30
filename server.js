/**
 * SERTZ 커스텀 서버 (v1.7) — Next.js + socket.io 멀티플레이
 *  - `npm run dev` / `npm start` 모두 이 서버를 사용 (기존 워크플로 유지)
 *  - 게임 상태: 접속자 좌표/레벨/클래스 실시간 브로드캐스트 + 전체 채팅
 */
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*" },
  });

  /* ---------- 멀티플레이 방 상태 ---------- */
  /** sockId → { name, lv, cls, x, y, flip, moving, t } */
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
    io.emit("players", playerList());
  }

  function sysChat(text) {
    const msg = { id: "sys", name: "", text: String(text).slice(0, 120), sys: true, t: Date.now() };
    chatLog.push(msg);
    chatLog = chatLog.slice(-30);
    io.emit("chat", msg); // 새 메시지 1건만 브로드캐스트 (히스토리는 접속 시 1회)
  }

  io.on("connection", (sock) => {
    // 접속 직전 채팅 히스토리 전달
    sock.emit("chat", chatLog);

    sock.on("join", (p = {}) => {
      players.set(sock.id, {
        name: String(p.name || "이름없음").slice(0, 8),
        lv: Math.max(1, Number(p.lv) || 1),
        cls: typeof p.cls === "string" ? p.cls : null,
        x: Number(p.x) || 200,
        y: Number(p.y) || 300,
        flip: false,
        moving: false,
        t: Date.now(),
      });
      broadcastPlayers(true);
      sysChat(`${players.get(sock.id).name} 님이 접속했습니다`);
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
      const names = { warrior: "전사", ranger: "궁수", mage: "마법사" };
      sysChat(`${p.name} 님이 ${names[cls] || cls}(으)로 전직했습니다!`);
    });

    sock.on("disconnect", () => {
      const p = players.get(sock.id);
      if (p) sysChat(`${p.name} 님이 접속을 종료했습니다`);
      players.delete(sock.id);
      broadcastPlayers(true);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> SERTZ 서버 준비됨 — http://localhost:${port} (멀티플레이 소켓 포함)`);
  });
});
