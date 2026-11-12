/**
 * vc278 — 검은 배경에 떠 있는 방(framed room) 회귀 방지.
 *
 * [사용자 지시] "맵을 던전형식 만으로 말고 이렇게 검은 배경에 작은 맵이 있는 느낌도 ㄱㄱ"
 * 참조 스크린샷(Undertale/고전 RPG): 순수 검정 배경 위에 방 하나가 떠 있고 방 밖은 비어 있다.
 *
 * [사용자 확정 범위]
 *  · 던전 계열 role 만 — 숲·평원 등 야외는 기존 연출 유지
 *  · 방 전체가 한 화면에 들어오게 — 플레이어 추적 대신 방에 카메라를 맞춘다
 *
 * 고정하는 것:
 *  ① role 판정: 던전 계열만 true, 야외는 false
 *  ② 줌 계산: 방 전체가 화면에 들어온다(잘리지 않는다)
 *  ③ 여백: 방 주변이 화면에 남는다 = 검정이 보인다
 *  ④ 방 경계: 스테이지 전체가 아니라 **개방 셀 바운딩 박스**를 방으로 삼는다
 *  ⑤ 결정론: 같은 입력 → 같은 출력
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  usesFramedRoom,
  computeFramedView,
  FRAMED_ROLES,
  FRAME_PAD,
  FRAME_FILL,
  MAX_ZOOM,
} from "../src/game/framedRoom.ts";
import { chapterPlace } from "../src/game/chapterStoryPlan.ts";

test("vc278 — 던전 계열 role 만 framed room 을 쓴다", () => {
  /* chapterStoryPlan 의 실제 role 을 써서 판정한다(새 표를 만들지 않았다). */
  const dungeonLike = ["dungeon", "tunnel", "ruin", "throne", "sanctuary", "rift", "domain"];
  for (const role of dungeonLike) {
    assert.ok(FRAMED_ROLES.has(role), `${role} 은 던전 계열이어야 한다`);
  }
  /* 야외·마을 계열은 이 스타일을 쓰지 않는다 — 사용자가 "던전 계열만" 을 골랐다. */
  const outdoor = ["cliff", "village", "garden", "road", "camp", "harbor", "deck", "shore", "city", "factory"];
  for (const role of outdoor) {
    assert.ok(!FRAMED_ROLES.has(role), `${role} 은 야외 계열이라 framed room 을 쓰면 안 된다`);
  }
});

test("vc278 — place 가 없으면 framed room 이 아니다", () => {
  assert.equal(usesFramedRoom(undefined), false);
  assert.equal(usesFramedRoom(null), false);
});

test("vc278 — 실제 챕터 표에서 던전/야외가 올바로 갈린다", () => {
  /* 정본 표(chapterStoryPlan)를 통해 role 이 나오는 경로까지 확인한다. */
  const dungeon = chapterPlace("howlrstone1", 1);
  assert.ok(dungeon, "howlrstone1 의 1구역 place 가 있어야 한다");
  /* 이 스테이지의 role 이 무엇이든, usesFramedRoom 과 FRAMED_ROLES 판정이 일치해야 한다. */
  assert.equal(usesFramedRoom(dungeon), FRAMED_ROLES.has(dungeon.role));
});

test("vc278 — 방 전체가 화면에 들어온다 (잘리지 않는다)", () => {
  const cases = [
    { roomW: 1200, roomH: 800, sw: 1280, sh: 800 },
    { roomW: 2100, roomH: 1150, sw: 1280, sh: 800 },
    { roomW: 640, roomH: 480, sw: 1280, sh: 800 },
    { roomW: 400, roomH: 300, sw: 390, sh: 844 }, // 세로 화면(모바일)
  ];
  for (const c of cases) {
    const v = computeFramedView(c.roomW, c.roomH, c.sw, c.sh);
    /* 줌을 적용했을 때 방이 화면 안에 들어와야 한다(양수 줌, 여유 있음). */
    assert.ok(v.zoom > 0, `zoom 이 0 이하: ${v.zoom}`);
    const drawnW = c.roomW * v.zoom;
    const drawnH = c.roomH * v.zoom;
    assert.ok(drawnW <= c.sw + 0.5, `방 폭이 화면을 넘는다: ${drawnW} > ${c.sw}`);
    assert.ok(drawnH <= c.sh + 0.5, `방 높이가 화면을 넘는다: ${drawnH} > ${c.sh}`);
  }
});

