/**
 * SERTZ Tutorial (v1.0.11) — 신규 플레이어 온보딩 튜토리얼 ("튜토리얼 제작" 유저 지시)
 *
 *  기존 인트로(이동 학습 → 우물 → 이름 짓기)가 끝난 뒤 마을에서 이어지는 전투 온보딩.
 *   ① 주민과 대화(E) → ② 차원문 이동 → ③ 첫 전투(처치 ×3) → ④ 전리품 줍기 → ⑤ 스킬(Z) → ⑥ 물약(D)
 *  → 완료: 스파클 버스트 + 축하 보상 (골드/물약/뽑기권) + 세이브 플래그.
 *
 *  설계 규약 (기존 틀 유지):
 *   · UI는 Phaser 오브젝트 — React 오버레이 비개입 (banner/panel 체계 그대로)
 *   · 마을(안전지대, enemies:[])에서 사냥터로 이어지므로 tutStep을 세이브에 기록해 씬 전환에도 재개
 *   · WorldScene이 소유(this.tut), update(dt)에서 마커 추적, notify(ev)로 학습 판정
 *   · 진행 판정은 실제 성공 시에만 (useSkill1 MP/CD 통과, usePotion 보유+회복 성공 등)
 */
import Phaser from "phaser";
import { EventBus } from "../components/game/EventBus"; // v1.1.1 — 상대경로 수정(세션 중단 커밋에서 잘못 기록됨)
import type { WorldScene } from "./scenes/WorldScene";

/* vc256 (지시 #9) — 8단계 → 5단계. 물약('pot')은 첫 전투 중 자연히 쓰게 되고,
 *  쉐이더·고대비('shader'/'contrast')는 설정 화면 항목이라 첫 5분에 강제할 이유가 없다.
 *  (설정 토글은 여전히 tut:notify 를 보내지만 매칭되는 단계가 없어 조용히 무시된다 —
 *   구 세이브의 tutStep 값이 5 이상이어도 Clamp 로 안전하다.) */
type TutStepId = "talk" | "portal" | "kill" | "pickup" | "skill";

interface TutStep {
  id: TutStepId;
  title: string;
  desc: string;
  goal: number;
  marker: "npc" | "portal" | "enemy" | null;
}

/* v1.4.10 — 유저 지시 "튜토리얼 및 게임 중에 부연 설명이 너무 적어 사용자 친화적이 않음":
 *  각 단계에 ▸조작법 · ▸위치 · ▸실패 시 대처까지 담은 2~3문장 상세 설명으로 보강.
 *  desc는 패널(520px)에 2줄까지 표시되며, 시작 배너로도 그대로 안내된다.
 * v1.0.13 피드백#17 — 화자를 안내인(요정)로 확정: 제목에 [안내인] 접두, 본문은 안내인 말투
 *  ("~해보자!", "여기를 꾹 눌러줘!")로 무엇을 · 어디를 · 누르면 무슨 일이 벌어지는지 + 팁 1개.
 *  ⑤스킬/⑥물약 단계 진입·완료 시 tut:dom 이벤트로 TouchControls DOM 버튼에 링 하이라이트. */
/* vc256 (지시 #9) — "튜토리얼 너무 짜침(너무 글자만 도배 되어있고 초반에 너무 알림창이 많이 뜸
 *  (스트레스 유발 원인!!)" 지적에 대한 전면 개편.
 *
 * [실측한 문제]
 *  · 8단계 × 평균 115자 = **921자 도배**. desc 는 배너에도 그대로 찍혀 화면을 덮었다.
 *  · 알림 배너가 시작1 + 단계별 진입·완료 = **약 17회**. 게임을 시작하자마자
 *    배너가 연달아 떠서 플레이를 가로막았다.
 *  · 단계 ⑦⑧(쉐이더·고대비)은 **설정 화면을 열어야 하는** 부가 기능이라
 *    첫 5분에 반드시 시킬 이유가 없다(존재를 모르면 못 쓰는 문제는 '도움' 패널이 이미 안내).
 *
 * [새 설계 원칙]
 *  ① **글 대신 행동**: desc 를 한 문장(25~45자)으로 줄이고, 조작법은 배너가 아니라
 *     패널 하단의 키 배지로 뺀다. 읽을 것을 줄이고 하게 만들 것을 남긴다.
 *  ② **알림 최소화**: 단계 진입 배너를 없애고, 패널만 조용히 갱신한다.
 *     배너는 ① 시작 ② 완료 ③ 스킵 — **3회만**.
 *  ③ **단계 8 → 5**: 첫 전투·이동·보상·스킬까지가 핵심. 설정류는 '도움'으로 이관.
 *  ④ 진행 표시(pips)와 목표 카운트는 유지 — "얼마나 남았는지"는 스트레스가 아니라 안내다.
 */
