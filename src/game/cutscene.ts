/**
 * cutscene.ts — 이벤트 컷씬 시스템 (vc189, 사용자 지시 "이벤트 컷씬이 1개도 없음")
 *
 * 문제(실측)
 *   `cutscene` 문자열이 src/game 전체에서 **0건**이었다.
 *   보스 등장 연출(룬 마법진·포효)은 있지만, 그것은 전투 연출이지 사건 연출이 아니다.
 *   지역 진입·전직·보스 조우 같은 "이야기가 바뀌는 순간"에 화면 연출이 전혀 없었다.
 *
 * 설계 원칙
 *   ① **논리 시간(게임 시간)** 으로만 스케줄한다 — 실시간 setTimeout 은 저FPS에서 어긋난다.
 *      (vc154 에서 확립한 컨벤션: 오버레이 타이밍은 scene.time.delayedCall / scene.tweens)
 *   ② **스킵 가능**해야 한다. 유저가 두 번째 플레이에서 같은 연출을 강제로 보면 안 된다.
 *   ③ **세이브 플래그**로 1회성 연출을 구분한다(`seenCutscenes`).
 *   ④ 연출 중에는 플레이어 입력을 봉인하고, 끝나면 **반드시** 원상복구한다(좌표·줌·알파).
 *   ⑤ 어떤 이유로 중단돼도 카메라·플레이어가 깨지지 않도록 `finally` 상당의 정리 경로를 둔다.
 *
 * 연출 종류
 *   chapter : 지역(챕터) 첫 진입 — 카메라가 마을을 훑고 타이틀 카드가 뜬다
 *   boss    : 보스방 첫 진입 — 암전 → 보스 클로즈업 → 흔들림 → 복귀
 *   job     : 전직 직후 — 화면 플래시 + 클래스명 카드 + 십자 광선
 */

import Phaser from "phaser";

export type CutsceneKind = "chapter" | "boss" | "job";

export type CutsceneRequest = {
  kind: CutsceneKind;
  /** 1회성 판정 키 (예: "chapter:forest", "boss:forest10", "job:blademaster") */
  id: string;
  /** 카드에 표시할 제목 */
  title?: string;
  /** 카드 부제 */
  subtitle?: string;
  /** 보스 컷씬이면 대상 좌표 */
  focus?: { x: number; y: number };
};

/** 컷씬이 요구하는 최소 씬 표면 — WorldScene 에 강하게 결합하지 않는다 */
type SceneLike = Phaser.Scene & {
  player?: { x: number; y: number; setVelocity?: (x: number, y: number) => void };
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  time: Phaser.Time.Clock;
  tweens: Phaser.Tweens.TweenManager;
  scale: Phaser.Scale.ScaleManager;
  add: Phaser.GameObjects.GameObjectFactory;
  cutsceneBusy?: boolean;
};

const CARD_DEPTH = 9200;
const BARS_DEPTH = 9150;

/**
 * 컷씬 1회 실행.
 * @returns 실제로 재생했으면 true (스킵/중복/이미봄이면 false)
 */
