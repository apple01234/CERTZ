/**
 * 궁극기 시네마틱 연출 — v1.4.41 (#13 "가장 공들이기")
 *
 * 앞선 작업(#3)에서 시전 시간은 5~30초 / 10~60초로 늘렸다. 이 파일은 그 시간을
 * **비어 있지 않게** 채우는 것이 목적이다. 종전 궁극기는 암전 → 이펙트 5장 → 연타
 * → 끝 이 전부였고, 쿨타임 60초를 기다린 값으로는 얇았다.
 *
 * 설계 근거 (game-feel)
 * - "만족스러운 한 방은 ~100ms 안에 5~8개의 작은 반응이 함께 터진다".
 *   단발 이펙트를 키우는 대신 **채널을 겹친다**.
 * - 셰이크는 **trauma^2 감쇠 모델**로. 매 프레임 raw random 은 정전기처럼 떨린다.
 * - hit-stop 복원은 **실시간 지연**으로(시간이 멈춘 동안 스케일 타이머는 안 돈다).
 * - 연출은 전부 view state — 언제든 파괴 가능하고 판정에 관여하지 않는다.
 *
 * 구성 (시전 시간 축에 분배)
 *   ① 임팩트 프리즈   — 3단 히트스톱(진입 45ms → 중반 70ms → 종결 110ms)
 *   ② trauma 셰이크   — 감쇠 모델, 중요도에 비례(진입 0.35 → 종결 1.0)
 *   ③ 방사 충격파     — 지면을 타고 퍼지는 링 4단(시간차)
 *   ④ 상승 광주       — 발밑에서 솟는 빛기둥(계열색)
 *   ⑤ 파편 낙하       — 하늘에서 떨어지는 계열색 파편
 *   ⑥ 색수차/플래시   — 각성 순간 백색 → 계열색으로 감쇠
 *   ⑦ 크로스 페이드   — 암전에서 서서히 복귀(즉시 복귀는 싸구려로 읽힌다)
 *   ⑧ 명멸 링         — 캐릭터 둘레를 도는 궤도 링
 *
 * 저사양·Canvas: ADD 블렌드가 없으면 알파만으로 그리고, 파편 수를 줄인다.
 */
import Phaser from "phaser";

type S3 = Phaser.Scene;

/** WorldScene 에만 있는 히트스톱 훅. 다른 씬에서도 안전하게 no-op 되도록 느슨히 받는다. */
type HitStopCapable = { hitStop?: (ms?: number) => void };
const stop = (scene: S3, ms: number) => {
  try { (scene as unknown as HitStopCapable).hitStop?.(ms); } catch { /* 무시 */ }
};

/** trauma 기반 셰이크 — 씬에 하나만 두고 여러 연출이 누적한다.
 *
 *  camera-systems 원칙: "Shake driving the follow target instead of an additive offset
 *  makes follow fight shake. Compose: smooth follow first, add shake offset last."
 *
 *  이 프로젝트의 카메라는 `applyManualCameraFollow` 가 **매 프레임 scroll 을 산술로 확정**한다
 *  (Phaser 4.2.1 preRender follow 를 걷어낸 커스텀 경로). 따라서 여기서 setScroll 을 직접
 *  호출하면 다음 프레임에 덮어써져 **셰이크가 아예 보이지 않는다**.
 *  → 이 클래스는 **오프셋만 계산해 노출**하고, 팔로우 계산이 끝난 뒤 씬이 더한다. */
class TraumaShake {
  private trauma = 0;
  private t = 0;
  /** 팔로우 결과에 더할 값 (읽기 전용) */
  ox = 0;
  oy = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** 매 프레임 호출 — 오프셋만 갱신하고 카메라는 건드리지 않는다. */
  update(dtMs: number): void {
    if (this.trauma <= 0) {
      this.ox = 0;
      this.oy = 0;
      return;
    }
    /* 초당 감쇠 — 작은 타격은 금방 사라지고 큰 타격은 오래 남는다 */
    this.trauma = Math.max(0, this.trauma - (dtMs / 1000) * 1.15);
    const s = this.trauma * this.trauma; // 제곱: 약한 흔들림은 거의 안 보이고 강한 것만 확실히
    this.t += dtMs / 1000 * 34;
    /* 매 프레임 Math.random 은 정전기처럼 떨린다 → 샘플링된 사인 두 축 */
    this.ox = Math.sin(this.t * 1.7) * 18 * s;
    this.oy = Math.sin(this.t * 2.3) * 11 * s;
  }