test("vc278 — 방 주변에 검정 여백이 남는다 (화면을 꽉 채우지 않는다)", () => {
  /* 방이 화면보다 작은 경우: 여백이 있어야 "떠 있는" 느낌이 난다. */
  const v = computeFramedView(640, 480, 1280, 800);
  const drawnW = 640 * v.zoom;
  const drawnH = 480 * v.zoom;
  assert.ok(drawnW < 1280, `방이 화면 폭을 꽉 채웠다: ${drawnW}`);
  assert.ok(drawnH < 800, `방이 화면 높이를 꽉 채웠다: ${drawnH} — 검정이 안 보인다`);
  /* 여백이 pad 만큼 확보되어야 한다(양쪽 합). */
  assert.ok(1280 - drawnW >= FRAME_PAD, `좌우 여백 부족: ${1280 - drawnW}`);
});

test("vc278 — 큰 방에서도 여백을 둔다 (떠 있는 느낌의 핵심)", () => {
  /* 종전에는 "방이 화면보다 크면 pad 생략"이었는데, 던전은 개방률 45~80% 라
   * 방이 스테이지 대부분을 차지해 결국 화면을 꽉 채웠다(실측 zoom 0.81, 좌우 검정 0).
   * 참조 이미지의 "떠 있는" 느낌은 여백이 있어야만 난다 → 항상 여백을 둔다. */
  const room = { x: 0, y: 0, w: 2430, h: 1280 };
  const v = computeFramedView(room.w, room.h, 1280, 800, FRAME_PAD, room);
  assert.ok(room.w * v.zoom < 1280, `좌우 검정이 안 보인다: ${room.w * v.zoom}`);
  assert.ok(room.h * v.zoom < 800, `상하 검정이 안 보인다: ${room.h * v.zoom}`);
  /* 방이 화면에 들어와야 한다(잘림 없음). */
  assert.ok(room.w * v.zoom <= 1280 + 0.5 && room.h * v.zoom <= 800 + 0.5);
});

test("vc278c — 방 점유율이 FRAME_FILL 에 맞는다 (참조 이미지 비율)", () => {
  /* [왜 비율인가] pad=96px 고정이면 방·화면 크기에 따라 점유율이 흔들려
   * 큰 던전에서 95% 까지 올라갔다 = "검정 테두리"지 "떠 있는 방"이 아니다.
   * 참조 이미지들의 점유율은 68~78% 다. */
  const cases = [
    { w: 2126, h: 1024, sw: 1280, sh: 800 }, // 실제 howlrstone11x1 실측값
    { w: 800, h: 600, sw: 1280, sh: 800 },
    { w: 3000, h: 2000, sw: 1280, sh: 800 },
    { w: 640, h: 480, sw: 390, sh: 844 },    // 세로 화면(모바일)
  ];
  for (const c of cases) {
    const v = computeFramedView(c.w, c.h, c.sw, c.sh);
    const fillX = (c.w * v.zoom) / c.sw;
    const fillY = (c.h * v.zoom) / c.sh;
    const worst = Math.max(fillX, fillY);
    /* 더 빡빡한 축이 FRAME_FILL 에 근접한다(다른 축은 그보다 작을 수 있다). */
    assert.ok(worst <= FRAME_FILL + 0.02, `${c.w}x${c.h}: 점유율 ${(worst * 100).toFixed(0)}% > FRAME_FILL`);
    /* 너무 작아지면 캐릭터가 안 보인다 — 하한도 고정한다. */
    assert.ok(worst >= 0.4, `${c.w}x${c.h}: 점유율 ${(worst * 100).toFixed(0)}% — 너무 작다`);
  }
});

test("vc278c — FRAME_FILL 은 참조 이미지 범위(0.6~0.85) 안이다", () => {
  assert.ok(FRAME_FILL >= 0.6 && FRAME_FILL <= 0.85, `FRAME_FILL=${FRAME_FILL} 이 참조 범위 밖`);
});

test("vc278c — 아주 작은 방은 확대 상한(MAX_ZOOM)에 걸린다", () => {
  const v = computeFramedView(100, 80, 1280, 800);
  assert.ok(v.zoom <= MAX_ZOOM + 1e-9, `확대 상한 초과: ${v.zoom}`);
});

