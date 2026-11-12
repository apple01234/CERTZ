/**
 * vc278 — 방 프레이밍(framed room) 스타일.
 *
 * 왜 이 파일이 있나
 * -----------------
 * [사용자 지시] "맵을 던전형식 만으로 말고 이렇게 검은 배경에 작은 맵이 있는 느낌도 ㄱㄱ"
 * 참조 스크린샷(Undertale/고전 RPG 계열): **순수 검정 배경 위에 방 하나가 떠 있고**,
 * 방 밖은 아무것도 없다. SERTZ 는 방이 월드 전체를 채워 화면 가장자리에 늘 바닥이 붙어 있다.
 *
 * [범위 — 사용자 선택] **던전 계열 role 만** 이 스타일을 쓴다. 숲·평원 같은 야외는
 * 기존 연출(지면이 끝없이 이어지는 느낌)을 유지한다. 전체 맵을 바꾸면 "기존 틀 유지"
 * 규칙과 충돌하고 게임 분위기가 균일해진다.
 *
 * [카메라 — 사용자 선택] **방 전체가 한 화면에 들어오게** 한다. 플레이어 추적을 유지하면
 * 캐릭터 크기는 그대로지만 검정 여백이 거의 안 보인다(참조 이미지와 다르다).
 *
 * Phaser 를 import 하지 않는 순수 함수라 노드 테스트에서 그대로 검증된다.
 */

import type { Place } from "./chapterStoryPlan";

/** 던전 계열 — 검은 배경에 떠 있는 방으로 그린다. */
export const FRAMED_ROLES: ReadonlySet<Place["role"]> = new Set([
  "dungeon",  // 동굴·폐허 내부
  "tunnel",   // 지하 통로
  "ruin",     // 유적
  "throne",   // 왕좌의 방
  "sanctuary",// 성소
  "rift",     // 균열
  "domain",   // 영역
]);

/** 이 role 이 방 프레이밍을 쓰는가. place 가 없으면(마을 등) false. */
export function usesFramedRoom(place: Place | undefined | null): boolean {
  return !!place && FRAMED_ROLES.has(place.role);
}

/** 프레이밍 여백(px) — 방 둘레에 두는 순수 검정 띠의 **최소** 두께.
 *  실제 여백은 화면 대비 비율(FRAME_FILL)로 정하고, 이 값은 하한으로만 쓴다. */
export const FRAME_PAD = 96;

/** 방이 화면에서 차지하는 비율 (0~1).
 *
 *  참조 이미지(Undertale/고전 RPG)를 재보면 방은 화면의 약 **68~78%** 를 차지하고
 *  나머지가 검정이다. 종전에는 pad 를 96px 고정으로 두어 던전처럼 큰 방이 화면의
 *  약 95% 를 채웠다 — "떠 있는 방"이 아니라 "검은 테두리가 있는 방"이 됐다.
 *  비율로 잡으면 화면 크기·방 크기가 달라도 같은 인상을 유지한다. */
export const FRAME_FILL = 0.74;

/** 확대 상한 — 아주 작은 방이라도 캐릭터가 화면을 다 채우지 않게 한다.
 *  2배를 넘으면 방이 아니라 캐릭터 초상화처럼 보인다. */
export const MAX_ZOOM = 2;

/**
 * 방(개방 셀)의 월드 사각형. 스테이지 전체가 아니라 **실제로 걸어다닐 수 있는 영역**이다.
 * 빈 셀까지 프레이밍하면 방이 있어야 할 자리에 검정만 남는다.
 */
export type RoomBounds = { x: number; y: number; w: number; h: number };

