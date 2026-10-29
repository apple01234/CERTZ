import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.40";
const LATEST_CODE = 202;
const VERSION_NOTE =
  "v1.4.40 (vc202) — ①계열별 무기 5종 완성: 전사=검(신규 제작)·궁수=활·마법사=지팡이·도적=표창·해적=총. 종전엔 전사가 무기를 들지 않았고 도적 표창 에셋이 등록만 된 채 미사용이었다. ②모바일 3D 연출 복구 — 기기 판정이 모바일 UA만 보고 3D VFX 를 전면 차단해 Galaxy S20+ 같은 상위 기기에서도 궁극기 3D 카메라·이펙트가 사라지던 문제를 코어 수·메모리 기준으로 교체. ③스킬 아이콘 텍스트는 아이콘 배경 레이어 분리로 잘림 없이 2줄 표시.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.40/SERTZ-vc202.apk";
/* v1.4.39 — 데스크톱 클라이언트 자동 업데이트용 EXE 주소.
 *  종전엔 클라이언트가 스스로 업데이트를 확인하는 코드가 아예 없어, 새 빌드마다
 *  사용자가 릴리스 페이지에서 직접 받아 재설치해야 했다.
 *  electron/main.js 의 checkForUpdates() 가 이 값을 읽어 자동 다운로드·설치한다. */
const EXE_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.40/SERTZ-vc202-setup.exe";

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
