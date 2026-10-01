/**
 * standalone 서버 멀티플레이 실측 테스트 — 2클라이언트 시나리오
 *  1. HTTP 폴링 핸드셰이크 (/socket.io 404 아님 확인)
 *  2. 클라 A join → 클라 B join → B 가 A 를 players 목록에서 보는지
 *  3. 채팅 송수신 + 파티 생성/참여
 *  사용: node scripts/test_multi_standalone.js [http://localhost:3100]
 */
const { io } = require("socket.io-client");

const URL = process.argv[2] || "http://localhost:3100";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function handshakeRaw() {
  return fetch(`${URL}/socket.io/?EIO=4&transport=polling`)
    .then(async (r) => {
      const body = await r.text();
      return { status: r.status, ok: r.status === 200 && body.startsWith("0{"), body: body.slice(0, 60) };
    })
    .catch((e) => ({ status: 0, ok: false, body: String(e) }));
}

function connectClient() {
  return new Promise((resolve, reject) => {
    const sock = io(URL, { path: "/socket.io", transports: ["websocket", "polling"], reconnection: false });
    const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
    sock.on("connect", () => { clearTimeout(t); resolve(sock); });
    sock.on("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}

function once(sock, ev, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`'${ev}' 대기 timeout`)), timeout);
    sock.once(ev, (d) => { clearTimeout(t); resolve(d); });
  });
}

(async () => {
  // 1) raw handshake
  const hs = await handshakeRaw();
  check("HTTP 폴링 핸드셰이크 200", hs.ok, `status=${hs.status} body=${hs.body}`);

  // 2) 두 클라이언트 접속 + join
  const A = await connectClient();
  const B = await connectClient();
  check("websocket 클라 A 접속", A.connected, `id=${A.id}`);
  check("websocket 클라 B 접속", B.connected, `id=${B.id}`);

  A.emit("join", { name: "세르츠A", lv: 7, cls: "warrior", x: 100, y: 200, stage: "village" });
  const bPlayers = once(B, "players", 6000);
  await new Promise((r) => setTimeout(r, 300));
  B.emit("join", { name: "세르츠B", lv: 5, cls: "mage", x: 150, y: 250, stage: "village" });

  const playersSeenByB = await bPlayers;
  const aInList = playersSeenByB.some((p) => p.name === "세르츠A");
  check("B가 A를 players 목록에서 확인", aInList, `players=${playersSeenByB.map((p) => p.name).join(",")}`);

  // 3) 이동 state 동기화 — join 시점 브로드캐스트가 밀릴 수 있어 x=555 수신까지 수집
  await new Promise((r) => setTimeout(r, 600));
  A.emit("state", { x: 555, y: 666, flip: true, moving: true, lv: 8, cls: "warrior", stage: "village" });
  const moved = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 6000);
    const onP = (list) => {
      const a = list.find((p) => p.name === "세르츠A");
      if (a && a.x === 555 && a.lv === 8) { clearTimeout(t); B.off("players", onP); resolve(a); }
    };
    B.on("players", onP);
  });
  check("A 이동 state가 B에 동기화", !!moved && moved.x === 555 && moved.lv === 8, moved ? `x=${moved.x} lv=${moved.lv}` : "not found");

  // 4) 채팅 — 이전 시스템 메시지를 건너뛰고 테스트 메시지 매칭
  await new Promise((r) => setTimeout(r, 300));
  const chat = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 6000);
    const onC = (m) => {
      if (m && m.text === "멀티 테스트 메시지" && m.name === "세르츠A") { clearTimeout(t); B.off("chat", onC); resolve(m); }
    };
    B.on("chat", onC);
    A.emit("chat", "멀티 테스트 메시지");
  });
  check("A→B 채팅 수신", chat && chat.text === "멀티 테스트 메시지" && chat.name === "세르츠A", JSON.stringify(chat).slice(0, 80));

  // 5) 파티 생성/참여
  const aParty = once(A, "party", 6000);
  A.emit("party:create");
  const pa = await aParty;
  check("A 파티 생성", !!pa && !!pa.id, `party=${pa && pa.id}`);
  const bParty = once(B, "party", 6000);
  B.emit("party:join", pa.id);
  const pb = await bParty;
  check("B 파티 참여 (멤버 2명)", !!pb && pb.members.length === 2, `members=${pb && pb.members.map((m) => m.name).join(",")}`);

  // 6) 스테이지 AOI — 다른 스테이지로 이동하면 players 목록에서 사라져야 함
  await new Promise((r) => setTimeout(r, 600));
  A.emit("state", { x: 1, y: 1, flip: false, moving: false, lv: 8, cls: "warrior", stage: "forest" });
  await new Promise((r) => setTimeout(r, 1500)); // 하트비트(2초 주기) 브로드캐스트 반영 대기
  const afterMove = await new Promise((resolve) => {
    const onP = (list) => resolve(list);
    B.once("players", onP);
    setTimeout(() => { B.off("players", onP); resolve([]); }, 2500);
  });
  const aGone = !afterMove.some((p) => p.name === "세르츠A");
  check("AOI: 다른 스테이지 이동 시 B 목록에서 A 제외", aGone, `players=${(afterMove || []).map((p) => p.name).join(",")}`);

  A.close();
  B.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n결과: ${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error("테스트 실행 실패:", e);
  process.exit(1);
});
