/**
 * 5차(각성) 캐릭터 발광 — v1.4.41 (#9), vc204 개정 (#15)
 *
 * 유저 지시 1 (v1.4.41): "5차 시에는 캐릭터에 블룸 및 약한 라이트 효과 ㄱㄱ"
 * 유저 지시 2 (vc204 #15): "5차 전직시 있는 캐릭터 모습(베리어&아우라) 모든 직업이
 *                          같은 버그 — 직업마다 아우라나 이펙트가 달라야 함"
 *
 * 종전 문제
 *   core/halo/ground 세 겹의 **텍스처가 전 직업 공통**이라 tint 만 다른 같은 그림이었다.
 *   같은 계통 10직업은 계통색까지 같아 완전히 동일하게 보였다.
 *
 * 이제
 *   직업별 구성(텍스처·회전·맥동·종횡비)을 `fifthLooks.ts` 의 FIFTH_LOOKS 에서 읽는다.
 *   정의가 없는 직업은 계통 폴백(fallbackLook)으로 자연스럽게 떨어진다.
 *
 * 성능 (모바일 저사양)
 *   이미지 4장(코어·헤일로·지면·베리어)만 쓰고 파티클을 스폰하지 않는다.
 *   저사양 게이트에서는 헤일로를 생략해 3장으로 줄인다(FIFTH_AURA_IMAGE_BUDGET).
 */
import Phaser from "phaser";
import { FIFTH_LOOKS, type FifthLook } from "./fifthLooks";
import { familyOf } from "../classes";
import { ensureAtlasAnim } from "./atlasAnim"; // vc206 (#8) — 아틀라스 애니메이션

export type FifthAura = {
  core: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  ground: Phaser.GameObjects.Image;
  /** vc204 (#15) — 직업 고유 베리어 (몸을 감싸는 형태) */
  barrier: Phaser.GameObjects.Image | null;
  look: FifthLook;
  /** 0..1 — 해금/해제 시 부드럽게 켜고 끄기 위한 강도 */
  strength: number;
  /** 목표 강도 (0 또는 1) */
  target: number;
  baseY: number;
};

/* 계통 폴백 — FIFTH_LOOKS 에 없는 직업(구 세이브의 5차 미정의 클래스 등)용.
 *  vc204 이전과 같은 구성이되, 계통별로 형태를 조금씩 달리해 완전 동일은 피한다. */
function fallbackLook(cls: string | null | undefined): FifthLook {
  switch (familyOf(cls ?? "")) {
    case "mage":
      return { core: "gvb_glow_blue", halo: "gvb_shield_hex", ground: "gvb_ring_soft",
        barrier: "gvb_shield_hex", barrierSpin: 0.00026, barrierScale: 1.2, barrierPulse: 0.07,
        groundAspect: 1.0, tint: 0xffffff };
    case "thief":
      return { core: "gvu_glow", halo: "gvu_energynoise", ground: "gvb_ring_soft",
        barrier: "gvu_mask_ommi", barrierSpin: 0.0002, barrierScale: 1.05, barrierPulse: 0.12,
        groundAspect: 0.5, tint: 0xffffff };
    case "ranger":
      return { core: "gvb_glow_blurry", halo: "gvb_star_green", ground: "gvb_ring_soft",
        barrier: "gvb_twinkle", barrierSpin: 0.0006, barrierScale: 1.0, barrierPulse: 0.16,
        groundAspect: 0.55, tint: 0xffffff };
    case "pirate":
      return { core: "gvb_lensflare", halo: "gvu_trail_wave", ground: "gvb_ring_soft",
        barrier: "gvu_shockwave_fiery", barrierSpin: 0.0003, barrierScale: 1.3, barrierPulse: 0.14,
        groundAspect: 0.9, tint: 0xffffff };
    default:
      return { core: "gvb_glow_white", halo: "gvb_shockwave_fiery", ground: "gvb_ring_soft",
        barrier: "gvb_shield_hex", barrierSpin: 0.00024, barrierScale: 1.15, barrierPulse: 0.10,
        groundAspect: 0.42, tint: 0xffffff };
  }
}

export class FifthAuraRig {
  private scene: Phaser.Scene;
  private rig: FifthAura | null = null;
  private lastHex = -1;
  private lastCls: string | null = null;
  /** 저사양 게이트 — 헤일로를 생략해 이미지 3장으로 줄인다 */
  private lite: boolean;

  constructor(scene: Phaser.Scene, opts?: { lite?: boolean }) {
    this.scene = scene;
    this.lite = !!opts?.lite;
  }

