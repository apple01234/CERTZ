/**
 * SERTZ 커스텀 서버 (v3.1) — Next.js + socket.io 멀티플레이
 *  - `npm run dev` / `npm start` 모두 이 서버를 사용 (기존 워크플로 유지)
 *  - 멀티플레이 본체는 multiplayer/index.js 로 분리 (v3.1 — FC standalone 주입 공용 모듈)
 *  - v3.1 (멀티 안됨 근본 수정): FC 배포는 .next/standalone 자동생성 server.js 로 구동되어
 *    이 파일의 socket.io 가 실행되지 않았다 → scripts/fc-server/postbuild.js 가
 *    standalone 서버에 multiplayer 모듈을 주입해 라이브 서버에서도 멀티가 동작한다.
 *  - v1.4.13 (#4 admin 로그인) — 커스텀 서버는 Next 런타임을 거치지 않으므로 .env 파일이
 *    자동 로드되지 않았다 → SERTZ_ADMIN_PASSWORD 등 환경변수가 계정 모듈에 전달되지 않아
 *    "admin/Sertz!2026" 으로 지정해도 실제론 무작위 비밀번호로 시드되는 문제. 부팅 시
 *    @next/env.loadEnvConfig 로 .env를 명시적으로 읽어 process.env에 주입한다.
 */
try {
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(__dirname);
} catch (e) {
  /* @next/env 미설치/파솄 시 조용히 스킵 — process.env는 외부 설정된 값으로 동작 */
}
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
  const APK_MIRROR = "https://github.com/apple01234/CERTZ/releases/download/v1.4.14/SERTZ-v1.4.14.apk";
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
  const LATEST_VERSION = "1.4.14";
  const LATEST_CODE = 106;
  const VERSION_NOTE = "v1.4.14 — 유저 8건: ①texGuard 강화(missing texture 자동 재로드) ②책 모양 UI 제거(일반 패널 회귀) ③직업 주스탯 → ATK (전사 STR/궁수 DEX/마법사 INT/도적 LUK 0.8/점) ④기본공격 버튼 64→84, 스킬 46→56 확대 ⑤여캐 6종 chibi 직접 드로잉 (SPUM 비의존) ⑥SPUM 외 다양한 에셋 통합 (Kenney/itch.io CC0/0x72/50 Monsters) ⑦모바일 인벤 납작해짐 수정 (zoom 스케일 0.78/0.88) ⑧PPT 프롬프트 작성 (시연 영상+에셋 소개)";
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
