/**
 * vc148 EXE 프록시 수리 실측 테스트
 * - electron/main.js에서 proxyApi(수정본) 소스를 그대로 추출해 eval로 로드 (실제 배포 코드 검증)
 * - 로컬 서버 기동 → /api/* → Vercel 프록시 경유 응답 검증
 * - (참고) 이전 버그: http.request({protocol:"https:"}) → ERR_INVALID_PROTOCOL 동기 throw
 */
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");

const MAIN = "/home/z/my-project/electron/main.js";
const API_UPSTREAM = "https://sertz.vercel.app";

function extractProxySource(src) {
  const start = src.indexOf("/* ---------- /api/*");
  const end = src.indexOf("function startServer");
  if (start < 0 || end < 0 || end <= start) throw new Error("proxyApi 소스 추출 실패");
  return src.slice(start, end);
}

function main() {
  const src = fs.readFileSync(MAIN, "utf8");
  const chunk = extractProxySource(src);
  // main.js와 동일 스코프 구성: http/https/API_UPSTREAM/HOP_HEADERS/proxyApi
  const sandbox = new Function(
    "http", "https", "API_UPSTREAM",
    chunk + "\nreturn { proxyApi, HOP_HEADERS };"
  );
  const { proxyApi } = sandbox(http, https, API_UPSTREAM);

  // 버그 재발 감지: 소스에 'http.request(' + 'protocol: "https:"' 조합이 남아있으면 FAIL
  const buggy = /http\.request\(\s*\{[^}]*protocol:\s*"https:"/s.test(chunk);
  console.log(`[STATIC] 이전 버그 패턴(http.request + https:) 잔존: ${buggy ? "FAIL — 잔존!" : "PASS — 없음"}`);

  const server = http.createServer((req, res) => {
    if ((req.url || "").startsWith("/api/")) proxyApi(req, res);
    else { res.writeHead(404); res.end("not found"); }
  });

  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    const get = (path) => new Promise((resolve, reject) => {
      const r = http.get(base + path, { headers: { "user-agent": "SERTZ-Desktop-Test" } }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      r.setTimeout(15000, () => r.destroy(new Error("test timeout")));
      r.on("error", reject);
    });

    (async () => {
      let pass = 0, fail = 0;
      try {
        // 1) GET /api/version — 프록시 https 업스트림 왕복
        const v = await get("/api/version");
        const ok1 = v.status === 200;
        let ver = null;
        try { ver = JSON.parse(v.body); } catch {}
        const hasVer = ver && (ver.latest || ver.version || ver.code != null || ver.versionCode != null);
        console.log(`[GET /api/version] status=${v.status} body=${v.body.slice(0, 160)}`);
        console.log(`  → ${ok1 && hasVer ? "PASS" : "FAIL"} (status 200 ${ok1 ? "OK" : "BAD"}, JSON ${hasVer ? "OK" : "BAD"})`);
        ok1 && hasVer ? pass++ : fail++;

        // 2) 응답 헤더 위생 — transfer-encoding 등 hop-by-hop 미전달 확인
        const te = v.headers["transfer-encoding"];
        console.log(`[HEADERS] transfer-encoding 전달: ${te ? `FAIL (${te})` : "PASS (제거됨)"}`);
        te ? fail++ : pass++;

        // 3) 존재하지 않는 API → 업스트림 404가 그대로 프록시되는지 (크래시 없이)
        const nf = await get("/api/__no_such__");
        console.log(`[GET /api/__no_such__] status=${nf.status} → ${nf.status === 404 || nf.status === 405 ? "PASS" : "CHECK"}`);
        (nf.status === 404 || nf.status === 405) ? pass++ : fail++;

        console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
      } catch (e) {
        console.log(`[RUNTIME] 프록시 처리 중 예외: ${e.message}\n${e.stack}`);
        console.log(`\n=== RESULT: ${pass} PASS / ${fail + 1} FAIL ===`);
      } finally {
        server.close();
        process.exit(fail > 0 ? 1 : 0);
      }
    })();
  });
}

main();
