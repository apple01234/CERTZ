/* MQTT 공개 브로커 연결 실측 — 유저 제보 "서로 캐릭터/스킬 안보임" 진단 */
import mqtt from "mqtt";

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://mqtt.eclipseprojects.io:443/mqtt",
];
const ROOT = "sertz/mp/v2/";

async function testBroker(url, idx) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    const done = (ok, extra = "") => {
      if (settled) return;
      settled = true;
      console.log(`[${idx}] ${url} → ${ok ? "OK" : "FAIL"} (${Date.now() - t0}ms) ${extra}`);
      try { c.end(true); } catch {}
      resolve(ok);
    };
    let c;
    try {
      c = mqtt.connect(url, {
        clientId: `szdiag${Math.random().toString(36).slice(2, 8)}`,
        keepalive: 30,
        connectTimeout: 8000,
        reconnectPeriod: 0,
        protocolVersion: 4,
      });
    } catch (e) {
      done(false, `throw: ${e.message}`);
      return;
    }
    c.on("connect", () => done(true, "connected"));
    c.on("error", (e) => done(false, `error: ${e.message}`));
    setTimeout(() => done(false, "timeout 9s"), 9000);
  });
}

// Node는 wss 지원. 브로커 2종 순차 실측 + A→B publish/subscribe 라운드트립 테스트
for (let i = 0; i < BROKERS.length; i++) {
  await testBroker(BROKERS[i], i);
}

// 라운드트립: 같은 브로커에 2클라이언트 — st 메시지 교환 실측
async function roundtrip(url) {
  return new Promise((resolve) => {
    const topic = ROOT + "stage/village";
    const recv = [];
    let a, b;
    let done = false;
    const finish = (ok, extra) => {
      if (done) return; done = true;
      console.log(`ROUNDTRIP ${url} → ${ok ? "OK" : "FAIL"} ${extra} (recv=${recv.length})`);
      try { a && a.end(true); } catch {}
      try { b && b.end(true); } catch {}
      resolve(ok);
    };
    try {
      a = mqtt.connect(url, { clientId: "szdiagA", connectTimeout: 8000, reconnectPeriod: 0, protocolVersion: 4 });
      a.on("error", (e) => finish(false, "A err " + e.message));
      a.on("connect", () => {
        b = mqtt.connect(url, { clientId: "szdiagB", connectTimeout: 8000, reconnectPeriod: 0, protocolVersion: 4 });
        b.on("error", (e) => finish(false, "B err " + e.message));
        b.on("connect", () => {
          b.subscribe(topic, { qos: 0 }, () => {
            a.publish(topic, JSON.stringify({ k: "st", pid: "diagA", x: 1, y: 2 }), { qos: 0 });
          });
        });
        b.on("message", (t, p) => {
          recv.push(JSON.parse(p.toString()));
          finish(true, "message received");
        });
      });
      setTimeout(() => finish(false, "timeout 12s"), 12000);
    } catch (e) { finish(false, "throw " + e.message); }
  });
}
await roundtrip(BROKERS[0]);
await roundtrip(BROKERS[1]);
process.exit(0);
