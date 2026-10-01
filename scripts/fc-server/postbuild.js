/**
 * SERTZ FC 배포 포스트빌드 (v3.1) — `next build` 직후 실행 (package.json build 스크립트)
 *
 *  배경 (멀티 안됨 근본 수정):
 *   - FC 배포 스크립트(.zscripts/build.sh)는 .next/standalone 의 "자동생성 server.js"를
 *     next-service-dist/server.js 로 복사해 `bun server.js` 로 구동한다.
 *   - 자동생성 server.js 에는 socket.io 가 없으므로 라이브 서버(/socket.io 404 실측)에서
 *     웹·APK 멀티가 모두 죽어 있었다.
 *
 *  하는 일:
 *   1) .next/static, public 을 standalone 에 복사 (기존 package.json 의 cp 체인 대체)
 *   2) scripts/fc-server/fc-entry.js 를 Bun.build 로 단일 CJS 번들로 생성
 *      → .next/standalone/fc-multi.js (socket.io 전부 인라인)
 *   3) 자동생성 server.js 를 next-server.js 로 개명
 *   4) 래퍼 server.js 작성: http.createServer 를 한 번 가로채 http.Server 를 캡처한 뒤
 *      fc-multi.js 로 멀티플레이를 부착하고 next-server.js 를 require 한다
 *   → FC 런타임(`bun server.js`)은 코드 변경 없이 멀티플레이가 살아난다.
 */
const { existsSync, mkdirSync, renameSync, writeFileSync, cpSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

async function main() {
  if (!existsSync(STANDALONE)) {
    console.warn("[fc-postbuild] .next/standalone 없음 — APK export 빌드로 보고 건너뜀");
    return;
  }

  /* 1) static / public 복사 (기존 cp 체인 동일 동작) */
  const staticSrc = path.join(ROOT, ".next", "static");
  const staticDst = path.join(STANDALONE, ".next", "static");
  if (existsSync(staticSrc)) {
    mkdirSync(path.dirname(staticDst), { recursive: true });
    cpSync(staticSrc, staticDst, { recursive: true });
    console.log("[fc-postbuild] .next/static → standalone 복사 완료");
  }
  const publicSrc = path.join(ROOT, "public");
  const publicDst = path.join(STANDALONE, "public");
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDst, { recursive: true });
    console.log("[fc-postbuild] public → standalone 복사 완료");
  }

  /* 2) fc-entry → 단일 CJS 번들 (socket.io 인라인)
   *    ⚠ Bun.build 는 outdir 없이는 outfile 을 무시하므로, 메모리 빌드 후 직접 기록한다 */
  const bundleOut = path.join(STANDALONE, "fc-multi.js");
  if (typeof Bun === "undefined") {
    throw new Error("[fc-postbuild] Bun 런타임이 필요합니다 (bun run build 로 실행할 것)");
  }
  const result = await Bun.build({
    entrypoints: [path.join(__dirname, "fc-entry.js")],
    target: "node",
    format: "cjs",
    minify: true,
    sourcemap: "none",
  });
  if (!result.success) {
    console.error("[fc-postbuild] 번들 실패:", result.logs);
    throw new Error("fc-multi 번들링 실패");
  }
  const jsOutput = result.outputs.find((o) => o.kind === "entry-point") || result.outputs[0];
  const bundleText = await jsOutput.text();
  writeFileSync(bundleOut, bundleText, "utf8");
  console.log(`[fc-postbuild] fc-multi.js 번들 완료 (socket.io 인라인, ${Math.round(bundleText.length / 1024)}KB)`);

  /* 3) 자동생성 server.js 개명 (멱등 — 래퍼 마커로 자동생성본만 판별)
   *    ⚠ 재실행 시 server.js 는 이미 래퍼다: 이때 next-server.js 를 건드리지 않는다.
   *      (래퍼를 next-server.js 로 개명하면 require('./next-server.js') 순환 참조로
   *       서버가 에러 없이 조용히 종료되는 사고 발생 — 실측됨) */
  const WRAPPER_MARKER = "SERTZ standalone 래퍼";
  const autoServer = path.join(STANDALONE, "server.js");
  const nextServer = path.join(STANDALONE, "next-server.js");
  const serverJsContent = existsSync(autoServer)
    ? require("node:fs").readFileSync(autoServer, "utf8")
    : "";
  if (serverJsContent && !serverJsContent.includes(WRAPPER_MARKER)) {
    renameSync(autoServer, nextServer); // 자동생성본 → next-server.js (덮어쓰기)
    console.log("[fc-postbuild] server.js → next-server.js 개명 완료");
  } else if (!serverJsContent && !existsSync(nextServer)) {
    throw new Error("[fc-postbuild] standalone server.js 를 찾을 수 없음 — Next 빌드 산출 확인 필요");
  } else {
    console.log("[fc-postbuild] next-server.js 유지 (이미 개명됨 — 멱등 실행)");
  }

  /* 4) 래퍼 server.js 작성 */
  const wrapper = `/**
 * SERTZ standalone 래퍼 (빌드 시 생성 — scripts/fc-server/postbuild.js)
 *  - Next 자동생성 서버(next-server.js)가 만드는 http.Server 를 캡처해
 *    멀티플레이 소켓 서버(fc-multi.js)를 부착한다. (라이브 멀티 안됨 수정)
 */
const http = require("http");
const origCreateServer = http.createServer;
let captured = false;
http.createServer = function (...args) {
  const srv = origCreateServer.apply(this, args);
  if (!captured && srv && typeof srv.on === "function") {
    captured = true;
    http.createServer = origCreateServer; // 1회만 가로채고 복원
    try {
      require("./fc-multi.js")(srv);
    } catch (e) {
      console.error("[SERTZ-FC] 멀티플레이 부착 실패 — 싱글플레이는 정상 동작:", e && e.message);
    }
  }
  return srv;
};
require("./next-server.js");
`;
  writeFileSync(autoServer, wrapper, "utf8");
  console.log("[fc-postbuild] 래퍼 server.js 작성 완료 — FC 배포 멀티플레이 준비됨");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
