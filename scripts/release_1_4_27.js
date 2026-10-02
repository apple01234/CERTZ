#!/usr/bin/env node
/* GitHub release v1.4.27 생성 + APK 업로드 (토큰: .secrets → remote URL 폴백) */
const { execSync } = require("child_process");
const fs = require("fs");

const ROOT = "/home/z/my-project";
const TAG = "v1.4.27";
const APK = `${ROOT}/download/SERTZ-v1.4.27.apk`;
const REPO = "apple01234/CERTZ";

function token() {
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
  console.log("토큰 확인:", T.slice(0, 4), "len", T.length, "| APK:", fs.existsSync(APK), fs.statSync(APK).size);
  let rel = null;
  const list = await fetch(`https://api.github.com/repos/${REPO}/releases`, { headers: H() })
    .then(r => r.json())
    .catch(e => { throw new Error("목록조회 실패: " + e.message + " | cause: " + (e.cause?.message || e.cause || "-")); });
  rel = Array.isArray(list) ? list.find(x => x.tag_name === TAG) : null;

  if (!rel) {
    rel = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      method: "POST", headers: H({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: "main",
        name: "SERTZ v1.4.27 — 채팅·파티 부활 + 포탈 줌 픽스",
        body: [
          "## v1.4.27 (versionCode 119)",
          "",
          "### 신규/복원",
          "- **채팅·파티 부활**: Vercel 서버리스 릴레이 폴링 방식(소켓 불필요) — 실제 멀티 채팅·파티 동작",
          "- 채팅 수신 폴링 미기동 픽스(발송은 되는데 화면에 안 보이던 버그)",
          "- 채팅 발신자명 '이름없음' 픽스 → 캐릭터명 정상 표기",
          "- PC 포탈 이동 후 화면 축소(줌아웃) 픽스",
          "- 신규 설치분 계정/채팅 API 기본 주소(sertz.vercel.app) 연결 픽스",
          "",
          "### v1.4.26 포함",
          "- 자동전투 개선: 포위 시 선제 물약·HP 안전망 40%·MP 회복선 35%·후퇴 중 반격",
          "",
          "### 설치",
          "- 아래 APK 다운로드 후 설치 (기존 버전 위에 덮어쓰기 가능 — 데이터 보존)",
          "- 무결성: md5 `e8b7e11120e2ecb37a5eb4b20c8d015a` / sha1 `13af522d4c696c975343ee73ff3685068348839f` / 135,551,516B",
        ].join("\n"),
        draft: false, prerelease: false,
      }),
    }).then(r => r.json());
    console.log("릴리스 생성:", rel.id, rel.html_url);
  } else {
    console.log("기존 릴리스 재사용:", rel.id);
  }

  // 2) 기존 에셋 정리 후 업로드
  for (const a of (rel.assets || [])) {
    if (a.name === "SERTZ-v1.4.27.apk") {
      await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${a.id}`, { method: "DELETE", headers: H() });
      console.log("기존 에셋 삭제:", a.id);
    }
  }
  const size = fs.statSync(APK).size;
  const up = await fetch(`https://upload.github.com/repos/${REPO}/releases/${rel.id}/assets?name=SERTZ-v1.4.27.apk`, {
    method: "POST",
    headers: H({ "Content-Type": "application/vnd.android.package-archive", "Content-Length": String(size) }),
    body: fs.createReadStream(APK),
    duplex: "half",
  }).then(r => r.json());
  console.log("업로드:", up.state, up.size, up.browser_download_url);
}
main().catch(e => { console.error("실패:", e.message); process.exit(1); });
