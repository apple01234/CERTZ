/**
 * SERTZ FC standalone 멀티플레이 주입 엔트리 (v3.1)
 *  - postbuild.js 가 이 파일을 Bun.build 로 단일 번들(.next/standalone/fc-multi.js)로 만든다
 *    (socket.io + 의존성 전부 인라인 — FC 런타임 node_modules 부재 문제 회피)
 *  - standalone 래퍼 server.js 가 캡처한 http.Server 에 멀티플레이를 부착한다
 */
module.exports = function attachFcMultiplayer(httpServer) {
  const { attachMultiplayer } = require("../../multiplayer");
  const ret = attachMultiplayer(httpServer);
  if (ret && ret.heartbeat && typeof ret.heartbeat.unref === "function") {
    ret.heartbeat.unref();
  }
  console.log("> [SERTZ-FC] 멀티플레이 소켓 서버 부착 완료 (/socket.io)");
  return ret;
};
