/**
 * 5차(각성) 캐릭터 발광 — v1.4.41 (#9)
 *
 * 유저 지시: "9는 외형은 조금만 바뀌고 색깔만 바뀌어도 ㄱㅊ
 *            (단. 5차 시에는 캐릭터에 블룸 및 약한 라이트 효과 ㄱㄱ)"
 *
 * 즉 외형(스프라이트)은 지금처럼 색조 변화만으로 충분하고, 대신 **5차가 되면
 * 캐릭터 자체가 빛나야** 한다. 이 모듈이 그 지속 연출을 담당한다.
 *
 * 구성 (ADD 블렌드 = 가산광)
 *   ① 블룸 코어   — 캐릭터 발밑/몸통에 깔리는 부드러운 원형 광
 *   ② 라이트 헤일로 — 머리 위 약한 광원 (호흡하듯 1.6s 주기로 미세 명멸)
 *   ③ 지면 라이트  — 발밑을 은은하게 밝히는 타원 (바닥 반사 느낌)
 *
 * 왜 씬에서 관리하나
 *   Player 는 물리·스탯 상태를 들고 있고, 이 연출은 순수 "보기" 상태다.
 *   phaser-2d-game 원칙대로 렌더 상태는 씬이 소유하고 매 프레임 Player 좌표를 따라간다.
 *   (스프라이트·트윈은 언제든 버려질 수 있는 view state)
 */
import Phaser from "phaser";

export type FifthAura = {
  core: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  ground: Phaser.GameObjects.Image;
  /** 0..1 — 해금/해제 시 부드럽게 켜고 끄기 위한 강도 */
  strength: number;
  /** 목표 강도 (0 또는 1) */
  target: number;
  baseY: number;
};

/* v1.4.41 — 범용 원형 대신 **Unity VFX 팩 전용 텍스처**를 쓴다(유저 지적: 왜 안 씀?).
 *  gvb_shield_hex   = GameVFX FX_Buff_EnergyShield 의 육각 보호막 → 5차 각성에 의미가 맞다
 *  gvb_glow_blurry  = FX_Buff_MagicAir 의 부드러운 광 → 헤일로
 *  gvb_ring_soft    = HexagonShield 의 바깥 링 → 지면 */
const TEX_CORE = "gvb_shield_hex";
const TEX_HALO = "gvb_glow_blurry";
const TEX_GROUND = "gvb_ring_soft";

export class FifthAuraRig {
  private scene: Phaser.Scene;
  private rig: FifthAura | null = null;
  private lastHex = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 5차 여부를 매 프레임 반영한다. on=false 면 서서히 사라진 뒤 파괴. */
  update(x: number, y: number, on: boolean, hex: number, flipX: boolean): void {
    if (on && !this.rig) this.build(hex);
    if (!this.rig) return;
    const r = this.rig;

    /* 색이 바뀌면(전직·코스튬) 즉시 반영 */
    if (hex !== this.lastHex) {
      this.lastHex = hex;
      r.core.setTint(hex);
      r.halo.setTint(hex);
      r.ground.setTint(hex);
    }

    r.target = on ? 1 : 0;
    /* 0.08/frame 남짓 — 약 0.5초에 켜지고 꺼진다 (급격한 점멸 방지) */
    r.strength += (r.target - r.strength) * 0.08;

    if (!on && r.strength < 0.01) {
      this.destroy();
      return;
    }

    const s = r.strength;
    /* 호흡 — 1.6초 주기 사인파. 0.72~1.0 사이를 오가 '살아있는 빛'으로 보이게 */
    const t = this.scene.time.now / 1600;
    const breath = 0.86 + 0.14 * Math.sin(t * Math.PI * 2);

    r.core.setPosition(x, y - 10);
    r.core.setAlpha(0.42 * s * breath);
    r.core.setScale(0.95 * breath * s + 0.05);
    r.core.setDepth(10.4); // 몸통 뒤·발밑 (플레이어 depth 9~10)

    /* 육각 보호막은 천천히 회전해야 "살아있는 방어막"으로 읽힌다 */
    r.halo.setPosition(x, y - 18);
    r.halo.setAlpha(0.30 * s * breath);
    r.halo.setScale(0.95 * breath * s + 0.1);
    r.halo.setRotation(this.scene.time.now / 5200);
    r.halo.setDepth(10.45);

    r.ground.setPosition(x, y + 8);
    r.ground.setAlpha(0.22 * s);
    r.ground.setScale(1.25 * s + 0.1, 0.42 * s + 0.05);
    r.ground.setDepth(5); // 지면 레이어
    r.ground.setFlipX(flipX);
  }

  private build(hex: number): void {
    const mk = (tex: string, depth: number) => {
      const im = this.scene.add.image(0, -9999, tex);
      im.setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0);
      if (!this.scene.textures.exists(tex)) im.setVisible(false);
      return im;
    };
    this.lastHex = hex;
    this.rig = {
      core: mk(TEX_CORE, 10.4).setTint(hex),
      halo: mk(TEX_HALO, 10.45).setTint(hex),
      ground: mk(TEX_GROUND, 5).setTint(hex),
      strength: 0,
      target: 1,
      baseY: 0,
    };
  }

  destroy(): void {
    if (!this.rig) return;
    this.rig.core.destroy();
    this.rig.halo.destroy();
    this.rig.ground.destroy();
    this.rig = null;
    this.lastHex = -1;
  }
}
