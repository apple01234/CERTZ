/**
 * 메이플스토리식 자동 진행 컷씬 — v4.9.0
 *
 * 기존 StoryCutscene.ts 의 "카메라 팬 → 대사"만으로는 부족하다:
 *   · 배우(캐릭터)가 등장해 제자리에 서고, 걷고, 사라지는 연출이 없다
 *   · 대사창이 뜨면 플레이어가 닫아야 다음으로 넘어간다(자동 진행 아님)
 *   · 상단/하단 레터박스·암전·플래시 같은 화면 전환이 없다
 *
 * 이 파일은 위 세 가지를 **데이터(스텝 배열)** 로 선언하고 순서대로 자동 실행한다.
 * 메이플 컷씬의 특징을 그대로 따른다:
 *   ① 레터박스(위·아래 검은 띠)로 "지금은 조작 시간이 아니다"를 즉시 알린다
 *   ② 카메라가 이동 → 배우 등장 → 대사(자동 타이핑) → 퇴장 → 다음 장면
 *   ③ 대사는 글자 수에 비례한 시간만큼 자동 유지하고 스스로 넘어간다
 *   ④ 플레이어가 탭/클릭/스페이스로 건너뛸 수 있다(스킵 가능)
 *
 * 안전 원칙 (기존 컷씬의 교훈을 그대로 승계)
 *   - 재생 중 입력은 차단하되, **스킵 키는 항상 살아 있어야** 한다
 *   - 어떤 경로로 끝나든 camCinema 해제 + 물리 재개 + 레터박스 제거 (finish 1회 보장)
 *   - 자가치유 워치독(스텝 총 시간 + 여유)으로 교착을 만들지 않는다
 */
import Phaser from "phaser";

type Actable = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export type CutActorSpec = {
  /** 스프라이트 텍스처 키 (예: "npc_fairy_aria", "lil_boss_scarlet1_idle0") */
  tex: string;
  /** 월드 좌표 또는 화면 비율(0~1). ratio=true 면 화면 기준 */
  x: number;
  y: number;
  ratio?: boolean;
  /** 시작 시 투명 → 페이드 인 */
  fadeIn?: boolean;
  /** 좌우 반전 */
  flip?: boolean;
  /** 표시 배율 (기본 1) */
  scale?: number;
  /** 애니메이션 키가 있으면 재생 (예: "aria-idle") */
  anim?: string;
  /** 화면 깊이 (기본 9000) */
  depth?: number;
};

export type CutStep =
  /** 카메라를 (rx, ry) 비율 지점으로 팬 + 줌 */
  | { t: "cam"; rx: number; ry: number; panMs?: number; zoom?: number }
  /** 배우 등장 */
  | { t: "enter"; id: string; actor: CutActorSpec }
  /** 배우 퇴장(페이드 아웃 후 제거) */
  | { t: "exit"; id: string; ms?: number }
  /** 배우 이동 */
  | { t: "move"; id: string; rx: number; ry: number; ms?: number }
  /** 대사 자동 표시 (글자 수 비례 유지, 탭으로 스킵) */
  | { t: "say"; speaker: string; lines: string[]; holdPerChar?: number; minHold?: number }
  /** 대기 */
  | { t: "wait"; ms: number }
  /** 화면 플래시 (색, 시간) */
  | { t: "flash"; color?: number; ms?: number }
  /** 암전/복귀 */
  | { t: "fade"; out: boolean; ms?: number }
  /** 카메라 흔들림 */
  | { t: "shake"; ms?: number; intensity?: number };

export type AutoCutsceneSpec = {
  id: string;
  /** true 면 세이브에 기록해 1회만 재생 */
  once?: boolean;
  steps: CutStep[];
  /** 화면 비율 좌표 기준 맵 크기 (씬이 주입) */
  stageW: number;
  stageH: number;
};

const playing = new WeakSet<Phaser.Scene>();

export function autoCutscenePlaying(scene: Phaser.Scene): boolean {
  return playing.has(scene);
}

type SceneLike = Phaser.Scene & {
  camCinema?: boolean;
  player?: { x: number; y: number; active: boolean };
  stageW?: number;
  stageH?: number;
};

/** 글자 수 기반 자동 유지시간 — 읽기 속도를 존중하되 길게 늘이지 않는다 */
function autoHold(lines: string[], perChar: number, minHold: number): number {
  const chars = lines.reduce((a, l) => a + l.length, 0);
  return Math.max(minHold, Math.min(5200, chars * perChar));
}

/**
 * 자동 컷씬 재생. 재생 중이면 false.
 * 반환값이 true 면 연출이 시작된 것이고, 끝나면 onDone 이 호출된다.
 */
