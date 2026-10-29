#!/usr/bin/env node
/* downloadInstaller 의 리다이렉트 추적·진행률·파일 완결성 실측.
 *
 * Electron 없이 같은 로직을 재현해 로컬 HTTP 목 서버로 검증한다:
 *   /setup.exe  → 302 → /real.exe (실제 바이트)
 * 이 게임의 실제 조건과 동일: GitHub 릴리스가 S3 로 302 리다이렉트한다.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PAYLOAD = Buffer.alloc(512 * 1024, 0xab); // 512KB

function downloadInstaller(url, destDir, onProgress) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(new URL(url).pathname) || "setup.exe");
    const tmp = dest + ".part";
    const file = fs.createWriteStream(tmp);

    const follow = (u, depth = 0) => {
      if (depth > 5) return reject(new Error("리다이렉트 과다"));
      http.get(u, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return follow(new URL(res.headers.location, u).toString(), depth + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let got = 0;
        res.on("data", (c) => { got += c.length; if (total && onProgress) onProgress(got, total); });
        res.pipe(file);
        file.on("finish", () => file.close(() => {
          try { fs.renameSync(tmp, dest); } catch (e) { return reject(e); }
          resolve(dest);
        }));
      }).on("error", reject);
    };
    follow(url);
  });
}

(async () => {
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith("/setup.exe")) {
      res.writeHead(302, { Location: "/real.exe" });
      res.end();
    } else if (req.url.startsWith("/real.exe")) {
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": PAYLOAD.length });
      res.end(PAYLOAD);
    } else { res.writeHead(404); res.end(); }
  });

  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "sertz-upd-"));

  let progressCalls = 0, lastPct = -1;
  let fails = 0;
  const check = (n, ok, d = "") => { console.log(`${ok ? "  OK  " : "  FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) fails++; };

  try {
    const file = await downloadInstaller(`http://127.0.0.1:${port}/setup.exe`, dest, (got, total) => {
      progressCalls++;
      lastPct = Math.floor((got / total) * 100);
    });
    const stat = fs.statSync(file);
    check("302 리다이렉트 추적 성공", true, path.basename(file));
    check("파일 크기 일치", stat.size === PAYLOAD.length, `${stat.size}/${PAYLOAD.length}`);
    check("진행률 콜백 호출", progressCalls > 0, `${progressCalls}회, 최종 ${lastPct}%`);
    check("최종 진행률 100%", lastPct === 100, `${lastPct}%`);
    check(".part 임시파일 정리됨", !fs.existsSync(file + ".part"));
    const buf = fs.readFileSync(file);
    check("바이트 무결성", buf.length === PAYLOAD.length && buf[0] === 0xab && buf[buf.length - 1] === 0xab);
  } catch (e) {
    check("다운로드 실행", false, e.message);
  } finally {
    srv.close();
    fs.rmSync(dest, { recursive: true, force: true });
  }

  console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `FAILED ${fails}건`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
