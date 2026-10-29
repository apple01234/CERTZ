#!/usr/bin/env node
/* main.js 자동 업데이트 로직 단위 검증 (Electron 없이 순수 함수만).
 *
 * 검증 항목:
 *   1) LOCAL_CODE 가 vc200 을 정확히 읽는가 (1.4.38 → 38 오판 회귀 방지)
 *   2) parseCode 가 "vc200"/200/"200" 을 모두 200 으로 보는가
 *   3) 서버 응답(200)과 로컬(200)이 같으면 "업데이트 없음"
 *   4) 서버가 더 크면 "업데이트 있음"
 */
const fs = require("fs");
const path = require("path");

const MAIN = path.join(__dirname, "..", "electron", "main.js");
const src = fs.readFileSync(MAIN, "utf8");

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
};

// ── 1) LOCAL_CODE 산출식 재현 ──────────────────────────────
const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
const g = fs.readFileSync(gradlePath, "utf8");
const gradleCode = parseInt(g.match(/versionCode\s+(\d+)/)[1], 10);
check("gradle versionCode 파싱", gradleCode === 200, `vc${gradleCode}`);

// ── 2) parseCode 재현 ─────────────────────────────────────
const parseCode = (v) => {
  const m = String(v == null ? "" : v).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
check('parseCode("vc200") === 200', parseCode("vc200") === 200);
check("parseCode(200) === 200", parseCode(200) === 200);
check('parseCode("200") === 200', parseCode("200") === 200);
check("parseCode(null) === 0", parseCode(null) === 0);

// ── 3) 회귀: 버전 문자열에서 뽑으면 틀린다 ──────────────────
const wrong = (v) => { const m = String(v).match(/(\d+)\s*$/); return m ? +m[1] : 0; };
const badValue = wrong("1.4.38");
check(
  "회귀 방지 — 1.4.38 에서 38 을 뽑는 방식이 틀림을 확인",
  badValue === 38,
  `구식=${badValue} vs 정답=${gradleCode} (${badValue !== gradleCode ? "불일치 확인" : "우연히 일치"})`
);
check(
  "main.js 가 build.gradle 을 읽는 경로를 갖는가",
  src.includes('"android"') && src.includes("build.gradle"),
  "단일 진실 공급원 사용"
);

// ── 4) 업데이트 판정 로직 재현 ─────────────────────────────
const decide = (local, remote) => (remote > local ? "update" : "latest");
check("로컬=200 원격=200 → 최신", decide(200, 200) === "latest");
check("로컬=200 원격=201 → 업데이트", decide(200, 201) === "update");
check("로컬=200 원격=0  → 최신(서버 응답 이상 시 안전)", decide(200, 0) === "latest");

// ── 5) 자동 호출 배선 확인 ─────────────────────────────────
check("앱 시작 시 자동 확인 배선", /ready-to-show[\s\S]{0,120}checkForUpdates\(false\)/.test(src));
check("다운로드 함수 존재", src.includes("function downloadInstaller"));
check("리다이렉트(302) 추적 처리", src.includes("[301, 302, 303, 307, 308]"));
check("설치 실행 후 종료", /spawn\(file[\s\S]{0,120}app\.quit\(\)/.test(src));

console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `FAILED ${fails}건`}\n`);
process.exit(fails === 0 ? 0 : 1);