const STEPS: TutStep[] = [
  {
    id: "talk",
    title: "주민에게 말 걸기",
    desc: "표시가 뜬 주민에게 다가가 말을 걸어 보자.",
    goal: 1,
    marker: "npc",
  },
  {
    id: "portal",
    title: "차원문으로 이동",
    desc: "동쪽 소용돌이로 들어가 첫 사냥터를 골라 보자.",
    goal: 1,
    marker: "portal",
  },
  {
    id: "kill",
    title: "첫 전투",
    desc: "몬스터 3마리를 처치하자. 때리고 물러나기를 반복하면 안전해.",
    goal: 3,
    marker: "enemy",
  },
  {
    id: "pickup",
    title: "전리품 줍기",
    desc: "떨어진 골드와 아이템 위로 지나가면 자동으로 주워진다.",
    goal: 1,
    marker: null,
  },
  {
    id: "skill",
    title: "스킬 사용",
    desc: "MP가 찼을 때 스킬 버튼을 눌러 보자. 한 번에 여럿을 벤다.",
    goal: 1,
    marker: "enemy",
  },
];

/** 단계별 조작 키 배지 — 배너/문장 대신 짧은 표기로 조작법을 전달한다. */
const STEP_KEYS: Partial<Record<TutStepId, string>> = {
  talk: "Space / 말 걸기 버튼",
  portal: "걸어 들어가기",
  kill: "X / 공격 버튼",
  skill: "Z / 스킬 버튼",
};

/* v1.4.10 — 상세 설명(2~3줄) 수용을 위해 패널 높이 62→80 확대
 * v1.0.13 피드백#17 — 안내인 상세 안내(4문장) 수용: 패널 높이 80→96 (desc 4줄 + 여백)
 *  desc 랩폭 390px @12px ≈ 32자/줄 × 4줄 = 128자 이내 — 위 STEPS desc는 전부 이 한도 내 */
const PANEL_W = 520;
const PANEL_H = 96;

export class Tutorial {
  private scene: WorldScene;
  private stepIdx: number;
  private prog = 0;
  private done = false;
  /* v1.0.13 피드백#17 — 현재 DOM 하이라이트 중인 버튼 키 (destroy 시 off 보장용) */
  private domOn: "skill" | "potion" | null = null;

