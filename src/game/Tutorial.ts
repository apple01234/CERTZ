/**
 * SERTZ Tutorial (v1.0.11) — 신규 플레이어 온보딩 튜토리얼 ("튜토리얼 제작" 유저 지시)
 *
 *  기존 인트로(이동 학습 → 우물 → 이름 짓기)가 끝난 뒤 마을에서 이어지는 전투 온보딩.
 *   ① 주민과 대화(E) → ② 차원문 이동 → ③ 첫 전투(처치 ×3) → ④ 전리품 줍기 → ⑤ 스킬(Z) → ⑥ 물약(D)
 *  → 완료: 벚꽃 소나기 + 축하 보상 (골드/물약/뽑기권) + 세이브 플래그.
 *
 *  설계 규약 (기존 틀 유지):
 *   · UI는 Phaser 오브젝트 — React 오버레이 비개입 (banner/panel 체계 그대로)
 *   · 마을(안전지대, enemies:[])에서 사냥터로 이어지므로 tutStep을 세이브에 기록해 씬 전환에도 재개
 *   · WorldScene이 소유(this.tut), update(dt)에서 마커 추적, notify(ev)로 학습 판정
 *   · 진행 판정은 실제 성공 시에만 (useSkill1 MP/CD 통과, usePotion 보유+회복 성공 등)
 */
import Phaser from "phaser";
import { spawnPetalStorm } from "./fx/StudioFX";
import type { WorldScene } from "./scenes/WorldScene";

type TutStepId = "talk" | "portal" | "kill" | "pickup" | "skill" | "pot";

interface TutStep {
  id: TutStepId;
  title: string;
  desc: string;
  goal: number;
  marker: "npc" | "portal" | "enemy" | null;
}

const STEPS: TutStep[] = [
  { id: "talk", title: "주민과 대화", desc: "NPC에게 가까이 가서 E 키(모바일은 상호작용 버튼)로 말을 걸어 보자!", goal: 1, marker: "npc" },
  { id: "portal", title: "차원문 이동", desc: "마을 동쪽 차원문(포탈)에 들어가 첫 사냥터 '숲의 신전'으로 가자!", goal: 1, marker: "portal" },
  { id: "kill", title: "첫 전투", desc: "X 키(공격)로 몬스터를 처치하자! (3마리)", goal: 3, marker: "enemy" },
  { id: "pickup", title: "전리품 줍기", desc: "몬스터가 떨어뜨린 골드/아이템에 부딪혀 주워 보자!", goal: 1, marker: null },
  { id: "skill", title: "스킬 사용", desc: "Z 키(스킬 1)로 화려한 스킬을 쓸 수 있다! 몬스터에게 써 보자!", goal: 1, marker: "enemy" },
  { id: "pot", title: "물약 회복", desc: "HP가 깎였으면 D 키로 HP 물약을 마시자! (시작 물약 지급 완료)", goal: 1, marker: null },
];

const PANEL_W = 520;
const PANEL_H = 62;

export class Tutorial {
  private scene: WorldScene;
  private stepIdx: number;
  private prog = 0;
  private done = false;