  reset(): void {
    this.trauma = 0;
    this.ox = 0;
    this.oy = 0;
  }
}

/** 씬당 하나. playUltCinematic 이 내부에서 사용한다. */
const rigs = new WeakMap<S3, TraumaShake>();

export function getTraumaShake(scene: S3): TraumaShake {
  let r = rigs.get(scene);
  if (!r) { r = new TraumaShake(); rigs.set(scene, r); }
  return r;
}

export type CinematicOpts = {
  /** 총 연출 길이(ms) — 시전 시간(ultHold)에 맞춰 넘긴다 */
  durationMs: number;
  /** 계열/직업 색 */
  tint: number;
  /** 규모 배율 (1차=1, 2차=1.35) */
  scale?: number;
};

/**
 * 궁극기 시네마틱 레이어. playUltLayers 와 **별개**로 겹쳐서 부른다
 * (기존 5레이어는 그대로 두고 채널만 추가 — 회귀 위험 최소화).
 */
export function playUltCinematic(scene: S3, x: number, y: number, opts: CinematicOpts): void {
  const dur = Math.max(1000, opts.durationMs);
  const tint = opts.tint;
  const s = opts.scale ?? 1;
  const webgl = scene.game.renderer.type === Phaser.WEBGL;
  const cam = scene.cameras.main;
  const shake = getTraumaShake(scene);

  const at = (frac: number, fn: () => void) => {
    scene.time.delayedCall(Math.round(dur * frac), () => {
      try { fn(); } catch { /* 씬 종료 경합 무시 */ }
    });
  };

  const add = (
    key: string, px: number, py: number, depth: number,
    from: number, to: number, alpha: number, ms: number,
    rot = 0, tintOverride?: number,
  ) => {
    if (!scene.textures.exists(key)) return;
    try {
      const im = scene.add.image(px, py, key)
        .setDepth(depth)
        .setScale(from * s)
        .setAlpha(alpha)
        .setTint(tintOverride ?? tint)
        .setRotation(rot);
      if (webgl) im.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: im,
        scale: to * s,
        alpha: 0,
        duration: ms,
        ease: "Cubic.out",
        onComplete: () => im.destroy(),
      });
    } catch { /* 무시 */ }
  };

  /* ── ① 진입 폭발 — 100ms 안에 여러 채널이 함께 터진다 ── */
  at(0.02, () => {
    shake.add(0.35);
    stop(scene, 45);
    cam.flash(90, 255, 255, 255); // 백색 섬광(전체)
    add("fx_FlashFree3", x, y, 24, 0.5, 3.0, 0.95, 380, 0, 0xffffff);
    add("fx_glow", x, y - 12, 9, 0.8, 3.6, 0.5, 520);
    add("fx_Circle", x, y, 6, 0.4, 4.2, 0.7, 640);
  });

  /* ── ④ 상승 광주 — 발밑에서 솟는 빛기둥 (시전 시작과 함께) ── */
  at(0.05, () => {
    for (let i = 0; i < 3; i++) {
      add("fx_Flare", x + (i - 1) * 16, y - 40, 20, 0.3, 0.55, 0.55, Math.round(700 + i * 120), 0);
    }
  });

  /* ── ⑤ 파편 낙하 — 하늘에서 떨어지는 계열색 파편 ── */
  const fragN = Math.round(10 * (webgl ? 1 : 0.5) * s);
  for (let i = 0; i < fragN; i++) {
    const delay = Math.round(dur * (0.10 + Math.random() * 0.30));
    scene.time.delayedCall(delay, () => {
      try {
        const key = i % 3 === 0 ? "fx_ball" : i % 2 === 0 ? "fx_Flare" : "fx_Circle";
        const useKey = scene.textures.exists(key) ? key : "fx_Flare";
        if (!scene.textures.exists(useKey)) return;
        const sx = x + (Math.random() - 0.5) * 260 * s;
        const im = scene.add.image(sx, y - 260 * s, useKey)
          .setDepth(19)
          .setScale(0.18 * s)
          .setAlpha(0.9)
          .setTint(tint)
          .setRotation(Math.random() * Math.PI);
        if (webgl) im.setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: im,
          y: y + (Math.random() - 0.3) * 40,
          scale: 0.55 * s,
          alpha: 0,
          duration: Math.round(420 + Math.random() * 260),
          ease: "Quad.in",
          onComplete: () => im.destroy(),
        });
      } catch { /* 무시 */ }
    });
  }

  /* ── ③ 방사 충격파 4단 — 지면을 타고 퍼진다(시간차로 층이 생긴다) ── */
  for (let i = 0; i < 4; i++) {
    at(0.12 + i * 0.13, () => {
      shake.add(0.18 - i * 0.03);
      add("fx_shockwave", x, y + 6, 5 + i, 0.25, 3.4 + i * 0.5, 0.62 - i * 0.09, 520 + i * 60);
      add("fx_Circle2", x, y + 4, 6, 0.3, 3.0 + i * 0.4, 0.45, 460);
    });
  }

  /* ── ② 중반 임팩트 — 가장 강한 셰이크 + 프리즈 ── */
  at(0.46, () => {
    shake.add(0.5);
    stop(scene, 70);
    cam.flash(120, tint >> 16 & 0xff, tint >> 8 & 0xff, tint & 0xff);
    add("fx_burst", x, y - 8, 23, 0.5, 2.8, 0.85, 520);
    add("fx_lightning", x, y, 18, 0.6, 2.2, 0.7, 360, Math.random() * Math.PI);
  });

  /* ── ⑧ 명멸 궤도 링 — 캐릭터 둘레를 도는 링 ── */
  at(0.30, () => {
    const orbN = webgl ? 6 : 3;
    for (let i = 0; i < orbN; i++) {
      const a0 = (i / orbN) * Math.PI * 2;
      const r = 58 * s;
      const im = scene.add.image(x + Math.cos(a0) * r, y + Math.sin(a0) * r * 0.6, "fx_glow")
        .setDepth(20)
        .setScale(0.22 * s)
        .setAlpha(0.8)
        .setTint(tint);
      if (webgl) im.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: im,
        alpha: 0,
        scale: 0.05,
        duration: Math.round(dur * 0.34),
        ease: "Sine.in",
        onComplete: () => im.destroy(),
      });
      /* 궤도 회전 — 각자 위상을 조금씩 어긋나게 */
      const spinMs = Math.round(dur * 0.34);
      const angle0 = a0;
      scene.tweens.addCounter({
        from: 0, to: 1, duration: spinMs, ease: "Sine.out",
        onUpdate: (tw) => {
          try {
            const p = tw.getValue() ?? 0;
            const ang = angle0 + p * Math.PI * 1.6;
            const rr = r * (1 - p * 0.7);
            im.setPosition(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.6 - p * 18);
          } catch { /* 무시 */ }
        },
      });
    }
  });

  /* ── ⑥ 종결 — 가장 큰 프리즈 + 셰이크, 백색 플래시 ── */
  at(0.82, () => {
    shake.add(1.0);
    stop(scene, 110);
    cam.flash(160, 255, 255, 255);
    cam.shake(260, 0.010 * s);
    add("fx_FlashFree3", x, y, 24, 0.8, 4.0, 1.0, 560, 0, 0xffffff);
    add("fx_flarebig", x, y, 22, 0.6, 3.6, 0.9, 620);
    for (let i = 0; i < 2; i++) {
      add("fx_shockwave", x, y + 6, 5, 0.4, 4.6 + i, 0.7, 620 + i * 80);
    }
  });

  /* ── ⑦ 복귀 크로스페이드 — 암전이 갑자기 걷히지 않게 ── */
  at(0.90, () => {
    try {
      const fade = scene.add.rectangle(cam.midPoint.x, cam.midPoint.y, cam.width * 1.4, cam.height * 1.4, tint, 0.16)
        .setScrollFactor(0).setDepth(139);
      scene.tweens.add({
        targets: fade, alpha: 0, duration: Math.round(dur * 0.09),
        ease: "Quad.out", onComplete: () => fade.destroy(),
      });
    } catch { /* 무시 */ }
  });

  /* 정리 — 시전 중 씬이 바뀌어도 trauma 가 남지 않게 */
  scene.time.delayedCall(dur + 200, () => { try { shake.reset(); } catch { /* 무시 */ } });
}