  /* HUD 오브젝트 */
  private hud: Phaser.GameObjects.Container | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private tTitle!: Phaser.GameObjects.Text;
  private tDesc!: Phaser.GameObjects.Text;
  /** vc256 — 조작 키 배지 (문장 대신 짧은 표기) */
  private tKey!: Phaser.GameObjects.Text;
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
    /* v1.0.13 피드백#17 — 안내인 화자 배너 + 재개 단계가 ⑤/⑥이면 DOM 버튼 하이라이트 즉시 복원 */
    this.emitDom(this.domKeyOf(STEPS[this.stepIdx].id), true);
    /* vc256 — 시작 배너는 1회, 짧게. 종전엔 desc(115자)를 그대로 찍어 화면을 덮었다. */
    this.scene.showBanner("안내인: 우선 주민에게 말을 걸어 보자");
    /* v1.1.1 (#1 가림) — 튜토리얼 활성 사실을 React에 알린다.
     *  튜토리얼 패널은 Phaser(캔버스 내부)라 React DOM 오버레이(보상 팝업 z-70 · 퀘스트 트래커 등)에
     *  항상 가려진다 → React가 tut:active를 받으면 상단 중앙 충돌 UI를 비켜세운다 (HUD/Overlays 참조) */
    EventBus.emit("tut:active", { active: true });
  }

  get currentId(): TutStepId | null {
    return this.done ? null : STEPS[this.stepIdx].id;
  }

  /* ─────────── v1.0.13 피드백#17 — DOM 버튼 하이라이트 이벤트 ───────────
   *  ⑤스킬/⑥물약 단계가 활성화되면 { key, on:true }, 완료·종료 시 on:false 를 발사한다.
   *  TouchControls가 구독해 해당 DOM 버튼(첫 스킬 버튼/HP 물약 버튼)에 링을 씌운다.
   *  key는 튜토리얼 step id가 아니라 DOM 버튼 식별자("skill"/"potion") — UI 계약 분리. */
  private domKeyOf(id: TutStepId): "skill" | "potion" | null {
    /* vc185 (#3) — shader/contrast 는 DOM 버튼 링이 아니라 설정 패널 조작으로 완료된다. */
    return id === "skill" ? "skill" : null;
  }

  private emitDom(key: "skill" | "potion" | null, on: boolean) {
    if (!key) return;
    if (on) this.domOn = key;
    else if (this.domOn === key) this.domOn = null;
    EventBus.emit("tut:dom", { key, on });
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
    /* v1.0.13 피드백#17 — desc 4줄 수용: 상단 오프셋 28→26, 랩폭 130→124 여백 확보 */
    this.tDesc = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 26, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "12px", color: "#e8f4ff", wordWrap: { width: PANEL_W - 124 },
    });
    this.tPips = s.add.text(PANEL_W / 2 - 16, -PANEL_H / 2 + 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#9df0ff",
    }).setOrigin(1, 0);
    /* vc256 (지시 #9) — 조작 키 배지. 종전엔 조작법이 desc 문장 안에 섞여 있어
     *  "글자 도배"의 주범이었다. 조작은 짧은 배지로 분리한다. */
    this.tKey = s.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 22, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#ffd98a",
    }).setOrigin(0, 1);
    this.tSkip = s.add.text(PANEL_W / 2 - 16, PANEL_H / 2 - 20, "스킵 ▶", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#7a8aa0",
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.tSkip.on("pointerup", () => this.skip());

    this.hud.add([this.g, this.tTitle, this.tDesc, this.tPips, this.tKey, this.tSkip]);
    this.layoutHud();

    /* 마커 — 목표물 위에서 깜빡이는 광점+스파클 (인트로 가이드와 같은 어휘)
     * v1.0.13 피드백#17 — 스케일은 update()의 sin 펄스가 담당(1.0→1.35 배수)하므로
     *  트윈은 알파 브리딩만 담당한다 (두 드라이버가 scale을 동시에 쓰는 충돌 방지) */
    if (s.textures.exists("gw_dot")) {
      this.mkGlow = s.add.image(0, 0, "gw_dot").setDepth(9100).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9df0ff).setScale(0.62).setAlpha(0.85);
      s.tweens.add({ targets: this.mkGlow, alpha: 0.55, duration: 640, yoyo: true, repeat: -1, ease: "Sine.inOut" });
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
    /* vc256 — 조작 키는 배지로 (없는 단계는 빈칸) */
    this.tKey?.setText(STEP_KEYS[st.id] ? `조작  ${STEP_KEYS[st.id]}` : "");
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
    /* v1.0.13 피드백#17 — 완료된 단계가 ⑤/⑥이면 DOM 버튼 하이라이트 해제 */
    this.emitDom(this.domKeyOf(STEPS[this.stepIdx].id), false);
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
    /* v1.0.13 피드백#17 — 새 단계가 ⑤/⑥이면 DOM 버튼 하이라이트 on */
    this.emitDom(this.domKeyOf(STEPS[this.stepIdx].id), true);
    /* vc256 (지시 #9) — 단계마다 배너를 띄우지 않는다.
     *  종전엔 진입·완료마다 배너가 떠 총 17회 화면을 덮었다("알림창이 너무 많이 뜸").
     *  이제 패널의 제목·설명·진행점만 조용히 갱신한다 — 시선을 빼앗지 않는다. */
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
      /* v1.0.13 피드백#17 — "뭘 만져야 하는지" 더 잘 보이게 sin 기반 스케일 펄스(1.0→1.35 배수).
       *  gw_dot 원본이 256px이라 절대 스케일은 0.62 기준 배수로 절제 (0.62↔0.84 화면 스케일) */
      if (this.mkGlow) {
        const sec = this.scene.time.now / 1000;
        const pulse = 1 + 0.35 * (0.5 - 0.5 * Math.cos((sec * Math.PI * 2) / 0.9));
        this.mkGlow.setScale(0.62 * pulse);
      }
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
    /* 축하 연출 — 스파클 버스트 + 광점 (v1.0.13 — 벚꽃 소나기 제거 대체) */
    try {
      s.spawnCelebrateFX(p.x, p.y, 20);
      s.cameras.main.flash(220, 255, 220, 240);
      s.impactFX.shake(120, 0.003);
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
    /* v1.0.13 피드백#17 — 완료/스킵 경로와 무관하게 남은 하이라이트는 반드시 해제 */
    if (this.domOn) this.emitDom(this.domOn, false);
    /* v1.1.1 (#1 가림) — 종료(완료/스킵) 시 상단 UI 원위치 */
    EventBus.emit("tut:active", { active: false });
  }
}