  /* HUD 오브젝트 */
  private hud: Phaser.GameObjects.Container | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private tTitle!: Phaser.GameObjects.Text;
  private tDesc!: Phaser.GameObjects.Text;
  private tPips!: Phaser.GameObjects.Text;
  private tSkip!: Phaser.GameObjects.Text;
  /* 마커 */
  private mkGlow: Phaser.GameObjects.Image | null = null;
  private mkSpark: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: WorldScene, resumeStep = 0) {
    this.scene = scene;
    this.stepIdx = Phaser.Math.Clamp(resumeStep, 0, STEPS.length - 1);
    this.buildHud();
    this.refresh();
    this.scene.showBanner(`튜토리얼 시작 — ${STEPS[this.stepIdx].desc}`);
  }

  get currentId(): TutStepId | null {
    return this.done ? null : STEPS[this.stepIdx].id;
  }

  /* ───────────────────────── HUD ───────────────────────── */

  private buildHud() {
    const s = this.scene;
    this.hud = s.add.container(0, 0).setDepth(9200).setScrollFactor(0);

    this.g = s.add.graphics();
    this.g.fillStyle(0x0a1020, 0.84);
    this.g.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.g.lineStyle(1.5, 0x9df0ff, 0.5);
    this.g.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);

    this.tTitle = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "14px", fontStyle: "bold", color: "#ffe9a0",
    });
    this.tDesc = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 28, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "12px", color: "#e8f4ff", wordWrap: { width: PANEL_W - 130 },
    });
    this.tPips = s.add.text(PANEL_W / 2 - 16, -PANEL_H / 2 + 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#9df0ff",
    }).setOrigin(1, 0);
    this.tSkip = s.add.text(PANEL_W / 2 - 16, PANEL_H / 2 - 20, "스킵 ▶", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#7a8aa0",
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.tSkip.on("pointerup", () => this.skip());

    this.hud.add([this.g, this.tTitle, this.tDesc, this.tPips, this.tSkip]);
    this.layoutHud();

    /* 마커 — 목표물 위에서 깜빡이는 광점+스파클 (인트로 가이드와 같은 어휘) */
    if (s.textures.exists("gw_dot")) {
      this.mkGlow = s.add.image(0, 0, "gw_dot").setDepth(9100).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9df0ff).setScale(0.5).setAlpha(0.85);
      s.tweens.add({ targets: this.mkGlow, scale: 0.72, alpha: 0.55, duration: 640, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    if (s.textures.exists("sparkle0")) {
      this.mkSpark = s.add.sprite(0, 0, "sparkle0").setDepth(9101).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8);
      try { this.mkSpark.play("sparkle"); } catch { /* 애니 미상 — 광점만 */ }
    }

    s.scale.on("resize", this.onResize, this);
  }

  /* v1.0.11 버그 수정 — 카메라 줌(1600×720 대응 applyCameraZoom)에서 scrollFactor 0 오브젝트는
   *  화면 좌표 = 월드좌표×zoom + 중심×(1−zoom) 로 사영된다. 고정 y=44는 zoom 1.25에서
   *  화면 위(-35px)로 밀려나 패널이 안 보였다 → 줌을 역산해 화면 상단 중앙에 고정 */
  private layoutHud() {
    if (!this.hud) return;
    const s = this.scene;
    const cam = s.cameras.main;
    const z = cam.zoom || 1;
    const sx = s.scale.width / 2;
    const sy = 100; // 상단 토스트·HP바 회피 (v1.0.11 — 44에서 하향)
    const wx = (sx - (s.scale.width / 2) * (1 - z)) / z;
    const wy = (sy - (s.scale.height / 2) * (1 - z)) / z;
    this.hud.setPosition(wx, wy);
  }

  private onResize() {
    this.layoutHud();
  }

  private refresh() {
    if (this.done) return;
    const st = STEPS[this.stepIdx];
    this.tTitle.setText(`튜토리얼 ${this.stepIdx + 1}/${STEPS.length} · ${st.title}`);
    this.tDesc.setText(st.desc + (st.goal > 1 ? `  (${this.prog}/${st.goal})` : ""));
    this.tPips.setText(STEPS.map((_, i) => (i < this.stepIdx ? "●" : i === this.stepIdx ? "◉" : "○")).join(" "));
  }

  /* ───────────────────── 진행 판정 ───────────────────── */

  /** WorldScene/Player 훅이 호출 — 실제 성공 시에만 전달된다 */
  notify(ev: string) {
    if (this.done) return;
    const st = STEPS[this.stepIdx];
    if (ev !== st.id) return;
    this.prog++;
    if (this.prog >= st.goal) this.advance();
    else this.refresh();
  }

  private advance() {
    const s = this.scene;
    /* 단계 완료 연출 — HUD 위 광점 플래시 (줌 보정 좌표 — layoutHud와 동일 산식) */
    if (s.textures.exists("gw_glow")) {
      const cam = s.cameras.main;
      const z = cam.zoom || 1;
      const fx = s.add.image(
        (cam.width / 2 - (s.scale.width / 2) * (1 - z)) / z,
        (100 - (s.scale.height / 2) * (1 - z)) / z,
        "gw_glow",
      ).setDepth(9201).setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0x9df0ff).setScale(0.4).setAlpha(0.8);
      s.tweens.add({ targets: fx, alpha: 0, scale: 1.6, duration: 480, ease: "Cubic.out", onComplete: () => fx.destroy() });
    }
    try { s.sfxLevelUp(); } catch { /* 사운드 실패 무시 */ }
    this.stepIdx++;
    this.prog = 0;
    if (this.stepIdx >= STEPS.length) { this.finish(); return; }
    /* 중간 세이브 — 씬 전환(마을→사냥터)에도 tutStep 유지 */
    s.saveTutorialProgress(this.stepIdx);
    this.refresh();
    s.showBanner(`튜토리얼 ${this.stepIdx + 1}/${STEPS.length} — ${STEPS[this.stepIdx].desc}`);
  }

  /* ───────────────────── 프레임 갱신 ───────────────────── */

  update() {
    if (this.done) return;
    const st = STEPS[this.stepIdx];
    /* 마커 추적 */
    let tx: number | null = null;
    let ty: number | null = null;
    if (st.marker === "enemy") {
      const p = this.scene.playerRef;
      if (!p) return;
      let best: { x: number; y: number } | null = null;
      let bd = 1e9;
      for (const e of this.scene.enemyList) {
        if (!e.active || !e.alive) continue;
        const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) { tx = best.x; ty = best.y - 36; }
    } else if (st.marker === "portal") {
      const po = this.scene.portalRef;
      if (po?.active) { tx = po.x; ty = po.y - 46; }
    } else if (st.marker === "npc") {
      const p = this.scene.playerRef;
      if (!p) return;
      let best: { x: number; y: number } | null = null;
      let bd = 1e9;
      for (const it of this.scene.npcList) {
        const d = Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y);
        if (d < bd) { bd = d; best = it; }
      }
      if (best) { tx = best.x; ty = best.y - 42; }
    }
    if (tx !== null && ty !== null) {
      this.mkGlow?.setVisible(true).setPosition(tx, ty);
      this.mkSpark?.setVisible(true).setPosition(tx, ty - 10);
    } else {
      this.mkGlow?.setVisible(false);
      this.mkSpark?.setVisible(false);
    }
  }

  /* ───────────────────── 완료 / 스킵 ───────────────────── */

  private finish() {
    if (this.done) return;
    this.done = true;
    const s = this.scene;
    const p = s.playerRef;
    if (!p) { s.completeTutorialSave(); this.destroy(); return; }
    /* 축하 연출 — 벚꽃 소나기 + 광점 */
    try {
      s.spawnPetalBurst(p.x, p.y, 24);
      s.cameras.main.flash(220, 255, 220, 240);
      s.cameras.main.shake(120, 0.003);
    } catch { /* 연출 실패 — 보상은 정상 지급 */ }
    /* 축하 보상 — 골드 +500 · HP/MP 물약 ×3 · 뽑기권 +1 */
    p.addGold(500);
    p.addPotion("hp"); p.addPotion("hp"); p.addPotion("hp");
    p.addPotion("mp"); p.addPotion("mp"); p.addPotion("mp");
    s.grantTutorialRewards();
    s.showBanner("튜토리얼 완료! — 축하 보상: 골드 +500 · HP/MP 물약 ×3 · 뽑기권 +1");
    this.destroy();
    s.completeTutorialSave();
  }

  skip() {
    if (this.done) return;
    this.done = true;
    const s = this.scene;
    s.showBanner("튜토리얼을 건너뛰었다 — 이제 자유롭게 모험하자!");
    this.destroy();
    s.completeTutorialSave();
  }

  destroy() {
    this.scene.scale.off("resize", this.onResize, this);
    this.mkGlow?.destroy(); this.mkGlow = null;
    this.mkSpark?.destroy(); this.mkSpark = null;
    this.hud?.destroy(); this.hud = null;
  }
}