  /** 5차 여부를 매 프레임 반영한다. on=false 면 서서히 사라진 뒤 파괴. */
  update(x: number, y: number, on: boolean, hex: number, flipX: boolean, cls?: string | null): void {
    /* vc204 (#15) — 직업이 바뀌면(전직) 리그를 다시 만든다. 텍스처 구성이 달라지므로
     *  tint 만 갱신해서는 직업별 외형이 반영되지 않는다. */
    if (on && this.rig && cls !== this.lastCls) {
      this.destroy();
    }
    if (on && !this.rig) this.build(hex, cls ?? null);
    if (!this.rig) return;
    const r = this.rig;

    /* 색이 바뀌면(전직·코스튬) 즉시 반영 */
    if (hex !== this.lastHex) {
      this.lastHex = hex;
      const t = (l: FifthLook) => (l.tint === 0xffffff ? hex : l.tint);
      r.core.setTint(t(r.look));
      r.halo.setTint(t(r.look));
      r.ground.setTint(t(r.look));
      r.barrier?.setTint(t(r.look));
    }

    r.target = on ? 1 : 0;
    r.strength += (r.target - r.strength) * 0.08; // 약 0.5초 페이드

    if (!on && r.strength < 0.01) {
      this.destroy();
      return;
    }

    const s = r.strength;
    const now = this.scene.time.now;
    /* 호흡 — 1.6초 주기 사인파. 0.72~1.0 을 오가 '살아있는 빛'으로 보이게 */
    const breath = 0.86 + 0.14 * Math.sin((now / 1600) * Math.PI * 2);

    r.core.setPosition(x, y - 10);
    r.core.setAlpha(0.42 * s * breath);
    r.core.setScale(0.95 * breath * s + 0.05);
    r.core.setDepth(10.4);

    if (r.halo.visible) {
      r.halo.setPosition(x, y - 18);
      r.halo.setAlpha(0.30 * s * breath);
      r.halo.setScale(0.95 * breath * s + 0.1);
      r.halo.setRotation(now / 5200);
      r.halo.setDepth(10.45);
    }

    r.ground.setPosition(x, y + 8);
    r.ground.setAlpha(0.22 * s);
    r.ground.setScale(1.25 * s + 0.1, (1.25 * s + 0.1) * r.look.groundAspect);
    r.ground.setDepth(5);
    r.ground.setFlipX(flipX);

    /* vc204 (#15) — 직업 고유 베리어. 회전·맥동·스케일이 직업마다 다르다. */
    if (r.barrier) {
      const bp = r.look.barrierPulse;
      const pulse = bp > 0 ? 1 + bp * Math.sin((now / 1280) * Math.PI * 2) : 1;
      const sc = r.look.barrierScale * pulse * (0.55 + 0.45 * s);
      r.barrier.setPosition(x, y - 14);
      r.barrier.setAlpha(0.26 * s * breath);
      r.barrier.setScale(sc);
      if (r.look.barrierSpin > 0) r.barrier.setRotation(now * r.look.barrierSpin);
      r.barrier.setDepth(10.5);
      r.barrier.setFlipX(flipX);
    }
  }

  private build(hex: number, cls: string | null): void {
    const look = (cls && FIFTH_LOOKS[cls]) || fallbackLook(cls);
    /* vc206 (지시 #8) — 아틀라스면 애니메이션으로 재생한다.
     *  종전엔 `gvu_shockwave_fiery`(512×256 = 2프레임), `gvu_trail_wave` 같은
     *  프레임 시트를 add.image 로 1장만 그려 "사진 한 장"으로 보였다. */
    const mk = (tex: string, depth: number) => {
      const anim = ensureAtlasAnim(this.scene, tex, 10);
      const im: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite = anim
        ? this.scene.add.sprite(0, -9999, tex, 0).play(anim.animKey)
        : this.scene.add.image(0, -9999, tex);
      im.setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0);
      if (!this.scene.textures.exists(tex)) im.setVisible(false);
      return im as Phaser.GameObjects.Image;
    };
    const tint = look.tint === 0xffffff ? hex : look.tint;
    this.lastHex = hex;
    this.lastCls = cls;
    const halo = mk(look.halo, 10.45).setTint(tint);
    if (this.lite) halo.setVisible(false); // 저사양: 헤일로 생략
    this.rig = {
      core: mk(look.core, 10.4).setTint(tint),
      halo,
      ground: mk(look.ground, 5).setTint(tint),
      barrier: mk(look.barrier, 10.5).setTint(tint),
      look,
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
    this.rig.barrier?.destroy();
    this.rig = null;
    this.lastHex = -1;
    this.lastCls = null;
  }
}
