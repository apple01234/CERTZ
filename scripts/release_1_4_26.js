#!/usr/bin/env node
/* GitHub release v1.4.26 생성 + APK 업로드 (토큰: git remote URL 폴백) */
const { execSync } = require("child_process");
const fs = require("fs");

const ROOT = "/home/z/my-project";
const TAG = "v1.4.26";
const APK = `${ROOT}/download/SERTZ-v1.4.26.apk`;
const REPO = "apple01234/CERTZ";

function token() {
  try { return fs.readFileSync("/home/z/.secrets/github_token", "utf8").trim(); } catch {}
  try { return fs.readFileSync(`${ROOT}/.secrets/github_token`, "utf8").trim(); } catch {}
  const url = execSync("git remote get-url origin", { cwd: ROOT }).toString().trim();
  return url.replace(/^https?:\/\//, "").replace(/@github\.com[\s\S]*$/, "").replace(/^[^:]+:/, "").trim();
}
const T = token();
const H = (extra = {}) => ({
  "Authorization": `Bearer ${T}`,
  "Accept": "application/vnd.github+json",
  "User-Agent": "certz-release",
  ...extra,
});

async function main() {
  // 1) 기존 릴리스 확인 (태그 기준)
  let rel = null;
  const list = await fetch(`https://api.github.com/repos/${REPO}/releases`, { headers: H() }).then(r => r.json());
  rel = Array.isArray(list) ? list.find(x => x.tag_name === TAG) : null;

  if (!rel) {
    rel = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      method: "POST", headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: "main",
        name: "SERTZ v1.4.26 — 멀티 UI 정리 + 자동전투 개선",
        body: [
          "## v1.4.26 (versionCode 118)",
          "",
          "### 멀티 UI 전면 철거",
          "- 화면의 멀티 아이콘·파티·채팅·서버주소 창 철거 (멀티플레이 오프라인 모드 확정 — 작동하지 않던 버튼 정리)",
          "",
          "### 자동전투 개선",
          "- 포위(2체·근접) 시 HP 60% 선제 물약",
          "- HP 안전망 35→40% · MP 회복선 25→35% 상향",
          "- 후퇴 중에도 반격 유지",
          "",
          "### 포함",
          "- v1.4.25: 물약·자동 버튼 기본공격 버튼 바로 아래 이동(230px→74px)",
          "- v1.4.24: APK 연결 상태 표시(헬스체크 기반)",
          "",
          "### 설치",
          "- 기존 세이브 그대로 유지 · 덮어설치 가능 (동일 서명 키)",
          "- md5: `7e7b03cdf1c3f9350bc5490842717aa7`",
          "- sha1: `2ed004617961d31eb0b08b36ceedcef1c4f1d0e0`",
        ].join("\n"),
        draft: false, prerelease: false,
      }),
    }).then(r => { if (!r.ok) throw new Error("create fail " + r.status + " " + r.body()); return r.json(); });
    console.log("release created:", rel.id);
  } else {
    console.log("release exists:", rel.id);
  }

  // 2) 업로드 URL 정리 (?label= 제거)
  const up = rel.upload_url.split("{")[0];
  const buf = fs.readFileSync(APK);
  const upRes = await fetch(`${up}?name=SERTZ-v1.4.26.apk`, {
    method: "POST",
    headers: H({ "Content-Type": "application/vnd.android.package-archive", "Content-Length": buf.length }),
    body: buf,
  });
  if (!upRes.ok) { console.error("UPLOAD FAIL", upRes.status, await upRes.text()); process.exit(1); }
  const asset = await upRes.json();
  console.log("asset uploaded:", asset.name, asset.size, asset.browser_download_url);
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
