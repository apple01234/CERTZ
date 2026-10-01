/**
 * verify_v325.js — v3.0.25 검증
 *  [A] 조이스틱 풀당김 감속 버그 수학 시뮬레이션 (구 공식 vs 신규 공식)
 *  [B] 정적 검증 — 수정 코드 존재·버전 문자열·배포 경로·멀티 서버 주소
 */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = "/home/z/my-project";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? " — " + extra : ""}`); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

console.log("[A] 조이스틱 수학 시뮬레이션 — JOY_RADIUS=64");
const R = 64;
// TouchControls onJoyMove 로직 그대로 미러링
function sendVector(len, useFix) {
  const raw = Math.min(1, len / R);
  const t = Math.max(0, Math.min(1, (raw - 0.08) / 0.34));
  const boosted = t <= 0 ? 0 : Math.pow(t, 0.58);
  if (!(boosted > 0) || !(len > 0.001)) return { vx: 0, vy: 0 };
  let dx = len, dy = 0; // 오른쪽으로 당김 (단위 방향)
  if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
  if (useFix) {
    const outLen = Math.hypot(dx, dy) || 1;
    return { vx: (dx / outLen) * boosted, vy: (dy / outLen) * boosted };
  }
  return { vx: (dx / len) * boosted, vy: (dy / len) * boosted };
}
const lens = [16, 32, 48, 64, 80, 96, 128, 160, 200, 300];
let newAlwaysFull = true, oldTable = [];
for (const L of lens) {
  const nv = Math.hypot(sendVector(L, true).vx, sendVector(L, true).vy);
  const ov = Math.hypot(sendVector(L, false).vx, sendVector(L, false).vy);
  oldTable.push(`${L}px:구=${ov.toFixed(2)}/신=${nv.toFixed(2)}`);
  if (L >= R && Math.abs(nv - 1) > 1e-9) newAlwaysFull = false; // 반경 이상 = 반드시 풀속
}
console.log("   ", oldTable.join("  "));
ok("신규 공식: 64px 이상 당김 = 항상 풀속(1.0)", newAlwaysFull);
const ov128 = Math.hypot(sendVector(128, false).vx, sendVector(128, false).vy);
ok("구 공식 버그 재현: 128px 당김 = 반속(0.5)", Math.abs(ov128 - 0.5) < 1e-9, `구=${ov128.toFixed(3)}`);
// 방향 보존: 대각선 45도, 128px
{
  const len = 128, ang = Math.PI / 4;
  const raw = 1, t = Math.max(0, Math.min(1, (raw - 0.08) / 0.34)), boosted = Math.pow(t, 0.58);
  let dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
  if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
  const outLen = Math.hypot(dx, dy) || 1;
  const vx = (dx / outLen) * boosted, vy = (dy / outLen) * boosted;
  const outAng = Math.atan2(vy, vx);
  ok("신규 공식: 방향 보존(45도 대각선, 128px)", Math.abs(outAng - ang) < 1e-9, `각도차=${Math.abs(outAng - ang).toExponential(2)}`);
}

console.log("[B] 정적 검증");
const tc = read("src/components/game/TouchControls.tsx");
ok("TouchControls: 클램프 후 정규화(outLen) 적용", tc.includes("const outLen = Math.hypot(dx, dy) || 1") && tc.includes("(dx / outLen) * boosted"));
ok("TouchControls: 구 버그 코드((dx / len) * boosted) 소멸", !tc.includes("(dx / len) * boosted"));
ok("TouchControls: v3.0.25 주석 존재", tc.includes("v3.0.25 버그 수정"));

const gradle = read("android/app/build.gradle");
ok("gradle: versionCode 39", gradle.includes("versionCode 39"));
ok("gradle: versionName 3.0.25", gradle.includes('versionName "3.0.25"'));

const overlays = read("src/components/game/Overlays.tsx");
ok("배지: v3.0.25", overlays.includes("v3.0.25"));

const bash = read("scripts/build_apk.sh");
ok("build_apk.sh: SERTZ-v3.0.25.apk 출력", bash.includes("SERTZ-v3.0.25.apk") && !bash.includes("SERTZ-v3.0.24.apk"));

const server = read("server.js");
ok("server.js: /SERTZ-v3.0.25.apk 다운로드 라우트", server.includes('"/SERTZ-v3.0.25.apk"') && server.includes('download/SERTZ-v3.0.25.apk'));
ok("server.js: 구 3.0.24 경로 소멸", !server.includes("SERTZ-v3.0.24.apk"));

const sc = read("src/components/game/ServerConnect.tsx");
ok("ServerConnect: 기본 서버 = https://sertz1234.space-z.ai", sc.includes('DEFAULT_SERVER = "https://sertz1234.space-z.ai"'));
let stale = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/node_modules|\.next|android\/app\/src\/main\/assets|download/.test(p)) walk(p); }
    else if (/\.(ts|tsx|js)$/.test(f.name)) {
      const c = fs.readFileSync(p, "utf8");
      if (c.includes("preview-6a95efa8")) stale.push(p);
    }
  }
};
walk(path.join(ROOT, "src"));
ok("src 전수: 만료 주소(preview-6a95efa8) 소멸", stale.length === 0, stale.join(", "));

const apk = path.join(ROOT, "download/SERTZ-v3.0.25.apk");
ok("download/: SERTZ-v3.0.25.apk 존재", fs.existsSync(apk), fs.existsSync(apk) ? `${(fs.statSync(apk).size / 1048576).toFixed(1)}MB` : "");
for (const i of [1, 2, 3]) {
  ok(`download/: part${i} 존재`, fs.existsSync(`${apk}.part${i}`));
}
const guide = path.join(ROOT, "download/APK_다운로드_안내.txt");
ok("download/: 안내 txt가 v3.0.25 기술", fs.existsSync(guide) && fs.readFileSync(guide, "utf8").includes("v3.0.25"));

console.log("[C] 피드백 8건 (v3.0.25)");
const ws = read("src/game/scenes/WorldScene.ts");
const autoTravelUses = (ws.match(/this\.autoTravelPortal\(\)/g) || []).length;
ok("#2 자동 길찾기 제거: tickAutoHunt의 구역간 이동 삭제 (화살표 안내 2회만 사용)", autoTravelUses === 2 && ws.includes("#길찾기제거"), `사용 ${autoTravelUses}회`);
ok("#1 다음 퀘스트 자동 추적: enterPortal에서 추적 스테이지 동행", ws.includes("#다음퀘스트 자동추적") && ws.includes("this.trackedStage = next"));
ok("#3 자동사냥: 퀘스트 대상 몬스터 최우선 선택", ws.includes("def.key === qKey"));
ok("#3 자동사냥: 적 없음 배회(리스폰 탐색)", ws.includes("autoWanderTick") && ws.includes("randomOpenPointNear"));
ok("#2 어시스트 화살표 대형화+라벨: 스케일 2.7·목표명 표시", ws.includes("setScale(2.7") && ws.includes("edgeLabel") && ws.includes("questTargetLabel"));
ok("#7 퀘스트 설명 (그루) 제거", !read("src/game/stages.ts").includes("마리(그루)"));

const eb = read("src/components/game/EventBus.ts");
const pn = read("src/components/game/Panels.tsx");
ok("#4 퀘스트창·보스창 분리: PanelKind boss + BossReplayPanel + 라우팅", eb.includes('"boss" | null') && pn.includes("function BossReplayPanel") && pn.includes('panel === "boss"'));
ok("#4 퀘스트창에 보스창 연결 버튼", pn.includes("전용 창 열기"));

const db = read("src/components/game/DialogueBox.tsx");
ok("#8 보스 초상화 404 수정: idle 프레임 파일명 사용", db.includes("boss_nidhog_idle0") && db.includes("def.tex}_idle0"));
ok("#8 초상화 로드 실패 시 깨진 이미지 숨김", db.includes("onError") && db.includes("portraitOk"));
ok("#6 초상화 원본 비율 유지(object-cover·top)", db.includes("object-cover object-top"));

// 초상화 매핑 파일 전수 존재 검사 (신규 방식: NPC 매핑 + 보스 _idle0)
{
  const npcTex = [...db.matchAll(/tex:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
  const st = read("src/game/stages.ts");
  const bossTex = [...st.matchAll(/tex:\s*"(boss[a-z0-9_]*)"/g)].map((m) => `${m[1]}_idle0`);
  const missing = [...new Set([...npcTex, ...bossTex])].filter((t) => !fs.existsSync(path.join(ROOT, "public/assets", `${t}.png`)));
  ok("#8 초상화 파일 전수 존재", missing.length === 0, missing.join(", ") || `${npcTex.length + bossTex.length}종 전부 OK`);
}

// 엘릭서 아이콘 보라 검증 (PIL)
{
  const { execSync } = require("node:child_process");
  let purple = false, detail = "";
  try {
    detail = execSync(
      `python3 -c "from PIL import Image; from collections import Counter; im=Image.open('${ROOT}/public/assets/item_potion_elixir.png').convert('RGBA'); c=[p for p in Counter(im.getdata()).most_common(8) if p[0][3]>60]; purple=sum(n for (r,g,b,a),n in c if b>r>=g and b>40); red=sum(n for (r,g,b,a),n in c if r>b*1.5 and r>60); print(f'{purple}/{red}')"`,
      { encoding: "utf8" }
    ).trim();
    const [pu, re] = detail.split("/").map(Number);
    purple = pu > 100 && re < 30;
  } catch (e) {
    detail = `오류 ${e.message.slice(0, 40)}`;
  }
  ok("#5 엘릭서 아이콘 보라색", purple, detail);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
