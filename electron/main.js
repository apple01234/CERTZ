/**
 * SERTZ Desktop (v3.0.8) — Electron 메인 프로세스
 *  - 내장 Next.js 게임 서버(server.js + socket.io)를 자식 프로세스로 기동
 *    (ELECTRON_RUN_AS_NODE=1 → Electron 바이너리를 Node로 사용, 별도 Node 불필요)
 *  - 준비되면 BrowserWindow로 http://127.0.0.1:<port> 로딩
 *  - 종료 시 서버 프로세스 트리까지 정리 (Windows: taskkill /T /F)
 */
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const PORT_CANDIDATES = [37815, 42117, 46223];
const READY_TIMEOUT_MS = 45_000;

let serverProc = null;
let win = null;
let quitting = false;

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

function waitReady(port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (quitting) return resolve(false);
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2500 }, (res) => {
        res.resume();
        resolve(res.statusCode != null && res.statusCode < 500);
      });
      req.on("error", () => {
        if (Date.now() - started > READY_TIMEOUT_MS) resolve(false);
        else setTimeout(tick, 500);
      });
      req.on("timeout", () => req.destroy(new Error("poll timeout")));
    };
    tick();
  });
}

function startServer() {
  return new Promise(async (resolve) => {
    const gameDir = path.join(__dirname, "game");
    const serverPath = path.join(gameDir, "server.js");
    if (!fs.existsSync(serverPath)) {
      dialog.showErrorBox("SERTZ 오류", "게임 서버 파일(game/server.js)을 찾을 수 없습니다.");
      return resolve(null);
    }
    const logPath = path.join(gameDir, "server.log");
    const logFd = fs.openSync(logPath, "a");
    fs.writeSync(logFd, `\n===== SERTZ Desktop launch ${new Date().toISOString()} =====\n`);

    for (const port of PORT_CANDIDATES) {
      if (quitting) return resolve(null);
      if (!(await isPortFree(port))) continue;
      const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: String(port) };
      serverProc = spawn(process.execPath, [serverPath], {
        cwd: gameDir,
        env,
        stdio: ["ignore", logFd, logFd],
        windowsHide: true,
      });
      const ok = await waitReady(port);
      if (ok) {
        try { fs.writeFileSync(path.join(gameDir, ".port"), String(port)); } catch {}
        return resolve(port);
      }
      // 이 포트 실패 → 프로세스 정리 후 다음 후보
      killServer();
      serverProc = null;
    }
    dialog.showErrorBox(
      "SERTZ 서버 오류",
      "내장 게임 서버 시작에 실패했습니다.\n로그: " + logPath
    );
    resolve(null);
  });
}

function killServer() {
  if (!serverProc || serverProc.exitCode != null) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(serverProc.pid), "/T", "/F"], { windowsHide: true });
    } else {
      serverProc.kill("SIGTERM");
      setTimeout(() => { try { serverProc && serverProc.kill("SIGKILL"); } catch {} }, 3000);
    }
  } catch {}
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

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
  app.on("before-quit", () => { quitting = true; killServer(); });
}
