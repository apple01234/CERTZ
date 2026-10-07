/* 브로커 스니퍼 — sertz/mp/v2/# 전부 수신 출력 (E2E와 병행 실행) */
const mqtt = require("mqtt");
const c = mqtt.connect("wss://broker.emqx.io:8084/mqtt", { clientId: "sz_sniffer_" + Date.now().toString(36), protocolVersion: 4, connectTimeout: 8000 });
c.on("connect", () => {
  console.log("[sniffer] connected");
  c.subscribe("sertz/mp/v2/#");
});
let n = 0;
c.on("message", (t, p) => {
  n++;
  if (n <= 30) console.log(`[sniffer] ${t} :: ${p.toString().slice(0, 150)}`);
});
setInterval(() => console.log(`[sniffer] total=${n}`), 5000);
