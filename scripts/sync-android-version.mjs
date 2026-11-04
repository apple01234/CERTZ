#!/usr/bin/env node
/**
 * android-version.json 동기화 — build.gradle 의 versionCode/versionName 을 커밋 가능한 JSON 으로 복제.
 *
 * 왜 필요한가: Vercel 은 .vercelignore 로 android/ 를 제외하므로 서버 번들에서
 * build.gradle 을 읽을 수 없다. /api/version 과 APK 리다이렉트가 build.gradle 만 신뢰하면
 * versionCode 파싱이 조용히 실패해 code:0 · SERTZ-vc0.apk 같은 깨진 링크를 응답한다(vc240 실측).
 *
 * 사용: 버전을 올린 뒤 `node scripts/sync-android-version.mjs`
 *       package.json 의 "prebuild" 에 물려 두면 빌드마다 자동 갱신된다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const GRADLE = "android/app/build.gradle";
const OUT = "android-version.json";

if (!existsSync(GRADLE)) {
  console.error(`[android-version] ${GRADLE} 없음 — android 디렉터리가 있는 저장소에서만 실행하세요`);
  process.exit(1);
}

const gradle = readFileSync(GRADLE, "utf8");
const code = /versionCode\s+(\d+)/.exec(gradle)?.[1];
const name = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];

if (!code || !name) {
  console.error("[android-version] versionCode/versionName 파싱 실패 — build.gradle 형식을 확인하세요");
  process.exit(1);
}

const next = { code: Number(code), name };
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;

if (prev && prev.code === next.code && prev.name === next.name) {
  console.log(`[android-version] 변경 없음 — vc${next.code} / ${next.name}`);
  process.exit(0);
}

writeFileSync(OUT, JSON.stringify(next, null, 2) + "\n");
console.log(`[android-version] 갱신 — vc${next.code} / ${next.name} → ${OUT}`);
