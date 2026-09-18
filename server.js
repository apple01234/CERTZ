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
  const APK_MIRROR = "https://github.com/apple01234/CERTZ/releases/download/v1.3.0/SERTZ-v1.3.0.apk";
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
    /* v1.0.17 — 클라 버전 게이트: 타이틀 화면이 이 API로 최신 버전을 조회해
   *  구버전 APK 사용자에게 증상 수정(화살 방향 등)이 담긴 재설치를 안내한다.
   *  유저가 구버전을 계속 쓰면 최신 수정을 못 받아 같은 증상이 재보고되는 문제를 원천 차단. */
  const LATEST_VERSION = "1.3.0";
  const LATEST_CODE = 90;
  const VERSION_NOTE = "SNS 로그인 임시 비활성(추후 업데이트)·HUD 3줄 버튼 제거(메뉴 나가기=설정)·날개/망토 방향 렌더 수정(뒷모습에서 등에 보임)·오로라류 오라 전면 강화(발판 룬 서클+회전 링+궤도 위스프)·소모품 수량 지정 사용+최대 버튼·층식 구조 타일맵(단·절벽·계단)·VFX 3팩 통합(마을 벚꽃·크리티컬 별burst·회복 하트·레벨업 링·모닥불·분수)·NPC급 옷 세트 3종(화염무사/서리기사/신비술사)+망토 2종·랭킹창+주간 랭커 보상(BM 유도)";
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
    /* v4.9.0 — 계정 API(/api/auth/*) 우선 처리 래퍼 */
    handlerWithAccounts(req, res);
  });

  /* 멀티플레이 (socket.io) — multiplayer/index.js 공용 모듈 */
  attachMultiplayer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> SERTZ 서버 준비됨 — http://localhost:${port} (멀티플레이 소켓 + 파티 + 친구 포함)`);
  });
});
