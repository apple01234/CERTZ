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
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const http = require("node:http");
const https = require("node:https");
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

/* ---------- 자동 업데이트 (v1.4.39) ----------
 *  유저 지적: "클라이언트인데 왜 매번 다운해야함? 실행시 자동 업데이트 못함??"
 *
 *  종전엔 업데이트 확인 코드가 아예 없어서, 새 빌드가 나오면 사용자가 릴리스
 *  페이지를 직접 찾아가 EXE 를 다시 받아 덮어설치해야 했다.
 *
 *  electron-updater 는 쓰지 않는다 — latest.yml·publish 설정·서명 검증이 필요해
 *  이 저장소 구조(정적 export 내장 + Vercel API 프록시)와 맞지 않는다.
 *  이미 살아 있는 /api/version 을 재사용해 자체 구현한다(서버·워크플로 무변경).
 *
 *  동작:
 *    1) 앱 시작 직후(창 표시 후 3초) /api/version 을 1회 조회
 *    2) 서버의 code > 로컬 versionCode 면 업데이트 있음
 *    3) 다이얼로그로 물어보고, 수락하면 설치파일을 받아 실행 후 종료
 *    4) 사용자가 '나중에'를 고르면 하루 뒤에 다시 확인
 */
const API_BASE = "https://sertz.vercel.app";
/* 로컬 versionCode 의 단일 진실은 android/app/build.gradle 이다(워크플로가 여기서 파싱).
 *  버전 문자열(1.4.38)에서 숫자를 뽑으면 38 이 나와 vc200 과 비교가 어긋나
 *  매번 "업데이트 있음"으로 오판한다 — 반드시 versionCode 를 쓴다.
 *  build 시점에 주입된다: electron-builder 가 package.json 의 build.sertzVersionCode 를
 *  읽어 넣고, 없으면(개발 실행) package.json version 의 re 릴리스 번호를 쓴다. */
const LOCAL_VERSION = require("./package.json").version;
const LOCAL_CODE = (() => {
  const pkg = require("./package.json");
  /* 1) 명시 주입값 최우선 (electron-builder 가 주입 — 최상위 키) */
  if (Number.isFinite(pkg.sertzVersionCode)) return pkg.sertzVersionCode;
  if (pkg.build && Number.isFinite(pkg.build.sertzVersionCode)) return pkg.build.sertzVersionCode;
  /* 2) gradle 파일이 함께 있으면 파싱 (개발 실행 시) */
  try {
    const g = fs.readFileSync(path.join(__dirname, "..", "android", "app", "build.gradle"), "utf8");
    const m = g.match(/versionCode\s+(\d+)/);
    if (m) return parseInt(m[1], 10);
  } catch {}
  /* 3) 최후 폴백 — patch 번호(구버전 호환) */
  const m = String(LOCAL_VERSION).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
})();
let updateDismissedAt = 0;

function parseCode(v) {
  /* "vc200" / 200 / "200" → 200. 숫자가 없으면 0. */
  const m = String(v == null ? "" : v).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function httpGetJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "SERTZ-Desktop/" + LOCAL_VERSION } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("HTTP " + res.statusCode));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/* 설치파일을 userData/updates 로 스트리밍 다운로드. 진행률을 창 제목에 표시. */
