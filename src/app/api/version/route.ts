import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.54";
const LATEST_CODE = 214;
const VERSION_NOTE =
  "v1.4.54 (vc214) — ①NPC 초상화를 npcface 절차 생성 얼굴에서 월드 npcbody 원본 픽셀 crop으로 교체(15종·31키 — 대사창과 월드 인물이 같은 픽셀). ②로비 미리보기가 인게임과 같은 몸체/FA 프레임 공유(코스튬>GM>전직>피부). ③DLC 10개·재림 15개 사냥터 테마별 BGM 명시 배정(숲 기본곡 fallback 제거). ④5차 아우라 24종·지면 타일 11종 투입, 궁극기 명중 영역 정확화(피해·지연·넉백 불변). ⑤영준 프린세스 시작 마을 추가 + 그랜드 플레닛이 영구 잠기던 게이트 수정.";
const APK_MIRROR =
  /* v1.4.43 — 파일명의 vc{code} 는 build.gradle versionCode 와 일치해야 한다(불일치 시 404). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.54/SERTZ-vc214.apk";
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
