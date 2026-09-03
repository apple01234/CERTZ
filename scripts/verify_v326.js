/* verify_v326.js — v3.0.26 정적·라이브 검증
 *  #75 "1차 전직 퀘스트의 서쪽숲이 없는데??" — 마을 v1 퀘스트·대사·어시스트 라벨을 실존 지역명으로 통일
 *  #76 일퀘(라고스 의뢰)는 전체 스토리 완료(cleared) 후에만 해금 — 수주 대사·퀘스트창·트래커 전부 게이트
 *  + 버전 갱신(versionCode 40) + APK/파트/라우트 실측 */
const fs = require("fs");
const path = require("path");
const ROOT = "/home/z/my-project";
let pass = 0, fail = 0;
const results = [];
function chk(name, cond, detail = "") {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }

/* ---------- [A] #75 서쪽숲 문구 ---------- */
const stages = read("src/game/stages.ts");
const dataTs = read("src/game/data.ts");
const world = read("src/game/scenes/WorldScene.ts");

chk("A1 v1 퀘스트 제목 '숲의 신전으로'", stages.includes('title: "숲의 신전으로"'));
chk("A2 구 제목 '서쪽 숲의 신전으로' 소멸", !stages.includes('title: "서쪽 숲의 신전으로"'));
chk("A3 v1 설명에 실존 지역명+좌표 '숲의 신전'(2-1) 명시", stages.includes("'숲의 신전'(2-1)에 도착해라"));
chk("A4 v1 targetLabel '동쪽 차원문'", stages.includes('targetLabel: "동쪽 차원문"'));
chk("A5 villageIntro '동쪽 차원문을 지나면 숲의 신전이야'", dataTs.includes("동쪽 차원문을 지나면 숲의 신전이야"));
chk("A6 villageIntro 구 문구 '지나면 서쪽 숲.' 소멸", !dataTs.includes("지나면 서쪽 숲."));
chk("A7 어시스트 라벨 reach '▶ 동쪽 차원문'", world.includes('if (q.type === "reach") return "▶ 동쪽 차원문"'));

/* ---------- [B] #76 일퀘 스토리 완료 후 해금 ---------- */
chk("B1 repeatUnlockable → this.cleared 반환", /private repeatUnlockable\(\): boolean \{\s*\n\s*if \(this\.repeatOn \|\| this\.isInterior\) return false;\s*\n\s*return this\.cleared;/.test(world));
chk("B2 cleared 세이브 복원 (savedPlayer.cleared ?? false)", world.includes("this.cleared = savedPlayer.cleared ?? false"));
chk("B3 퀘스트창 repeat emit 게이트 (this.cleared && r)", world.includes("repeat: this.cleared && r ? { title: r.title, desc: r.desc } : null"));
chk("B4 수주 안내 트래커 게이트 (cleared 포함)", /!this\.isInterior && this\.cleared && this\.stageDef\.repeat && !this\.repeatOn/.test(world));
chk("B5 merchantRepeat '아홉 왕국의 스토리를 전부 끝낸' 문구", dataTs.includes("아홉 왕국의 스토리를 전부 끝낸"));
chk("B6 구 완화 문구 '항상 수주 가능' 소멸 (Panels)", !read("src/components/game/Panels.tsx").includes("항상 수주 가능"));
chk("B7 Panels '반복 의뢰 (스토리 완료 후)' 표기", read("src/components/game/Panels.tsx").includes("반복 의뢰 (스토리 완료 후)"));
chk("B8 구 완화 주석 소멸 (WorldScene v3.0.15 #3 완화 설명)", !world.includes("마을 상인과 대화만 하면 항상 수주 가능"));

/* ---------- [C] 버전 갱신 ---------- */
const gradle = read("android/app/build.gradle");
const overlays = read("src/components/game/Overlays.tsx");
const serverJs = read("server.js");
chk("C1 gradle versionCode 40", gradle.includes("versionCode 40"));
chk("C2 gradle versionName 3.0.26", gradle.includes('versionName "3.0.26"'));
chk("C3 gradle 구 버전 소멸 (39/3.0.25)", !gradle.includes("versionCode 39") && !gradle.includes("3.0.25"));
chk("C4 Overlays 배지 v3.0.26", overlays.includes("v3.0.26"));
chk("C5 server.js 라우트 /SERTZ-v3.0.26.apk", serverJs.includes("/SERTZ-v3.0.26.apk"));
chk("C6 server.js 구 라우트 소멸 (3.0.25)", !serverJs.includes("3.0.25"));

/* ---------- [D] 배포물 실측 ---------- */
const dl = p => fs.existsSync(path.join(ROOT, "download", p));
chk("D1 SERTZ-v3.0.26.apk 존재", dl("SERTZ-v3.0.26.apk"));
chk("D2 분할 파트 3개 존재", dl("SERTZ-v3.0.26.apk.part1") && dl("SERTZ-v3.0.26.apk.part2") && dl("SERTZ-v3.0.26.apk.part3"));
chk("D3 join_apk.bat/.sh v3.0.26 갱신", read("download/join_apk.bat").includes("3.0.26") && read("download/join_apk.sh").includes("3.0.26"));
chk("D4 안내 txt v3.0.26 갱신", read("download/APK_다운로드_안내.txt").includes("v3.0.26") && read("download/APK_다운로드_안내.txt").includes("versionCode 40"));
const apkSize = fs.statSync(path.join(ROOT, "download/SERTZ-v3.0.26.apk")).size;
const partSum = ["1", "2", "3"].reduce((s, n) => s + fs.statSync(path.join(ROOT, `download/SERTZ-v3.0.26.apk.part${n}`)).size, 0);
chk("D5 파트 합계 = 원본 크기", apkSize === partSum, `${apkSize} vs ${partSum}`);

/* ---------- [E] 라이브 서버 ---------- */
const http = require("http");
function head(urlPath) {
  return new Promise(res => {
    const req = http.request({ host: "localhost", port: 3000, path: urlPath, method: "GET" }, r => { r.resume(); r.on("end", () => res({ code: r.statusCode, len: Number(r.headers["content-length"] ?? 0) })); });
    req.on("error", () => res({ code: 0, len: 0 }));
    req.end();
  });
}
(async () => {
  const root = await head("/");
  const apk = await head("/SERTZ-v3.0.26.apk");
  const guide = await head("/APK_download_guide.txt");
  chk("E1 라이브 루트 200", root.code === 200);
  chk("E2 라이브 APK 라우트 200 + 크기 일치", apk.code === 200 && apk.len === apkSize, `code=${apk.code} len=${apk.len}`);
  chk("E3 라이브 안내 txt 200", guide.code === 200);

  console.log("=== verify_v326 결과 ===");
  results.forEach(r => console.log(r));
  console.log(`\n총 ${pass + fail}항목 — PASS ${pass} / FAIL ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
