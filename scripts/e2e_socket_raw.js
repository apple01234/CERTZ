/* 서버 ground-truth 테스트 — 순수 socket.io 클라이언트 2대로 players 이벤트 대칭성 검증 */
const { io } = require("socket.io-client");

const URL = "http://localhost:3000";

const mkClient = (label, stage) =>
  new Promise((resolve) => {
    const s = io(URL, { path: "/socket.io", transports: ["websocket", "polling"] });
    const events = [];
    s.on("connect", () => {
      s.emit("join", { name: label, lv: 1, cls: null, x: 200, y: 300, stage });
      setTimeout(() => {
        s.emit("state", { x: 210, y: 300, flip: false, moving: false, lv: 1, cls: null, stage });
      }, 300);
    });
    s.on("players", (list) => {
      events.push({ t: Date.now(), ids: (list || []).map((p) => `${p.name}(${p.stage})`), myStage: undefined });
    });
    s.on("disconnect", (r) => events.push({ disc: r }));
    setTimeout(() => {
      resolve({ label, sid: s.id, events: events.slice(-6) });
      s.close();
    }, 3500);
  });

(async () => {
  const [a, b] = await Promise.all([mkClient("A", "village"), mkClient("B", "village")]);
  console.log("A sid:", a.sid, "| last events:", JSON.stringify(a.events.slice(-3)));
  console.log("B sid:", b.sid, "| last events:", JSON.stringify(b.events.slice(-3)));
})();