function downloadInstaller(url, onProgress) {
  return new Promise((resolve, reject) => {
    const dir = path.join(app.getPath("userData"), "updates");
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const dest = path.join(dir, path.basename(new URL(url).pathname) || "SERTZ-setup.exe");
    const tmp = dest + ".part";
    const file = fs.createWriteStream(tmp);

    const follow = (u, depth = 0) => {
      if (depth > 5) return reject(new Error("리다이렉트 과다"));
      const mod = String(u).startsWith("http://") ? http : https;
      mod.get(u, { headers: { "User-Agent": "SERTZ-Desktop/" + LOCAL_VERSION } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          /* GitHub 릴리스는 S3 로 302 리다이렉트한다 — 상대/절대 둘 다 처리 */
          return follow(new URL(res.headers.location, u).toString(), depth + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode));
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let got = 0;
        res.on("data", (c) => {
          got += c.length;
          if (total && onProgress) onProgress(got, total);
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            try { fs.renameSync(tmp, dest); } catch (e) { return reject(e); }
            resolve(dest);
          });
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

async function checkForUpdates(interactive = false) {
  /* 사용자가 '나중에'를 누른 뒤 24시간 안에는 조용히 넘어간다(성가심 방지). */
  if (!interactive && Date.now() - updateDismissedAt < 24 * 3600 * 1000) return;

  let info;
  try {
    info = await httpGetJson(API_BASE + "/api/version");
  } catch (e) {
    appendShellLog("update check failed: " + (e && e.message));
    return;
  }

  const remoteCode = Number(info && info.code) || 0;
  const localCode = LOCAL_CODE;
  appendShellLog(`update check: local=${LOCAL_VERSION}(vc${localCode}) remote=${info && info.latest}(vc${remoteCode})`);

  if (!remoteCode || remoteCode <= localCode) {
    if (interactive) {
      dialog.showMessageBox(win, {
        type: "info",
        title: "업데이트 확인",
        message: "최신 버전을 사용 중입니다.",
        detail: `현재 버전 ${LOCAL_VERSION} (vc${localCode})`,
        buttons: ["확인"],
      });
    }
    return;
  }

  const target = win || undefined;
  const ask = await dialog.showMessageBox(target, {
    type: "question",
    title: "업데이트 있음",
    message: `새 버전 ${info.latest} (vc${remoteCode}) 이 있습니다.`,
    detail:
      (info.note ? String(info.note).slice(0, 400) + "\n\n" : "") +
      `현재 ${LOCAL_VERSION} (vc${localCode}) → 새 버전으로 지금 업데이트할까요?\n` +
      "다운로드가 끝나면 설치 프로그램이 실행되고, 게임은 자동으로 종료됩니다.",
    buttons: ["지금 업데이트", "나중에"],
    defaultId: 0,
    cancelId: 1,
  });

  if (ask.response !== 0) {
    updateDismissedAt = Date.now();
    return;
  }

  if (!info.exe) {
    dialog.showMessageBox(target, {
      type: "warning",
      title: "업데이트 실패",
      message: "설치 파일 주소를 받지 못했습니다.",
      detail: "브라우저에서 릴리스 페이지를 직접 열어 받아 주세요.",
      buttons: ["확인"],
    });
    return;
  }

  /* 다운로드 — 창 제목으로 진행률 표시(별도 창 없이 눈에 띄게) */
  const origTitle = win ? win.getTitle() : "";
  try {
    const file = await downloadInstaller(info.exe, (got, total) => {
      if (!win) return;
      const pct = total ? Math.floor((got / total) * 100) : 0;
      win.setTitle(`SERTZ — 업데이트 내려받는 중… ${pct}% (${(got / 1048576).toFixed(0)}/${(total / 1048576).toFixed(0)}MB)`);
    });
    if (win) win.setTitle(origTitle);
    appendShellLog("update downloaded: " + file);

    const ok = await dialog.showMessageBox(target, {
      type: "info",
      title: "업데이트 준비 완료",
      message: "설치 프로그램을 실행합니다.",
      detail: "게임이 종료되고 설치가 시작됩니다. 설치 후 다시 실행해 주세요.",
      buttons: ["설치 시작", "취소"],
      defaultId: 0,
      cancelId: 1,
    });
    if (ok.response !== 0) return;

    /* 설치 프로그램 실행 후 종료 — oneClick NSIS 라 사용자 조작 최소 */
    const { spawn } = require("node:child_process");
    spawn(file, [], { detached: true, stdio: "ignore" }).unref();
    quitting = true;
    app.quit();
  } catch (e) {
    if (win) win.setTitle(origTitle);
    appendShellLog("update download failed: " + (e && e.message));
    dialog.showMessageBox(target, {
      type: "error",
      title: "업데이트 실패",
      message: "다운로드에 실패했습니다.",
      detail: String((e && e.message) || e),
      buttons: ["확인"],
    });
  }
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
    const port = await startServer();
    if (port) {
      createWindow(port);
      /* v1.4.39 — 창이 뜬 뒤 3초 후 자동 업데이트 확인(첫 로딩을 방해하지 않게).
       *  실패해도 조용히 로그만 남기고 게임 진행에는 영향이 없다. */
      if (win) {
        win.once("ready-to-show", () => {
          setTimeout(() => { checkForUpdates(false); }, 3000);
        });
      }
    } else app.quit();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    try { server && server.close(); } catch {}
  });
}
