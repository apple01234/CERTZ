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

const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  /* v3.2.1 — 모든 APK 요청(/SERTZ-*.apk)은 다운로드 경로로 즉시 리다이렉트.
   *  GitHub 릴리스 = CDN 즉시 다운로드(약 20초/140MB, 대기 없음).
   *  gofile(qUiPRRXl)은 콜드스토리지라 첫 응답까지 ~1분 걸려 백업용으로만 안내. */
  const APK_MIRROR = "https://github.com/apple01234/CERTZ/releases/download/v4.1.2/SERTZ-v4.1.2.apk";
  const { createReadStream, statSync } = require("node:fs");
  const path = require("node:path");
  const DOWNLOAD_FILES = {
    "/APK_download_guide.txt": {
      file: "download/APK_다운로드_안내.txt",
      type: "text/plain; charset=utf-8",
      attach: false,
    },
  };
  const httpServer = createServer((req, res) => {
    const url = (req.url || "").split("?")[0];
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
    handle(req, res);
  });

  /* 멀티플레이 (socket.io) — multiplayer/index.js 공용 모듈 */
  attachMultiplayer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> SERTZ 서버 준비됨 — http://localhost:${port} (멀티플레이 소켓 + 파티 + 친구 포함)`);
  });
});
