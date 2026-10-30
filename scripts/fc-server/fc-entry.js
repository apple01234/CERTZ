/**
 * SERTZ FC standalone 멀티플레이 주입 엔트리 (v3.1)
 *  - postbuild.js 가 이 파일을 Bun.build 로 단일 번들(.next/standalone/fc-multi.js)로 만든다
 *    (socket.io + 의존성 전부 인라인 — FC 런타임 node_modules 부재 문제 회피)
 *  - standalone 래퍼 server.js 가 캡처한 http.Server 에 멀티플레이를 부착한다
 *
 * vc205 (감사 — 이중 구현 제거)
 *   종전엔 이 파일이 `/api/auth/*`·`/api/market` 를 `accounts/index.js` 의 **구 구현**으로
 *   가로챘다. 그 구현은 파일 DB 를 쓰고 에스크로·골드 검증·IAP 검증이 없어,
 *   ghdb.ts 와 같은 백업 파일을 공유하면서도 재화 보호가 통째로 빠져 있었다.
 *   → 이제 **API 는 하나도 가로채지 않는다.** Next 라우트가 유일한 구현이다.
 *
 *   남기는 것: OPTIONS 프리플라이트 204 (구 APK 호환 — Next 로 떨어지면 404/405 가 나
 *   Authorization 헤더를 쓰는 모든 요청이 실패했던 이력이 있다).
 */
module.exports = function attachFcMultiplayer(httpServer) {
  const { attachMultiplayer } = require("../../multiplayer");
  const ret = attachMultiplayer(httpServer);
  if (ret && ret.heartbeat && typeof ret.heartbeat.unref === "function") {
    ret.heartbeat.unref();
  }
  console.log("> [SERTZ-FC] 멀티플레이 소켓 서버 부착 완료 (/socket.io)");

  try {
    /* v1.2.0 (#거래소접속) — CORS 프리플라이트 OPTIONS 즉시 204.
     *  이게 없으면 preflight 가 2xx 가 아니어서 Authorization 을 붙이는 모든 요청
     *  (로그인 유저의 거래소·클라우드세이브·/me)이 "서버에 연결할 수 없어요"가 된다. */
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    };
    const orig = httpServer.listeners("request").slice();
    httpServer.removeAllListeners("request");
    httpServer.addListener("request", (req, res) => {
      const u = req.url || "";
      const m = (req.method || "GET").toUpperCase();
      if (
        m === "OPTIONS" &&
        (u.startsWith("/api/auth/") ||
          u.startsWith("/api/admin/") ||
          u.startsWith("/api/market") ||
          u.startsWith("/api/rank") ||
          u.startsWith("/api/iap"))
      ) {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }
      /* 그 외 전부 Next 로 — 인증·세이브·거래소·랭킹·결제검증 모두 단일 구현 */
      orig.forEach((l) => l.call(httpServer, req, res));
    });
    console.log("> [SERTZ-FC] API 위임 완료 — Next 라우트 단일 구현 (가로채기 없음)");
  } catch (e) {
    console.error("[SERTZ-FC] 부착 실패 — Next 단독으로 계속", e);
  }
  return ret;
};
