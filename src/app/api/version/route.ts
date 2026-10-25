import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.5";
const LATEST_CODE = 183;
const VERSION_NOTE =
  "v1.3.5 (vc183) — ①적 방어력 도입: 잡몹 30종 체급별 정액+비율 방어(늑대 2/2% ~ 돌골렘 30/13%), 보스 기본 25/10%(카오스 14%). 최소 피해 1·감소율 상한 75% 안전장치. 종전엔 적이 100% 피해를 받아 단단한 골렘과 물렁한 박쥐가 같았고 후반 적이 종이처럼 녹았다. ②검은 사각형 VFX 수리: 18종 중 12종이 알파 100% 불투명(검은 배경 잔존)이라 NORMAL/Canvas 폴백에서 검은 네모가 그려졌다 — 휘도→알파 추출로 12종 변환(무손실). ③20Hz 고정 틱 시뮬: 몬스터·보스 AI를 50ms 고정 스텝으로 분리(실측 18~19Hz). 기기 성능과 무관하게 반응 속도 일정, AI 판정 몰림(발열 스파이크) 해소. ④시드 기반 결정론 난수(Xorshift32): ?seed=1234 로 판을 고정하면 100% 재현 — 버그 추적·리플레이 가능. ⑤보스 아틀라스 7종 프레임 격자 수리. ⑥여캐 얼굴 특징(볼터치·호박눈·입술) 복원. ⑦WebGL 컨텍스트 손실 유예 4초→15초(첫 유실) — 복구 가능한 상황에서 전투를 통째로 날리던 문제.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.5/SERTZ-vc183.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