export function playCutscene(sc: SceneLike, req: CutsceneRequest, seen: Set<string>, opts: { skip?: boolean } = {}): boolean {
  if (!sc || sc.cutsceneBusy) return false;
  if (seen.has(req.id)) return false;
  if (opts.skip) { seen.add(req.id); return false; }

  sc.cutsceneBusy = true;
  seen.add(req.id);

  const cam = sc.cameras.main;
  const W = sc.scale.width;
  const H = sc.scale.height;
  const created: Phaser.GameObjects.GameObject[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];

  /* 원상복구 대상 — 실패해도 여기 값으로 되돌린다 */
  const restore = {
    scrollX: cam.scrollX,
    scrollY: cam.scrollY,
    zoom: cam.zoom,
    playerVel: { x: 0, y: 0 },
  };

  const T = (ms: number, fn: () => void) => {
    timers.push(sc.time.delayedCall(ms, fn));
  };

  /* 상하 레터박스 — "연출 구간"임을 즉시 알린다 */
  const barH = Math.round(H * 0.11);
  const barTop = sc.add.rectangle(W / 2, barH / 2, W, barH, 0x000000).setScrollFactor(0).setDepth(BARS_DEPTH).setAlpha(0);
  const barBot = sc.add.rectangle(W / 2, H - barH / 2, W, barH, 0x000000).setScrollFactor(0).setDepth(BARS_DEPTH).setAlpha(0);
  created.push(barTop, barBot);

  const card = (title: string, sub: string, color: string) => {
    const t = sc.add
      .text(W / 2, H * 0.42, title, {
        fontFamily: "Galmuri11, sans-serif",
        fontSize: `${Math.round(W * 0.045)}px`,
        color,
        stroke: "#000000",
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(CARD_DEPTH)
      .setAlpha(0);
    const s = sub
      ? sc.add
          .text(W / 2, H * 0.42 + Math.round(W * 0.038), sub, {
            fontFamily: "Galmuri11, sans-serif",
            fontSize: `${Math.round(W * 0.022)}px`,
            color: "#cfd8ea",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(CARD_DEPTH)
          .setAlpha(0)
      : null;
    created.push(t);
    if (s) created.push(s);
    sc.tweens.add({ targets: [t, ...(s ? [s] : [])], alpha: 1, duration: 380, ease: "Cubic.out" });
    return { t, s };
  };

  let finished = false;
  const finish = (skipped = false) => {
    if (finished) return;
    finished = true;
    timers.forEach((tm) => tm.remove(false));
    sc.cutsceneBusy = false;
    /* 카메라·플레이어 복구 — 연출이 중간에 끊겨도 여기로 수렴한다 */
    try {
      cam.stopFollow();
      cam.setZoom(restore.zoom);
      cam.pan(restore.scrollX + W / 2, restore.scrollY + H / 2, skipped ? 120 : 320, "Sine.easeInOut");
      if (sc.player?.setVelocity) sc.player.setVelocity(restore.playerVel.x, restore.playerVel.y);
    } catch { /* 씬이 죽은 경우 무시 */ }
    for (const o of created) {
      try {
        const anyO = o as unknown as { destroy?: () => void };
        anyO.destroy?.();
      } catch { /* 무시 */ }
    }
  };
  /* 비상 백스톱 — 어떤 경우에도 6초 뒤엔 정리 (씬이 살아있을 때만) */
  timers.push(sc.time.delayedCall(6000, () => finish(true)));

  /* 스킵 — 아무 입력이나 받으면 즉시 종료 */
  const skip = () => finish(true);
  sc.input?.once?.("pointerdown", skip);
  sc.input?.keyboard?.once?.("keydown", skip);

  /* 레터박스 인 */
  sc.tweens.add({ targets: [barTop, barBot], alpha: 0.72, duration: 260, ease: "Cubic.out" });

  if (req.kind === "chapter") {
    /* 카메라가 마을을 좌우로 훑은 뒤 플레이어로 복귀 */
    const sweep = 140;
    cam.pan(restore.scrollX + sweep, restore.scrollY + H / 2, 900, "Sine.easeInOut");
    T(320, () => card(req.title ?? "새로운 지역", req.subtitle ?? "", "#ffe9a8"));
    T(1400, () => cam.pan(restore.scrollX - sweep, restore.scrollY + H / 2, 900, "Sine.easeInOut"));
    T(2600, () => finish());
  } else if (req.kind === "boss") {
    /* 암전 → 보스 클로즈업(줌인) → 흔들림 → 복귀 */
    const fx = req.focus?.x ?? restore.scrollX + W / 2;
    const fy = req.focus?.y ?? restore.scrollY + H / 2;
    const flash = sc.add.rectangle(W / 2, H / 2, W, H, 0x000000).setScrollFactor(0).setDepth(CARD_DEPTH - 1).setAlpha(0);
    created.push(flash);
    sc.tweens.add({ targets: flash, alpha: 0.85, duration: 220, yoyo: true, hold: 240, ease: "Sine.inOut" });
    T(260, () => {
      cam.pan(fx, fy, 620, "Cubic.easeOut");
      cam.zoomTo(Math.min(1.9, restore.zoom * 1.45), 620, "Cubic.easeOut");
    });
    T(1000, () => {
      card(req.title ?? "강적 출현", req.subtitle ?? "", "#ff9a7a");
      cam.shake(360, 0.012);
    });
    T(2400, () => finish());
  } else {
    /* 전직 — 화면 플래시 + 클래스명 + 십자 광선 */
    const cx = sc.player?.x ?? restore.scrollX + W / 2;
    const cy = sc.player?.y ?? restore.scrollY + H / 2;
    const beamH = sc.add.rectangle(W / 2, H / 2, W, 3, 0xffffff).setScrollFactor(0).setDepth(CARD_DEPTH - 1).setAlpha(0);
    const beamV = sc.add.rectangle(W / 2, H / 2, 3, H, 0xffffff).setScrollFactor(0).setDepth(CARD_DEPTH - 1).setAlpha(0);
    created.push(beamH, beamV);
    sc.tweens.add({ targets: [beamH, beamV], alpha: 0.95, duration: 200, yoyo: true, hold: 180 });
    cam.flash(220, 255, 255, 255);
    cam.pan(cx, cy, 260, "Sine.easeOut");
    cam.zoomTo(Math.min(1.6, restore.zoom * 1.2), 300, "Sine.easeOut");
    T(280, () => card(req.title ?? "전직", req.subtitle ?? "", "#ffe66a"));
    T(1900, () => finish());
  }

  return true;
}

/** 세이브에서 본 컷씬 목록 복원 */
export function loadSeenCutscenes(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((v): v is string => typeof v === "string").slice(0, 500));
}

/** 세이브에 기록할 형태로 변환 (최근 200개만 — 세이브 비대화 방지) */
export function serializeSeenCutscenes(seen: Set<string>): string[] {
  return Array.from(seen).slice(-200);
}
