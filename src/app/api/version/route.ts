import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

/* vc233 (#4 "클라이언트 자동 업데이트 안됨")
 *
 *  [문제] 이 파일의 LATEST_VERSION/LATEST_CODE 가 수동 하드코딩이라
 *   버전을 올릴 때마다 갱신을 잊으면 서버가 **옛 버전**을 최신이라고 답한다.
 *   클라이언트는 `compareVer(서버.latest, 내버전) > 0` 일 때만 업데이트 배너를
 *   띄우므로, 서버가 더 낮으면 배너가 **절대** 뜨지 않는다.
 *   실제로 1.4.54/vc214 에 멈춰 있어 앱이 1.4.57 이어도 "최신"으로 판정됐다.
 *
 *  [해결] 버전의 유일한 출처인 package.json 에서 파생한다.
 *   이제 package.json 만 올리면 서버 응답도 자동으로 따라온다(수동 싱크 제거).
 *   versionCode 는 versionName 에서 규칙적으로 유도할 수 없으므로,
 *   APK 파일명에 쓰이는 값만 build.gradle 과 맞추면 된다 — 아래 REQUIRED_CODE.
 *   (불일치를 빌드 시점에 잡기 위해 3번째 숫자로 경고를 남긴다) */
import pkg from "../../../../package.json";
import { readFileSync } from "node:fs";

const LATEST_VERSION: string = (pkg as { version: string }).version;
/* versionCode 는 package.json 에 없다 — 릴리스마다 1씩 증가하는 별도 축이다.
 *  vc238 — 손으로 맞추다 세 릴리스 연속 어긋났다(236 잔존 → vc236.apk 404).
 *  APK 파일명과 릴리스 태그의 유일한 출처인 build.gradle 에서 파생한다.
 *
 *  vc241 — **Vercel 에는 android/ 가 없다**(.vercelignore). build.gradle 만 읽으면 파싱이
 *  조용히 실패해 code:0 · SERTZ-vc0.apk 를 응답했다(운영 실측). 커밋된 android-version.json
 *  을 2차 소스로 두고, 그것도 없으면 package.json 버전으로 태그만이라도 맞춘다. */
function readAndroidVersion(): { code: number; name: string } {
  try {
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    const code = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1] ?? 0);
    if (code) return { code, name: /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? "" };
  } catch {
    /* Vercel: android/ 제외됨 */
  }
  try {
    const v = JSON.parse(readFileSync("android-version.json", "utf8")) as { code?: number; name?: string };
    if (v.code) return { code: Number(v.code), name: String(v.name ?? "") };
  } catch {
    /* 없으면 package.json */
  }
  return { code: 0, name: "" };
}
const androidVer = readAndroidVersion();
const LATEST_CODE = androidVer.code;
/* 태그는 릴리스 워크플로우가 만드는 이름(v{versionName})과 일치해야 한다.
 *  package.json 과 build.gradle versionName 이 다르면 APK 실제 위치를 따라간다. */
const LATEST_TAG = androidVer.name || LATEST_VERSION;
const VERSION_NOTE =
  `v${LATEST_VERSION} (vc${LATEST_CODE}) — 실제 돌진으로 회피 수련, 보스 공격 기회·남은 시간 표시.`;
const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.CERTZ_BUILD_SHA?.trim() || null;
const RELEASE_BASE = `https://github.com/apple01234/CERTZ/releases/download/v${LATEST_TAG}`;
const APK_MIRROR =
  /* 파일명의 vc{code} 는 build.gradle versionCode 와 일치해야 한다(불일치 시 404).
   * vc233 — 버전 태그를 LATEST_VERSION 에서 파생시켜 버전 범프 시 URL 이 자동 추종. */
  `${RELEASE_BASE}/SERTZ-vc${LATEST_CODE}.apk`;
/* v1.4.39 — 데스크톱 클라이언트 자동 업데이트용 EXE 주소.
 *  종전엔 클라이언트가 스스로 업데이트를 확인하는 코드가 아예 없어, 새 빌드마다
 *  사용자가 릴리스 페이지에서 직접 받아 재설치해야 했다.
 *  electron/main.js 의 checkForUpdates() 가 이 값을 읽어 자동 다운로드·설치한다. */
const EXE_MIRROR = `${RELEASE_BASE}/SERTZ-vc${LATEST_CODE}-setup.exe`;

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    exe: EXE_MIRROR,
    guide: "/apk-guide.html",
    commitSha: COMMIT_SHA,
  });
}
