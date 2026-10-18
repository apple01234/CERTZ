import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.16";
const LATEST_CODE = 158;
const VERSION_NOTE =
  "v1.0.16 (vc158) — 보완 기획서 사이클(보안·최적화·접근성·BM·빌드 일괄): ①세션 토큰 SHA-256 해시 저장 전환(원문 저장 폐기 — DB 유출로도 세션 탈취 불가)+세션 TTL 30일→14일 — 기존 세션은 1회 재로그인 필요 ②클라우드세이브 chars 백업 소실 방지 ③채팅·파티 인증 강화(cid 위조 강퇴·관리자 사칭 차단) ④admin 예약 ID 선점 차단 ⑤소스 평문 자격증명 제거 ⑥릴리스 서명 키 저장소 제거→CI Secret 복원 ⑦API 실패 은폐 수정(무효 토큰이 빈 목록으로 위장하지 않음 — 503 사유 반환) ⑧일일특가 표시가=청구가 정합 ⑨구매 2단계 확인 모달(오탭 결제 차단) ⑩스타포스 확률 공시(15단계 성공률·하락·주문서) ⑪최적화: 획득 텍스트 풀 분리·피해로그 링버퍼·클로저 승격·히트스파크 상수화·장판 Vector2 재사용·스킬 판정 스크래치 버퍼(48곳)·세이브 직렬화 1회 통일 ⑫히트스톱이 자가치유에 잘리던 버그 수정(타격감 복원) ⑬접근성: 캐시상점 키보드 내비·모달 role/aria 시맨틱·터치 타깃 히트 영역 확장·텍스트 대비 WCAG AA 상향(255곳)·광고 실패 사유 분기·결제/환불 FAQ·shadcn 잔재 48개 제거+번들 유출 차단 ⑭빌드: ignoreBuildErrors 제거(타입 강제)·lint 게이트 CI 강제·EXE 릴리스 태그 동적화·lockfile 버전 정합 ⑮콘텐츠: 적 고유 개성 21종 보충+재림 보스 전리품 3종(vord·jorm·nagr)";
const APK_MIRROR =
  /* vc158 — APK는 릴리스 태그 v1.0.16에 있다(이전 태그는 vc157까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.16/SERTZ-vc158.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
