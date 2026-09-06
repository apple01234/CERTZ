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
  /* v3.0.24: 배포 APK 직접 다운로드 — 140MB 단일 파일이 파일 패널 한도 초과로 미표시되어
   *  게임 서버(http://<서버주소>/SERTZ-vX.Y.Z.apk)에서 브라우저 다운로드를 제공 */
  const { createReadStream, statSync } = require("node:fs");
  const path = require("node:path");
  const DOWNLOAD_FILES = {
    "/SERTZ-v3.1.0.apk": {
      file: "download/SERTZ-v3.1.0.apk",
      type: "application/vnd.android.package-archive",
      attach: true,
      /* 파일 부재 시(배포 패키지 용량 한도 등) fallback — gofile 미러 페이지로 연결해 404 원천 차단 */
      fallback: "https://gofile.io/d/Tcsl6sY2",
    },
    "/APK_download_guide.txt": {
      file: "download/APK_다운로드_안내.txt",
      type: "text/plain; charset=utf-8",
      attach: false,
    },
  };
  const httpServer = createServer((req, res) => {
    const url = (req.url || "").split("?")[0];
    /* v3.1.0 — 구버전 APK 링크(v3.0.24~3.0.29)는 안내 페이지로 연결 (라이브/샌드박스 모두 유효) */
    if (/^\/SERTZ-v3\.0\.\d+\.apk$/.test(url)) {
      res.writeHead(307, { Location: "/apk-guide.html" }).end();
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
          ...(entry.attach
            ? { "Content-Disposition": 'attachment; filename="SERTZ-v3.1.0.apk"' }
            : {}),
        });
        createReadStream(fp).pipe(res);
        return;
      } catch (e) {
        /* v3.1.0b — 파일 부재 시 404 대신 fallback(goFile 미러)으로 리다이렉트 */
        res.writeHead(307, { Location: entry.fallback || "/apk-guide.html" }).end();
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