test("vc278 — 카메라가 방 중앙을 비춘다 (여백이 한쪽에 몰리지 않는다)", () => {
  const sw = 1280, sh = 800;
  const v = computeFramedView(640, 480, sw, sh);
  /* Phaser 4 의 scroll 은 뷰 좌상단이 아니라 **화면 중앙(원점)의 월드 좌표**다
   * (Camera.preRender: midPoint = scroll + width/2). 따라서 뷰 중심 = scroll + 화면/2.
   * 종전 테스트는 `scroll + 화면/2/zoom` 으로 검사해 **잘못된 모델을 고정**했고,
   * 그 오차 때문에 실제 화면에서 방이 오른쪽으로 밀려 왼쪽이 잘렸다. */
  const camCenterX = v.scrollX + sw / 2;
  const camCenterY = v.scrollY + sh / 2;
  const roomCenterX = v.room.x + v.room.w / 2;
  const roomCenterY = v.room.y + v.room.h / 2;
  assert.ok(Math.abs(camCenterX - roomCenterX) < 0.001, `x 중심 어긋남: ${camCenterX} vs ${roomCenterX}`);
  assert.ok(Math.abs(camCenterY - roomCenterY) < 0.001, `y 중심 어긋남: ${camCenterY} vs ${roomCenterY}`);
});

test("vc278 — 순수 함수다 (같은 입력 → 같은 출력)", () => {
  const a = computeFramedView(1000, 700, 1280, 800);
  const b = computeFramedView(1000, 700, 1280, 800);
  assert.deepEqual(a, b);
});

test("vc278 — 0/음수 크기에도 터지지 않는다", () => {
  const v = computeFramedView(0, 0, 0, 0);
  assert.ok(Number.isFinite(v.zoom) && v.zoom > 0, `zoom 이 유효하지 않다: ${v.zoom}`);
  assert.ok(Number.isFinite(v.scrollX) && Number.isFinite(v.scrollY));
});

/* ═══ vc278b — 실제 방(개방 셀) 경계로 프레이밍 ═══
 *
 * [실측으로 잡은 결함] 스테이지 전체 크기로 프레이밍하면 벽·빈 셀까지 포함돼
 *  방이 화면을 넘치고 검정 여백이 거의 안 보였다(2430×1280 스테이지 → zoom 0.71,
 *  화면에 방이 꽉 참). 개방 셀의 바운딩 박스를 방으로 삼아야 참조 이미지처럼 된다. */
test("vc278 — 개방 셀의 바운딩 박스를 방으로 계산한다", async () => {
  const { roomBoundsFromLayout } = await import("../src/game/framedRoom.ts");
  /* 4×3 격자, 열린 셀은 (1,1) 하나뿐 → 방은 그 셀 하나 크기 */
  const cols = 4, rows = 3, cellW = 100, cellH = 80;
  const open = new Array(cols * rows).fill(false);
  open[1 * cols + 1] = true;
  const r = roomBoundsFromLayout(open, cols, cellW, cellH, 400, 240);
  assert.deepEqual(r, { x: 100, y: 80, w: 100, h: 80 });
});

test("vc278 — 열린 셀이 없으면 전체 스테이지로 폴백한다", async () => {
  const { roomBoundsFromLayout } = await import("../src/game/framedRoom.ts");
  const open = new Array(12).fill(false);
  const r = roomBoundsFromLayout(open, 4, 100, 80, 400, 240);
  assert.deepEqual(r, { x: 0, y: 0, w: 400, h: 240 });
});

test("vc278 — 방 사각형이 주어지면 그 중심을 비춘다", async () => {
  const room = { x: 500, y: 300, w: 800, h: 600 };
  const sw = 1280, sh = 800;
  const v = computeFramedView(room.w, room.h, sw, sh, FRAME_PAD, room);
  /* scroll = 원점(화면 중앙)의 월드 좌표 — 줌을 곱하지 않는다. */
  const camCenterX = v.scrollX + sw / 2;
  const camCenterY = v.scrollY + sh / 2;
  assert.ok(Math.abs(camCenterX - (room.x + room.w / 2)) < 0.001, `x 중심 어긋남: ${camCenterX}`);
  assert.ok(Math.abs(camCenterY - (room.y + room.h / 2)) < 0.001, `y 중심 어긋남: ${camCenterY}`);
});

/* ═══ vc278d — scroll 은 뷰 좌상단이 아니다 (좌측 클리핑 회귀 방지) ═══
 *
 * [실측 결함] howlrstone11x1 에서 방이 왼쪽으로 잘리고 좌 여백이 0px 이었다(우 76px).
 *  원인: scroll 을 `방중앙 - 화면/2/줌` 으로 계산했다. Phaser 4 의 scroll 은
 *  뷰 좌상단이 아니라 **화면 중앙(원점)의 월드 좌표**라, 그 차이만큼 화면 내용이
 *  오른쪽 아래로 밀린다. 두 축 모두 검사해 같은 실수가 재발하지 않게 한다. */
