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
  const APK_MIRROR =
  /* vc138 — GitHub API 자산 DELETE 일시 장애로 동일 이름 교체가 막힌 기간의 안전 경로:
   *  vc138 자산을 별도 이름으로 업로드하고 이쪽을 가리킴. 루프가 동일 이름 교체에 성공하면
   *  양쪽 URL 모두 vc138이 됨 (서버 307 리다이렉트이므로 클라 영향 없음). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-vc145.apk";
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
  const LATEST_VERSION = "1.0.5-beta";
  const LATEST_CODE = 145;
  const VERSION_NOTE =
  "v1.0.5-beta (vc145) — 피드백 16종 반영: ①랭킹 갱신(자동저장→클라우드 즉시 푸시+90초 주기) ②랭킹 100위까지 스크롤(리스트 높이 확대) ③툰 셰이더 강도 대폭 완화(대비 1.09→1.04·채도 1.22→1.10·림라이트 축소) ④친구 창 기본 단축키 R(설정에서 재배치 가능) ⑤PC 우상단 UI 확대(1024+ 1.08/1280+ 1.18/1600+ 1.28 배) ⑥미니맵 위 현재 위치 표시(예: 3-2 · 쿠소디아) ⑦유저 제공 RPG UI 팩(ui2) 프레임·버튼·입력창 재적용(9-슬라이스 — 흐려짐 없음) ⑧게임 화면에서 캐릭터 선택 바로가기 아이콘 신설 ⑨스킬 화력 대폭 상향(전 스킬 ×1.25+차수 사다리 확대 — 스킬이 평타보다 확실히 강함) ⑩B키=자동전투 전용(친구창 오점유 수정) ⑪셰이더 강도 조절바 즉시 반영(툰·발광 동시 제어) ⑫궁수 너프: 크리 100% 초과분은 크리뎀% 대신 공격력 평가산(135%→+35 ATK) ⑬식인초 스폰 6그루 보장+히트박스 확대+거리 판정 폴백(밟으면 확실히 번다) ⑭1:1 거래 버튼 크래시 수정(이벤트 채널 재귀 제거) ⑮보스 패턴 검은 네모 완전 삭제(예고 링·맹독장판 가산 블렌드) ⑯[긴급]스타포스 아이템 귀속(장비 교체 시 이전 장비의 강화 수치 유출 차단 — 기존 세이브 자동 마이그레이션)";
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
  /* v4.0.0 — 어떤 버전의 APK 링크든 즉시 다운로드 경로로 연결 (404 원천 차단)
   *  vc138 — 정규식이 beta 접미사를 놓쳐 /SERTZ-v1.0.5-beta.apk가 Next의 구버전
   *  리다이렉트로 새던 문제 수정 ([\w.-]+ 로 확대 — server.js가 먼저 307 처리) */
    if (/^\/SERTZ-v[\w.-]+\.apk$/i.test(url)) {
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
