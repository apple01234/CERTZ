/**
 * SERTZ 커스텀 서버 (v3.1) — Next.js + socket.io 멀티플레이
 *  - `npm run dev` / `npm start` 모두 이 서버를 사용 (기존 워크플로 유지)
 *  - 멀티플레이 본체는 multiplayer/index.js 로 분리 (v3.1 — FC standalone 주입 공용 모듈)
 *  - v3.1 (멀티 안됨 근본 수정): FC 배포는 .next/standalone 자동생성 server.js 로 구동되어
 *    이 파일의 socket.io 가 실행되지 않았다 → scripts/fc-server/postbuild.js 가
 *    standalone 서버에 multiplayer 모듈을 주입해 라이브 서버에서도 멀티가 동작한다.
 */
const { createServer } = require("node:http");
const next = require("next");
const { attachMultiplayer } = require("./multiplayer");
const { attachAccountsBefore } = require("./accounts"); // v4.9.0 — 자체/SNS 계정 + 클라우드 세이브

const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  /* v3.2.1 — 모든 APK 요청(/SERTZ-*.apk)은 다운로드 경로로 즉시 리다이렉트.
   *  GitHub 릴리스 = CDN 즉시 다운로드(약 20초/140MB, 대기 없음).
   *  gofile(qUiPRRXl)은 콜드스토리지라 첫 응답까지 ~1분 걸려 백업용으로만 안내. */
  const APK_MIRROR = "https://github.com/apple01234/CERTZ/releases/download/v1.4.8/SERTZ-v1.4.8.apk";
  const { createReadStream, statSync } = require("node:fs");
  const path = require("node:path");
  const DOWNLOAD_FILES = {
    "/APK_download_guide.txt": {
      file: "download/APK_다운로드_안내.txt",
      type: "text/plain; charset=utf-8",
      attach: false,
    },
  };
  /* v4.9.0 — 자체 회원가입/로그인 + SNS OAuth + 클라우드 세이브 (accounts/index.js)
   *  /api/auth/* 만 계정 모듈이 먼저 처리하고 나머지는 Next handle로 */
  const handlerWithAccounts = attachAccountsBefore(handle);
  const httpServer = createServer((req, res) => {
    const url = (req.url || "").split("?")[0];
    /* v1.4.8 (#4 보안) — 전역 보안 헤더: 스니핑·클릭재킹·외부 스크립트 주입 차단.
     *  CSP는 Next 런타임(hydration inline script·eval)과 Phaser 캔버스(data:/blob:)를 고려해
     *  script-src에 unsafe-inline/unsafe-eval 허용 — 외부 오리진 스크립트는 전면 차단.
     *  HSTS는 실제 TLS로 서브될 때만 부여 (로컬 평문 개발에는 미적용). */
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
    );
    if (String(req.headers["x-forwarded-proto"] || "") === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    /* v1.0.17 — 클라 버전 게이트: 타이틀 화면이 이 API로 최신 버전을 조회해
   *  구버전 APK 사용자에게 증상 수정(화살 방향 등)이 담긴 재설치를 안내한다.
   *  유저가 구버전을 계속 쓰면 최신 수정을 못 받아 같은 증상이 재보고되는 문제를 원천 차단. */
  const LATEST_VERSION = "1.4.8";
  const LATEST_CODE = 100;
  const VERSION_NOTE = "전체 최적화·보안 강화·UI 재편: 우측 부유 위젯(계정/파티/친구) 중앙 모달 전환으로 UI 겹침 근원 차단·퀘스트 트래커 축소·타깃 판정 캐시와 이펙트 풀링(프레임 안정화)·보안 헤더/CORS 화이트리스트/클라우드세이브 검증/소켓 GM 스푸핑 차단·기능별 사운드 전면 분리(quest 38중복 해소)+BGM 크로스페이드·패널 등장 애니메이션";
  if (url === "/api/version") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({
      latest: LATEST_VERSION,
      code: LATEST_CODE,
      note: VERSION_NOTE,
      apk: APK_MIRROR,
      guide: "/apk-guide.html",
    }));
    return;
  }
  /* v4.0.0 — 어떤 버전의 APK 링크든 즉시 다운로드 경로로 연결 (404 원천 차단) */
    if (/^\/SERTZ-v[\d.]+\.apk$/i.test(url)) {
      res.writeHead(307, { Location: APK_MIRROR }).end();
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
        });
        createReadStream(fp).pipe(res);
        return;
      } catch (e) {
        res.writeHead(404).end("not found");
        return;
      }
    }
    /* v1.4.7 (유저 지시 — 오류나는 페이지 철거) — 세계수의 기록(/secret) 정적 페이지 완전 철거.
     *  인게임 비석·비밀수첩 버튼도 삭제되어 더 이상 진입 경로가 없지만, 구버전 APK/북마크의
     *  잔존 링크가 404로 착지하지 않도록 지원센터로 308 유도한다. */
    if (/^\/secret(\/.*)?$/i.test(url)) {
      res.writeHead(308, { Location: "/support" }).end();
      return;
    }
    /* v1.4.6 (#문의페이지404) — 유저가 임의로 추측해 입력하는 문의/삭제 URL을
     *  전부 지원센터(/support)로 유도 — 404 노출 원천 차단. */
    if (/^\/(inquiry|contact|account-delete|delete-account|account\/delete|delete)\/?$/i.test(url)) {
      res.writeHead(308, { Location: "/support" }).end();
      return;
    }
    /* v4.9.0 — 계정 API(/api/auth/*) 우선 처리 래퍼 */
    handlerWithAccounts(req, res);
  });

  /* 멀티플레이 (socket.io) — multiplayer/index.js 공용 모듈 */
  attachMultiplayer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> SERTZ 서버 준비됨 — http://localhost:${port} (멀티플레이 소켓 + 파티 + 친구 포함)`);
  });
});
