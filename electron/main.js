/**
 * SERTZ Desktop (v1.0.8 / vc148) — Electron 메인 프로세스
 *  · APK와 동일한 정적 export(.next-apk 산출물)를 electron/game/ 에 내장
 *  · 내장 HTTP 서버가 game/ 을 서빙 + /api/* 는 https://sertz.vercel.app 로 투명 프록시
 *    (게임 코드 수정 0 — server.ts resolveApiBase()는 Electron UA면 same-origin을 사용)
 *  · 계정/거래소/랭킹/채팅/파티/버전게이트 전부 Vercel serverless 실값 사용
 *  · 멀티플레이는 클라이언트 직결 HiveMQ MQTT(wss) — 로컬 서버 무관
 */
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const PORT_CANDIDATES = [37815, 42117, 46223];
const GAME_DIR = path.join(__dirname, "game");
const API_UPSTREAM = "https://sertz.vercel.app";
const READY_TIMEOUT_MS = 20_000;

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
function proxyApi(req, res) {
  const upstream = new URL(API_UPSTREAM + req.url);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  const preq = http.request(
    { protocol: "https:", hostname: upstream.hostname, port: 443, path: upstream.pathname + upstream.search, method: req.method, headers },
    (pres) => {
      // 쿠키 Domain 속성 제거(로컬 오리진 127.0.0.1 귀속 — 보안콘텍스트 localhost 계열이라 Secure 유지 가능)
      const sc = pres.headers["set-cookie"];
      if (sc) pres.headers["set-cookie"] = sc.map((c) => c.replace(/;\s*domain=[^;]+/gi, ""));
      res.writeHead(pres.statusCode || 502, pres.headers);
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

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