/** 개방 셀들의 바운딩 박스를 월드 좌표로 돌려준다. 열린 셀이 없으면 전체 스테이지. */
export function roomBoundsFromLayout(
  open: readonly boolean[] | Uint8Array,
  cols: number,
  cellW: number,
  cellH: number,
  fallbackW: number,
  fallbackH: number,
): RoomBounds {
  let minC = Infinity, maxC = -1, minR = Infinity, maxR = -1;
  for (let i = 0; i < open.length; i++) {
    if (!open[i]) continue;
    const c = i % cols;
    const r = Math.floor(i / cols);
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  if (maxC < 0) return { x: 0, y: 0, w: fallbackW, h: fallbackH };
  return {
    x: minC * cellW,
    y: minR * cellH,
    w: (maxC - minC + 1) * cellW,
    h: (maxR - minR + 1) * cellH,
  };
}

export type FramedView = {
  /** 카메라가 비출 월드 영역 */
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
  /** 줌 — 방 전체가 화면에 들어오도록 계산된 값 */
  zoom: number;
  /** 방(개방 영역)의 월드 사각형 — 여백이 검정으로 남는 부분 */
  room: { x: number; y: number; w: number; h: number };
};

/**
 * 방 전체가 화면에 들어오는 카메라를 계산한다. 순수 함수.
 *
 * @param roomW/roomH  방(레이아웃 전체) 크기
 * @param screenW/screenH 화면 크기
 * @param pad 여백
 *
 * 계산
 * ----
 *  · 줌 = min(화면/방) — 가로·세로 중 더 빡빡한 쪽에 맞춘다(잘림 방지).
 *  · 여백을 포함한 영역이 화면을 채우도록 scroll 을 잡는다 → **방 주변이 검정으로 남는다**.
 *  · 줌 상한을 두지 않는다: 작은 방은 크게 보이고, 큰 방은 작게 보인다(참조 이미지와 같은 동작).
 *  · 방이 화면보다 크면(줌<1) 여백을 넣으면 더 작아지므로 pad 를 0 으로 줄인다.
 */
export function computeFramedView(
  roomW: number,
  roomH: number,
  screenW: number,
  screenH: number,
  pad = FRAME_PAD,
  room?: RoomBounds,
): FramedView {
  const w = Math.max(1, roomW);
  const h = Math.max(1, roomH);
  const sw = Math.max(1, screenW);
  const sh = Math.max(1, screenH);

  /* 여백을 **비율**로 잡는다.
   *
   *  [왜 px 고정을 버렸나] pad=96px 고정이면 화면·방 크기에 따라 방 점유율이 크게 흔들린다.
   *  던전은 방이 2100×1024 같은 값이라 96px 여백으로는 점유율이 95% 까지 올라가
   *  "떠 있는 방"이 아니라 "검정 테두리"가 됐다(실측). 참조 이미지들의 점유율은 68~78% 다.
   *
   *  [계산] 방이 화면의 FRAME_FILL 만큼 그려지도록 줌을 잡는다:
   *    zoom = min(sw/w, sh/h) * FRAME_FILL
   *  남는 영역이 곧 여백이므로 pad 를 따로 더하지 않는다.
   *  `pad` 인자는 하한선으로만 쓴다 — 여백이 이보다 얇아지면 "떠 있는" 느낌이 사라진다. */
  const fitZoom = Math.min(sw / w, sh / h) * FRAME_FILL;
  /* 아주 작은 방은 확대 상한 — 캐릭터가 화면을 가득 채우면 방이 아니라 초상화가 된다. */
  const zoom = Math.min(fitZoom, MAX_ZOOM);
  /* 여백 하한 검사: 이 줌으로 방을 그렸을 때 남는 여백이 pad 보다 얇으면 줌을 낮춘다.
   *  (방이 화면에 꽉 차는 극단에서 pad 규약이 무너지지 않게.) */
  const padZoomCap = Math.min(sw / (w + pad * 2), sh / (h + pad * 2));
  const finalZoom = Math.min(zoom, padZoomCap);

  const viewW = sw / finalZoom;
  const viewH = sh / finalZoom;

  /* 카메라 중앙이 **방 중앙**을 가리키게 한다 — 여백이 좌우/상하 고르게 남는다.
   *  room 이 주어지면 그 사각형의 중심을 쓴다(스테이지 원점이 아니라 실제 방 위치).
   *  방은 월드 (0,0) 에서 시작하므로 room 이 없으면 (w/2, h/2) 다.
   *  (viewW/2 를 쓰면 pad 만큼 어긋난다 — 테스트가 96px 오차로 잡아냈다.) */
  const centerX = room ? room.x + room.w / 2 : w / 2;
  const centerY = room ? room.y + room.h / 2 : h / 2;
  /* ⚠️ Phaser 4 의 scroll 은 **뷰 좌상단이 아니라 카메라 원점(화면 중앙)의 월드 좌표**다
   *  (Camera.preRender: midPoint = scroll + width/2, worldView = midPoint - width/2/zoom).
   *  종전에는 scroll 을 뷰 좌상단으로 계산해 넘겼고, 그 오차만큼 방이 오른쪽·아래로 밀려
   *  **왼쪽이 잘렸다**(실측 howlrstone11x1: 좌 여백 0px / 우 76px, 줌 0.5521).
   *  원점 보정을 빼면 scroll = 방중앙 - 화면/2 가 되어 줌과 무관해진다.
   *  (WorldScene.applyManualCameraFollow 의 비-프레이밍 경로도 같은 보정을 쓴다.) */
  return {
    scrollX: centerX - sw / 2,
    scrollY: centerY - sh / 2,
    viewW,
    viewH,
    zoom: finalZoom,
    room: room ?? { x: 0, y: 0, w, h },
  };
}
