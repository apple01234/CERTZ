/** 멀티플레이 실측 진단 — 가상 클라이언트 2대가 같은 구역에서 서로를 보는지 검사 */
const { io } = require("socket.io-client");

const URL = "http://localhost:3000";

function client(name, stage) {
  const s = io(URL, { path: "/socket.io", transports: ["websocket", "polling"] });
  const st = { s, name, stage, seen: new Set(), chat: [] };
  s.on("connect", () => {
    s.emit("join", { name, lv: 5, cls: "warrior", x: 200, y: 300, stage, code: "TEST" + name });
    s.emit("state", { x: 250, y: 320, flip: false, moving: true, lv: 5, cls: "warrior", stage });
  });
  s.on("players", (list) => {
    for (const p of list) if (p.name !== name) st.seen.add(p.name);
  });
  s.on("chat", (m) => st.chat.push(m));
  return st;
}

(async () => {
  const a = client("AliceT", "forest1");
  const b = client("BobT", "forest1");
  const c = client("CarolT", "kingdom1"); // 다른 구역 — AOI로 안 보여야 정상

  await new Promise((r) => setTimeout(r, 3000));
  b.s.emit("chat", "안녕 Alice!");

  await new Promise((r) => setTimeout(r, 1500));

  console.log("[diag] Alice sees:", [...a.seen]);
  console.log("[diag] Bob sees:", [...b.seen]);
  console.log("[diag] Carol(sees others in kingdom1):", [...c.seen]);
  console.log("[diag] Alice chat count:", a.chat.length, "| has Bob msg:", a.chat.some((m) => m.text === "안녕 Alice!"));
  console.log("[diag] Bob connected:", b.s.connected, "| socket transport:", b.s.io.engine.transport.name);

  a.s.disconnect(); b.s.disconnect(); c.s.disconnect();
  process.exit(0);
})();
