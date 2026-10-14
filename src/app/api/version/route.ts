import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.8";
const LATEST_CODE = 148;
const VERSION_NOTE =
  "v1.0.8 (vc148) — 보스 그리드 긴급 수리: 유저 제보 '보스 그리드를 이상하게 짤랐다' — vc137 잔재 3종 보스(종언의 마룡 아부디토스·재림의 파수꾼 베오르드·혈안의 문지기 가름)이 이질 아트 혼합(컬러 전방+흑룡 실루엣 특수기/보라 악마+붉은 늑대)과 프레임 잘림 상태였던 것을 bsw_ HD 원본의 유저 뷰어 격자(8열×7행 192.5×147 / 6열×7행 204×184) 그대로 재슬라이싱 — 전 보스 12종이 전부 유저 원본 HD 아틀라스로 통일. 베오르드는 boss2 유령선 공유를 해제하고 전용 흑룡 아트 부여. · 동봉: vc147 피드백 30종(쉐이더 정방향/툰강화·s5b 배치·미니맵 중앙·거래 수락 버그·계열별 지면 FX·데드아이 트레이서·YGGDRASIL 아이콘·검은 상자 잔여·키탭·랭킹 즉시 갱신·탑 20/맵 50 캡·궁극기 300/500%·220 각성의 대가 12단계·타이틀 로그인·니플헤임 설원톤·치장 얼굴 복원 7종·30FPS 절전·유니온 x2.5·신화 장비·사연 퀘스트 18종·NPC 의뢰)";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.8/SERTZ-vc148.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
