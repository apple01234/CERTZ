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
  const APK_MIRROR = "https://github.com/apple01234/CERTZ/releases/download/v1.3.1/SERTZ-v1.3.1.apk";
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
  const LATEST_VERSION = "1.3.1";
  const LATEST_CODE = 91;
  const VERSION_NOTE = "SPUM 에셋 신규 코스튬 8종(발키리/마녀/숲수호자/백합/대군주/성기사/칼날/항해사 — 투구·후드·망토 실제 파트 조합)·검은화면 자가치유(로더 교착 폴백+장시간 백그라운드 재부팅)·게임 멈춤 수정(복귀 입력/물리 자가치유+히트스톱 재개 가드)·부활 가까운 마을 이동·모든 장비 스타포스(장신구 atk/def 트랙 신설)·전직 조각회수 폐지→맵이동 퀘스트(계열별 다른 맵)·지형물 배치 수정(유적/포탈/입구 보호)·능력치 소수 정리·모바일 절전 기본+적 상한 축소";
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
