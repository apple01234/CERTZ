/**
 * SERTZ 커스텀 서버 (v3.1) — Next.js + socket.io 멀티플레이
 *  - `npm run dev` / `npm start` 모두 이 서버를 사용 (기존 워크플로 유지)
 *  - 멀티플레이 본체는 multiplayer/index.js 로 분리 (v3.1 — FC standalone 주입 공용 모듈)
 *  - v3.1 (멀티 안됨 근본 수정): FC 배포는 .next/standalone 자동생성 server.js 로 구동되어
 *    이 파일의 socket.io 가 실행되지 않았다 → scripts/fc-server/postbuild.js 가
 *    standalone 서버에 multiplayer 모듈을 주입해 라이브 서버에서도 멀티가 동작한다.
 *  - v1.4.13 (#4 admin 로그인) — 커스텀 서버는 Next 런타임을 거치지 않으므로 .env 파일이
 *    자동 로드되지 않았다 → SERTZ_ADMIN_PASSWORD 등 환경변수가 계정 모듈에 전달되지 않아
 *    관리자 비밀번호를 지정해도 실제론 무작위 비밀번호로 시드되는 문제. 부팅 시
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
  /* vc157 — APK는 릴리스 태그 v1.0.16에 있다(이전 태그는 vc157까지 보유).
   *  태그를 v1.0.9로 두면 SERTZ-vc157.apk가 404가 되므로 버전 태그를 그대로 쓴다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.16/SERTZ-vc158.apk";
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
  const LATEST_VERSION = "1.0.16";
  const LATEST_CODE = 158;
    const VERSION_NOTE =
  "v1.0.16 (vc158) — 보완 기획서 사이클(보안·최적화·접근성·BM·빌드 일괄): ①세션 토큰 SHA-256 해시 저장 전환(원문 저장 폐기 — DB 유출로도 세션 탈취 불가)+세션 TTL 30일→14일 — 기존 세션은 1회 재로그인 필요 ②클라우드세이브 chars 백업 소실 방지 ③채팅·파티 인증 강화(cid 위조 강퇴·관리자 사칭 차단) ④admin 예약 ID 선점 차단 ⑤소스 평문 자격증명 제거 ⑥릴리스 서명 키 저장소 제거→CI Secret 복원 ⑦API 실패 은폐 수정(무효 토큰이 빈 목록으로 위장하지 않음 — 503 사유 반환) ⑧일일특가 표시가=청구가 정합 ⑨구매 2단계 확인 모달(오탭 결제 차단) ⑩스타포스 확률 공시(15단계 성공률·하락·주문서) ⑪최적화: 획득 텍스트 풀 분리·피해로그 링버퍼·클로저 승격·히트스파크 상수화·장판 Vector2 재사용·스킬 판정 스크래치 버퍼(48곳)·세이브 직렬화 1회 통일 ⑫히트스톱이 자가치유에 잘리던 버그 수정(타격감 복원) ⑬접근성: 캐시상점 키보드 내비·모달 role/aria 시맨틱·터치 타깃 히트 영역 확장·텍스트 대비 WCAG AA 상향(255곳)·광고 실패 사유 분기·결제/환불 FAQ·shadcn 잔재 48개 제거+번들 유출 차단 ⑭빌드: ignoreBuildErrors 제거(타입 강제)·lint 게이트 CI 강제·EXE 릴리스 태그 동적화·lockfile 버전 정합 ⑮콘텐츠: 적 고유 개성 21종 보충+재림 보스 전리품 3종(vord·jorm·nagr)";
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
