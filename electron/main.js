/**
 * SERTZ Desktop (v1.0.8a / vc148) — Electron 메인 프로세스
 *  · APK와 동일한 정적 export(.next-apk 산출물)를 electron/game/ 에 내장
 *  · 내장 HTTP 서버가 game/ 을 서빙 + /api/* 는 https://sertz.vercel.app 로 투명 프록시
 *    (게임 코드 수정 0 — server.ts resolveApiBase()는 Electron UA면 same-origin을 사용)
 *  · 계정/거래소/랭킹/채팅/파티/버전게이트 전부 Vercel serverless 실값 사용
 *  · 멀티플레이는 클라이언트 직결 HiveMQ MQTT(wss) — 로컬 서버 무관
 *  · v1.0.8a: proxyApi가 http 모듈로 https 프로토콜을 호출하던 ERR_INVALID_PROTOCOL 수리
 *    (http→https 모듈 선택 + hop-by-hop 헤더 제거) + 메인 프로세스 예외 다이얼로그 제거(로그 파일 기록)
 */
const { app, BrowserWindow, Menu, dialog } = require("electron");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");

const PORT_CANDIDATES = [37815, 42117, 46223];
const GAME_DIR = path.join(__dirname, "game");
const API_UPSTREAM = "https://sertz.vercel.app";
const READY_TIMEOUT_MS = 20_000;

/* vc191 (지시 #1 — PC 구글 로그인) — 앱 내부 인증 팝업 창 옵션.
 *  프레임은 로컬 오리진이지만 아래 host 프록시로 인증 요청의 출처가 서비스 도메인이 된다. */
const AUTH_POPUP_OPTS = {
  width: 520,
  height: 650,
  autoHideMenuBar: true,
  webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false },
};

/* 요청 host → 대체 upstream. Firebase 인증 엔드포인트를 실제 서비스 도메인으로 보낸다.
 *  (Google 계정 화면은 원래 host 그대로 — 로그인 세션 쿠키가 그 도메인에 있어야 한다) */
const AUTH_HOST_MAP = {
  "sertz-681eb.firebaseapp.com": API_UPSTREAM,
  "identitytoolkit.googleapis.com": API_UPSTREAM,
  "securetoken.googleapis.com": API_UPSTREAM,
  "www.googleapis.com": API_UPSTREAM,
};

let server = null;
let win = null;
let quitting = false;

/* ---------- MIME ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

function sendFile(req, res, fp, status = 200) {
  const ext = path.extname(fp).toLowerCase();
  // _next 정적자산은 불변 캐시, 그 외는 매 실행 재검증(업데이트 반영)
  const immutable = fp.includes(`${path.sep}_next${path.sep}`);
  res.writeHead(status, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": fs.statSync(fp).size,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(fp).pipe(res);
}

function serveStatic(req, res) {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath.includes("..")) urlPath = "/404.html";
    let fp = path.join(GAME_DIR, urlPath);
    if (!fp.startsWith(GAME_DIR)) fp = path.join(GAME_DIR, "404.html");
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
    if (!fs.existsSync(fp)) {
      // Next.js export 보정: /foo → foo.html, /foo/ → foo/index.html
      const alt = urlPath.endsWith("/") ? path.join(GAME_DIR, urlPath, "index.html")
        : path.join(GAME_DIR, urlPath + ".html");
      if (fs.existsSync(alt)) fp = alt;
      else if (fs.existsSync(path.join(GAME_DIR, "404.html"))) {
        return sendFile(req, res, path.join(GAME_DIR, "404.html"), 404);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404");
      }
    }
    sendFile(req, res, fp);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("server error");
  }
}

/* ---------- /api/* → Vercel 투명 프록시 ---------- */
// hop-by-hop 헤더: 프록시가 전달하지 않는 연결 수준 헤더(RFC 7230 6.1)
const HOP_HEADERS = /^(connection|keep-alive|proxy-authenticate|proxy-authorization|te|trailer|transfer-encoding|upgrade)$/i;

function proxyApi(req, res) {
  const upstream = new URL(API_UPSTREAM + req.url);
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) {
    if (HOP_HEADERS.test(h)) delete headers[h];
  }
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  // 업스트림 프로토콜에 맞는 모듈 선택 — http.request는 https:를 지원하지 않음(ERR_INVALID_PROTOCOL)
  const mod = upstream.protocol === "https:" ? https : http;
  const preq = mod.request(
    { protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port || (upstream.protocol === "https:" ? 443 : 80), path: upstream.pathname + upstream.search, method: req.method, headers },
    (pres) => {
      // 쿠키 Domain 속성 제거(로컬 오리진 127.0.0.1 귀속 — 보안콘텍스트 localhost 계열이라 Secure 유지 가능)
      const sc = pres.headers["set-cookie"];
      if (sc) pres.headers["set-cookie"] = sc.map((c) => c.replace(/;\s*domain=[^;]+/gi, ""));
      // 응답 hop-by-hop 헤더 제거 — 전송 프레이밍(chunked 등)은 Node가 재조립
      const out = {};
      for (const [k, v] of Object.entries(pres.headers)) {
        if (!HOP_HEADERS.test(k)) out[k] = v;
      }
      res.writeHead(pres.statusCode || 502, out);
      pres.pipe(res);
    }
  );
  preq.setTimeout(15000, () => preq.destroy(new Error("upstream timeout")));
  preq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "오프라인 — Vercel API에 연결할 수 없습니다" }));
    } else res.end();
  });
  req.pipe(preq);
}

