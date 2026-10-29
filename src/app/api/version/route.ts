import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.43";
const LATEST_CODE = 203;
const VERSION_NOTE =
  "v1.4.43 (vc203) — ①Unity VFX 팩 2종(GameVFX Buff · UNI VFX) 텍스처 33장 투입: 프리팹은 Unity 직렬화라 못 쓰지만 내부 텍스처는 1024² PNG/TGA 이고 팩의 Additive 셰이더 = Phaser ADD 블렌드로 그대로 재현된다. 5차 오라가 육각 보호막으로 바뀌고 궁극기 충격파·폭발 코어·파편이 전용 텍스처로 교체됐다. ②FBX 586개 중 VFX 메시 39개를 Blender 로 GLB 변환(2D 굽기 없음 — 3D 그대로): 2차 궁극기 4개 직업에 메시 층 추가. ③세계관 치환 누락 40건 수리 — UI·타이틀·적 이름에 옛 명칭이 그대로 노출되고 있었다.";
const APK_MIRROR =
  /* v1.4.43 — 파일명의 vc{code} 는 build.gradle versionCode 와 일치해야 한다(불일치 시 404). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.43/SERTZ-vc203.apk";
/* v1.4.39 — 데스크톱 클라이언트 자동 업데이트용 EXE 주소.
 *  종전엔 클라이언트가 스스로 업데이트를 확인하는 코드가 아예 없어, 새 빌드마다
 *  사용자가 릴리스 페이지에서 직접 받아 재설치해야 했다.
 *  electron/main.js 의 checkForUpdates() 가 이 값을 읽어 자동 다운로드·설치한다. */
const EXE_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.43/SERTZ-vc203-setup.exe";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    exe: EXE_MIRROR,
    guide: "/apk-guide.html",
  });
}