test("vc278 — scroll 은 화면 중앙의 월드 좌표다 (줌을 곱하지 않는다)", () => {
  const room = { x: 151.875, y: 128, w: 2126.25, h: 1024 }; // 실측 howlrstone11x1
  const sw = 1280, sh = 800;
  const v = computeFramedView(room.w, room.h, sw, sh, FRAME_PAD, room);
  assert.ok(v.zoom < 1, `이 사례는 줌<1 이어야 보정 차이가 드러난다: ${v.zoom}`);
  /* 줌 보정이 남아 있으면 scroll 이 (1-1/zoom) 만큼 어긋난다 — 그 값이 곧 클리핑 폭이다. */
  const wrongX = (room.x + room.w / 2) - sw / 2 / v.zoom;
  const wrongY = (room.y + room.h / 2) - sh / 2 / v.zoom;
  assert.ok(Math.abs(wrongX - v.scrollX) > 100, "보정 전후 scroll 차이가 없으면 검사가 무의미하다");
  assert.ok(Math.abs(v.scrollX - ((room.x + room.w / 2) - sw / 2)) < 0.001, `scrollX 오차: ${v.scrollX}`);
  assert.ok(Math.abs(v.scrollY - ((room.y + room.h / 2) - sh / 2)) < 0.001, `scrollY 오차: ${v.scrollY}`);
  assert.ok(Math.abs(wrongY - v.scrollY) > 100, "y 축도 같은 보정이 적용되어야 한다");
});

test("vc278 — 실제 방 크기로 프레이밍하면 검정 여백이 확보된다", () => {
  /* 실측 사례: 스테이지 2430×1280 이지만 실제 방은 그보다 작다.
   * 방 1200×800 을 화면 1280×800 에 넣으면 여백이 남아야 한다. */
  const room = { x: 0, y: 0, w: 1200, h: 800 };
  const v = computeFramedView(room.w, room.h, 1280, 800, FRAME_PAD, room);
  const drawnW = room.w * v.zoom;
  const drawnH = room.h * v.zoom;
  assert.ok(drawnW <= 1280 + 0.5 && drawnH <= 800 + 0.5, "방이 화면을 넘는다");
  assert.ok(drawnW < 1280, `좌우 검정이 안 보인다: ${drawnW}`);
});

/* ═══ vc278c — 야외 스테이지 무영향 확인 ═══
 *
 * 사용자가 "던전 계열만" 을 골랐다. 숲·평원이 이 스타일로 바뀌면 기존 연출
 * (지면이 끝없이 이어지는 느낌)이 죽고 AGENTS.md "기존 틀 유지" 규칙과 충돌한다.
 * chapterStoryPlan 의 **실제 표**를 순회해 던전/야외 판정이 섞이지 않는지 고정한다. */
test("vc278 — 실제 챕터 표에서 던전/야외 판정이 서로 배타적이다", async () => {
  const { CHAPTER_STORY_PLAN } = await import("../src/game/chapterStoryPlan.ts");
  const dungeonRoles = new Set(["dungeon", "tunnel", "ruin", "throne", "sanctuary", "rift", "domain"]);
  let framedCount = 0;
  let outdoorCount = 0;
  for (const [, plan] of Object.entries(CHAPTER_STORY_PLAN)) {
    for (const p of plan.places) {
      const expected = dungeonRoles.has(p.role);
      assert.equal(
        usesFramedRoom(p), expected,
        `${p.title} (role=${p.role}) 판정이 표와 다르다`,
      );
      if (expected) framedCount++; else outdoorCount++;
    }
  }
  assert.ok(framedCount > 0, "던전 계열이 하나도 없다 — 판정이 고장났다");
  assert.ok(outdoorCount > 0, "야외가 하나도 없다 — 판정이 전부 던전으로 잡혔다");
});

test("vc278 — 야외 role 은 프레이밍 계산을 타지 않는다 (place 가 없으면 false)", async () => {
  /* chapterPlace 가 undefined 인 스테이지(마을·재림 등)도 프레이밍하지 않는다. */
  const { chapterPlace } = await import("../src/game/chapterStoryPlan.ts");
  assert.equal(chapterPlace("village", 1), undefined);
  assert.equal(usesFramedRoom(chapterPlace("village", 1)), false);
});