function startServer() {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(GAME_DIR, "index.html"))) {
      dialog.showErrorBox("SERTZ 오류", "게임 파일(game/index.html)을 찾을 수 없습니다.");
      return resolve(null);
    }
    const tryListen = (port) => {
      if (quitting || !port) {
        if (!quitting) dialog.showErrorBox("SERTZ 서버 오류", "사용 가능한 로컬 포트가 없습니다.");
        return resolve(null);
      }
      server = http.createServer((req, res) => {
        if ((req.url || "").startsWith("/api/")) proxyApi(req, res);
        else serveStatic(req, res);
      });
      server.once("error", () => {
        server = null;
        tryListen(PORT_CANDIDATES[PORT_CANDIDATES.indexOf(port) + 1]);
      });
      server.listen(port, "127.0.0.1", () => resolve(port));
    };
    tryListen(PORT_CANDIDATES[0]);
  });
}

function createWindow(port) {
  win = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0b1020",
    title: "SERTZ — 바다의 수호자: 아뜰란티스",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.once("ready-to-show", () => win.show());
  // F11 전체화면 토글
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
    }
  });
  /* vc187 (지시 #7 — "PC에서 구글 로그인 안됨")
   * vc191 (지시 #1) — 위 vc187 방식(외부 브라우저 + sertz:// 콜백)은 **미구현 상태로 남아 있었다**:
   *  setAsDefaultProtocolClient 등록도, open-url/second-instance 에서 토큰을 회수하는 코드도 없어서
   *  팝업이 외부 브라우저로 나간 뒤 앱으로 돌아오지 못했다 → PC 로그인 불가의 실제 원인.
   *
   *  그래서 외부 브라우저 우회를 걷어내고 **앱 내부 팝업창**으로 처리한다.
   *  프레임 origin 은 여전히 http://127.0.0.1:<port> 라서 Firebase 승인 도메인 문제가 남는데,
   *  이는 아래 will-attach-webview 가 아니라 세션 프록시로 해결한다 —
   *  팝업의 identitytoolkit/securetoken 요청을 실제 서비스 도메인(sertz.vercel.app)으로
   *  가로채 보내면, 인증 세션의 출처가 승인 도메인이 되어 unauthorized-domain 이 나지 않는다.
   *  (서버 검증(/api/auth/google)은 기존처럼 같은 오리진 API 프록시를 그대로 탄다.) */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) return { action: "allow", overrideBrowserWindowOptions: AUTH_POPUP_OPTS };
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

/* ---------- 메인 프로세스 예외 가드 ----------
 * API 프록시 등 비치명적 예외가 게임을 죽이지 않도록 함.
 * Electron 기본 동작(모달 오류 다이얼로그) 대신 로그 파일에 기록만 하고 계속 진행.
 */
function appendShellLog(msg) {
  try {
    const logPath = path.join(app.getPath("userData"), "shell-log.txt");
    let prev = "";
    try { prev = fs.readFileSync(logPath, "utf8"); } catch {}
    if (prev.length > 256 * 1024) prev = ""; // 로그 상한 256KB — 초과 시 순환
    fs.writeFileSync(logPath, prev + `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}
process.on("uncaughtException", (err) => {
  appendShellLog(`uncaughtException: ${err && err.stack ? err.stack : String(err)}`);
});
process.on("unhandledRejection", (reason) => {
  appendShellLog(`unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`);
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    /* vc191 (#1) — 인증 요청 host 를 실제 서비스 도메인으로 프록시.
     *  로컬 오리진(127.0.0.1)은 Firebase 승인 도메인에 넣을 수 없어(auth/unauthorized-domain)
     *  PC 클라이언트에서 구글 로그인이 실패하던 문제를 네트워크 계층에서 없앤다. */
    try {
      const { session } = require("electron");
      const ses = session.defaultSession;
      ses.webRequest.onBeforeRequest((details, cb) => {
        try {
          const u = new URL(details.url);
          const alt = AUTH_HOST_MAP[u.host];
          if (alt && /^https?:$/.test(u.protocol)) {
            const target = new URL(u.pathname + u.search, alt);
            return cb({ redirectURL: target.toString() });
          }
        } catch { /* 파싱 실패는 원요청 유지 */ }
        cb({});
      });
      /* 프록시된 응답의 CORS 헤더를 현재 오리진 기준으로 재작성 —
       *  실제 도메인으로 나간 요청도 렌더러(127.0.0.1)에서 CORS 통과하도록. */
      ses.webRequest.onHeadersReceived((details, cb) => {
        try {
          const st = details.responseHeaders || {};
          const hasAcao = Object.keys(st).some((k) => k.toLowerCase() === "access-control-allow-origin");
          if (hasAcao) {
            for (const k of Object.keys(st)) if (k.toLowerCase() === "access-control-allow-origin") delete st[k];
            st["Access-Control-Allow-Origin"] = ["*"];
          }
        } catch { /* 헤더 처리 실패 무시 */ }
        cb({ responseHeaders: details.responseHeaders });
      });
    } catch (e) {
      appendShellLog(`auth proxy setup failed: ${e && e.message ? e.message : String(e)}`);
    }
    const port = await startServer();
    if (port) createWindow(port);
    else app.quit();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    try { server && server.close(); } catch {}
  });
}
