/**
 * 레이어 스택 — 리버스 엔지니어링 실측(CTF 게임 `COBB CAN MOVE v1.7`) 기반.
 *
 * 분석 근거
 *   RE로 14개 맵의 레이어 정의를 추출한 결과, 게임 맵이 **12개 레이어를 명시적 순서**로
 *   쌓고 있었다(`docs/RE_LAYER_STACK.md`). SERTZ는 depth 0~26 이 코드 곳곳에 흩어져
 *   "무엇이 무엇 위에 그려지는가"가 한눈에 보이지 않았다.
 *
 * 실측된 순서 (game / game finale 맵, 12~13레이어 동일)
 *   0 bg         배경 (tint 0,0,0 — 순수 어둠)
 *   1 tilemap    지형 타일
 *   2 floor      바닥 장식
 *   3 gm         게임 로직 오브젝트
 *   4 monster    적
 *   5 particles  파티클
 *   6 lighting   광원 (tint 0,0,0)
 *   7 glyphs     문자/이펙트
 *   8 hud        HUD
 *   9 invis      숨김 레이어
 *  10 pause      일시정지 오버레이
 *  11 global     전역 (bloom·tarp 이펙트)
 *
 * SERTZ 적용 방침
 *   **기존 depth 값을 바꾸지 않는다.** 0~26 을 쓰는 코드가 100곳이 넘어 일괄 치환은
 *   회귀 위험이 크다. 대신 이 상수를 **새로 추가하는 오브젝트**와 **경계가 모호한 곳**에만
 *   쓴다. 기존 값과의 충돌을 피하기 위해 실측 순서를 SERTZ 스케일(×10)로 확장했다.
 *
 *   기존 0~26  →  지형·캐릭터·이펙트 (건드리지 않음)
 *   신규 100+  →  레이어 경계가 명확해야 하는 오브젝트 (광원·HUD·오버레이)
 */
export const LAYER = {
  /** 배경 — 카메라 배경색·패럴랙스 뒤판 */
  BG: 0,
  /** 지형 타일 (기존 depth 1~4 대역) */
  TILEMAP: 1,
  /** 바닥 장식 (기존 2.5~3) */
  FLOOR: 3,
  /** 게임 오브젝트 (플레이어·NPC) */
  GM: 12,
  /** 적 */
  MONSTER: 11,
  /** 파티클·VFX (기존 13~26) */
  PARTICLES: 20,
  /** 광원 — 어둠 위에 얹히는 조명 */
  LIGHTING: 100,
  /** 문자·글리프 이펙트 */
  GLYPHS: 22,
  /** HUD (화면 고정) */
  HUD: 200,
  /** 숨김 레이어 (디버그·비활성) */
  INVIS: 900,
  /** 일시정지 오버레이 */
  PAUSE: 1000,
  /** 전역 오버레이 (블룸·비네트·페이드) */
  GLOBAL: 3000,
} as const;

/** 실측에서 확인된 `bloom` 이펙트가 13/14 맵에 항상 깔려 있었다.
 *  SERTZ는 `addAmbientBloom` 이 그 역할을 하지만 보스전·저사양에서 꺼진다.
 *  이 값은 "글로벌 오버레이가 HUD·일시정지보다 위"임을 보장하는 데 쓴다. */
export const LAYER_ORDER: readonly string[] = [
  "bg", "tilemap", "floor", "gm", "monster", "particles",
  "lighting", "glyphs", "hud", "invis", "pause", "global",
];

/**
 * 레이어별 기본 tint — CTF 실측 분포.
 *
 * 14개 맵 · 12~13레이어 · 총 69개 레이어 tint 를 집계한 결과는 두 값으로 수렴했다.
 *   rgb(64, 81, 91) = #40515b   × 53회   지형·오브젝트 기본 톤 (청회색)
 *   rgb(0, 0, 0)    = #000000   × 15회   bg·lighting 전용 (순수 어둠)
 *
 * 즉 "지형은 청회색, 배경과 광원은 검정"이 이 장르의 관례다.
 * SERTZ 는 스테이지마다 `groundTint` 를 따로 주므로 지형은 그대로 두고,
 * **bg·lighting 두 레이어만** 이 관례를 적용한다(어둠 위에 광원이 얹히는 구조).
 */
export const LAYER_TINT = {
  /** 배경 — 순수 어둠. 스테이지 bg 색과 별개로 "가장 뒤"는 항상 어둡다. */
  BG: 0x000000,
  /** 광원 — 어둠을 덮는 레이어. 개별 광원이 자기 색을 가지므로 기본은 검정. */
  LIGHTING: 0x000000,
  /** 지형 기본 톤 — `groundTint` 미지정 스테이지의 폴백. */
  FLOOR_FALLBACK: 0x40515b,
} as const;

