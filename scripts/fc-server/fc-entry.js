/**
 * SERTZ FC standalone 멀티플레이 주입 엔트리 (v3.1)
 *  - postbuild.js 가 이 파일을 Bun.build 로 단일 번들(.next/standalone/fc-multi.js)로 만든다
 *    (socket.io + 의존성 전부 인라인 — FC 런타임 node_modules 부재 문제 회피)
 *  - standalone 래퍼 server.js 가 캡처한 http.Server 에 멀티플레이를 부착한다
 *  - v4.9.0 — 계정 API(/api/auth/*: 자체 가입/로그인 + SNS OAuth + 클라우드 세이브)도
 *    여기서 가로챈다. request 리스너를 통째로 감싸 계정 요청만 먼저 처리한다.
 */
module.exports = function attachFcMultiplayer(httpServer) {
  const { attachMultiplayer } = require("../../multiplayer");
  const ret = attachMultiplayer(httpServer);
  if (ret && ret.heartbeat && typeof ret.heartbeat.unref === "function") {
    ret.heartbeat.unref();
  }
  console.log("> [SERTZ-FC] 멀티플레이 소켓 서버 부착 완료 (/socket.io)");

  /* v4.9.0 — 계정 API 가로채기: 기존 request 리스너를 보존한 뒤 위에 얹는다 */
  try {
    const { handleAccountRequest } = require("../../accounts");
    const orig = httpServer.listeners("request").slice();
    httpServer.removeAllListeners("request");
    httpServer.addListener("request", (req, res) => {
      if ((req.url || "").startsWith("/api/auth/")) {
        Promise.resolve(handleAccountRequest(req, res)).then((handled) => {
          if (!handled) orig.forEach((l) => l.call(httpServer, req, res));
        }).catch((e) => {
          console.error("[SERTZ-FC] 계정 API 실패", e);
          orig.forEach((l) => l.call(httpServer, req, res));
        });
        return;
      }
      orig.forEach((l) => l.call(httpServer, req, res));
    });
    console.log("> [SERTZ-FC] 계정 서버 부착 완료 (/api/auth/*)");
  } catch (e) {
    console.error("[SERTZ-FC] 계정 모듈 부착 실패 — 계정 기능 없이 계속", e);
  }
  return ret;
};