export function playAutoCutscene(
  scene: SceneLike,
  spec: AutoCutsceneSpec,
  onDone?: () => void,
): boolean {
  if (playing.has(scene)) return false;
  if (!spec.steps.length) return false;

  const cam = scene.cameras.main;
  const savedZoom = cam.zoom;
  const actors = new Map<string, Actable>();
  const created: Phaser.GameObjects.GameObject[] = [];

  playing.add(scene);
  scene.camCinema = true;
  try { scene.physics.world.pause(); } catch { /* 무시 */ }

  /* ── 레터박스 ──────────────────────────────────────────────
   * 카메라 스크롤과 무관하게 화면에 고정되어야 하므로 scrollFactor 0. */
  const barH = Math.round(cam.height * 0.11);
  const mkBar = (y: number) => {
    const r = scene.add.rectangle(0, y, cam.width, barH, 0x000000, 1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(9500);
    r.setAlpha(0);
    scene.tweens.add({ targets: r, alpha: 1, duration: 220 });
    created.push(r);
    return r;
  };
  const topBar = mkBar(0);
  const botBar = mkBar(cam.height - barH);

  /* 대사창 — 컷씬 전용 오버레이 (게임 HUD 와 분리) */
  let sayBox: Phaser.GameObjects.Container | null = null;
  let sayText: Phaser.GameObjects.Text | null = null;
  let sayName: Phaser.GameObjects.Text | null = null;

  let done = false;
  const cleanup = () => {
    try {
      for (const a of actors.values()) a.destroy();
      actors.clear();
      for (const o of created) o.destroy();
      created.length = 0;
      sayBox?.destroy();
      sayBox = null;
    } catch { /* 무시 */ }
  };

  const finish = () => {
    if (done) return;
    done = true;

    /* 복귀 — 스냅 금지. 플레이어 시점으로 보간 후 플래그 해제 */
    const px = scene.player?.x ?? cam.midPoint.x;
    const py = scene.player?.y ?? cam.midPoint.y;
    try {
      cam.zoomTo(savedZoom, 240);
      cam.pan(px, py, 480, "Sine.easeInOut", true);
    } catch { /* 무시 */ }

    /* 레터박스 페이드 아웃 */
    try {
      scene.tweens.add({
        targets: [topBar, botBar],
        alpha: 0,
        duration: 200,
        onComplete: () => { try { topBar.destroy(); botBar.destroy(); } catch { /* 무시 */ } },
      });
    } catch { /* 무시 */ }

    scene.time.delayedCall(520, () => {
      try {
        cleanup();
        scene.camCinema = false;
        scene.physics.world.resume();
      } catch { /* 무시 */ }
      playing.delete(scene);
      try { onDone?.(); } catch { /* 무시 */ }
    });
  };

  /* 자가치유 — 스텝이 아무리 많아도 이 시간을 넘기지 않는다 */
  const budget = Math.max(14000, spec.steps.length * 3600);
  const watchdog = scene.time.delayedCall(budget, () => {
    if (!done) {
      console.warn(`[SERTZ] 자동 컷씬 자가치유 — ${spec.id} 예산 초과`);
      finish();
    }
  });

  /* ── 좌표 환산 ───────────────────────────────────────────── */
  const toWorldX = (rx: number) => rx * spec.stageW;
  const toWorldY = (ry: number) => ry * spec.stageH;

  const makeActor = (id: string, a: CutActorSpec) => {
    const x = a.ratio ? a.x * cam.width : (a.ratio === false ? a.x : toWorldX(a.x));
    const y = a.ratio ? a.y * cam.height : (a.ratio === false ? a.y : toWorldY(a.y));
    let obj: Actable;
    if (scene.textures.exists(a.tex)) {
      obj = scene.add.sprite(x, y, a.tex).setDepth(a.depth ?? 9000);
      if (a.anim && scene.anims.exists(a.anim)) (obj as Phaser.GameObjects.Sprite).play(a.anim);
    } else {
      /* 텍스처가 없어도 연출이 멈추지 않도록 사각형으로 대체 */
      obj = scene.add.rectangle(x, y, 48, 72, 0x8899aa).setDepth(a.depth ?? 9000) as unknown as Actable;
    }
    if (a.ratio) obj.setScrollFactor(0);
    if (a.scale) obj.setScale(a.scale);
    if (a.flip) obj.setFlipX(true);
    if (a.fadeIn) {
      obj.setAlpha(0);
      scene.tweens.add({ targets: obj, alpha: 1, duration: 260 });
    }
    actors.set(id, obj);
    created.push(obj);
    return obj;
  };

  const showSay = (speaker: string, lines: string[]) => {
    const w = Math.round(cam.width * 0.86);
    const h = Math.round(cam.height * 0.2);
    const x = Math.round((cam.width - w) / 2);
    const y = Math.round(cam.height - barH - h - 6);

    if (!sayBox) {
      const g = scene.add.graphics();
      g.fillStyle(0x0a0a12, 0.92).fillRoundedRect(0, 0, w, h, 10);
      g.lineStyle(2, 0xd9c27a, 0.9).strokeRoundedRect(0, 0, w, h, 10);
      const name = scene.add.text(16, 10, "", {
        fontFamily: "sans-serif", fontSize: "15px", color: "#f0d98a", fontStyle: "bold",
      });
      const body = scene.add.text(16, 34, "", {
        fontFamily: "sans-serif", fontSize: "14px", color: "#e8e8f0",
        wordWrap: { width: w - 32 }, lineSpacing: 5,
      });
      sayBox = scene.add.container(x, y, [g, name, body])
        .setScrollFactor(0).setDepth(9600);
      sayName = name;
      sayText = body;
      created.push(sayBox);
    }
    if (sayName) sayName.setText(speaker);
    if (sayText) sayText.setText(lines.join("\n"));
  };

  const hideSay = () => {
    if (sayBox) sayBox.setVisible(false);
  };

  /* ── 스텝 실행기 ─────────────────────────────────────────── */
  let idx = 0;
  let skipRequested = false;

  const skipHandler = () => { skipRequested = true; };
  scene.input.keyboard?.on("keydown-SPACE", skipHandler);
  scene.input.on("pointerdown", skipHandler);

  const next = () => {
    if (done) return;
    if (skipRequested) {
      /* 스킵 — 남은 스텝을 즉시 종료 */
      skipRequested = false;
      skipHandlerCleanup();
      watchdog.remove(false);
      finish();
      return;
    }
    if (idx >= spec.steps.length) {
      hideSay();
      watchdog.remove(false);
      skipHandlerCleanup();
      finish();
      return;
    }
    const st = spec.steps[idx++];

    switch (st.t) {
      case "cam": {
        const panMs = Math.max(140, st.panMs ?? 700);
        if (st.zoom !== undefined) { try { cam.zoomTo(st.zoom, panMs); } catch { /* 무시 */ } }
        let tx = toWorldX(st.rx);
        let ty = toWorldY(st.ry);
        /* 맵 경계 클램프 — 검은 여백 노출 방지 */
        if (spec.stageW > 0 && spec.stageH > 0) {
          const z = cam.zoom || 1;
          const hw = cam.width / z / 2;
          const hh = cam.height / z / 2;
          tx = spec.stageW <= hw * 2 ? spec.stageW / 2 : Math.min(Math.max(tx, hw), spec.stageW - hw);
          ty = spec.stageH <= hh * 2 ? spec.stageH / 2 : Math.min(Math.max(ty, hh), spec.stageH - hh);
        }
        try { cam.pan(tx, ty, panMs, "Sine.easeInOut", true); } catch { /* 무시 */ }
        scene.time.delayedCall(panMs, next);
        break;
      }
      case "enter": {
        makeActor(st.id, st.actor);
        scene.time.delayedCall(300, next);
        break;
      }
      case "exit": {
        const obj = actors.get(st.id);
        if (obj) {
          const ms = Math.max(80, st.ms ?? 260);
          scene.tweens.add({
            targets: obj, alpha: 0, duration: ms,
            onComplete: () => { try { obj.destroy(); } catch { /* 무시 */ } actors.delete(st.id); },
          });
          scene.time.delayedCall(ms + 20, next);
        } else {
          next();
        }
        break;
      }
      case "move": {
        const obj = actors.get(st.id);
        if (obj) {
          const ms = Math.max(120, st.ms ?? 600);
          scene.tweens.add({
            targets: obj,
            x: toWorldX(st.rx), y: toWorldY(st.ry),
            duration: ms, ease: "Sine.easeInOut",
          });
          scene.time.delayedCall(ms + 20, next);
        } else {
          next();
        }
        break;
      }
      case "say": {
        showSay(st.speaker, st.lines);
        const hold = autoHold(st.lines, st.holdPerChar ?? 42, st.minHold ?? 1100);
        scene.time.delayedCall(hold, () => { hideSay(); next(); });
        break;
      }
      case "wait": {
        scene.time.delayedCall(Math.max(0, st.ms), next);
        break;
      }
      case "flash": {
        try {
          const c = st.color ?? 0xffffff;
          cam.flash(Math.max(60, st.ms ?? 220), (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
        } catch { /* 무시 */ }
        scene.time.delayedCall(Math.max(80, st.ms ?? 220), next);
        break;
      }
      case "fade": {
        const ms = Math.max(80, st.ms ?? 320);
        try {
          if (st.out) cam.fadeOut(ms, 0, 0, 0);
          else cam.fadeIn(ms, 0, 0, 0);
        } catch { /* 무시 */ }
        scene.time.delayedCall(ms + 20, next);
        break;
      }
      case "shake": {
        try { cam.shake(Math.max(80, st.ms ?? 220), st.intensity ?? 0.006); } catch { /* 무시 */ }
        scene.time.delayedCall(Math.max(80, st.ms ?? 220), next);
        break;
      }
      default:
        next();
    }
  };

  const skipHandlerCleanup = () => {
    try { scene.input.keyboard?.off("keydown-SPACE", skipHandler); } catch { /* 무시 */ }
    try { scene.input.off("pointerdown", skipHandler); } catch { /* 무시 */ }
  };

  next();
  return true;
}
