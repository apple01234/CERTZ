import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { PetKey } from "../data";
import { PET_DEFS } from "../data";

/**
 * 펫 (v1.9 BM) — 플레이어를 따라다니며 떨어진 드롭을 자동으로 줍는 동반자.
 *  - 플레이어 뒤를 살짝 늦게 쫓아감 (lerp + 사인 부유)
 *  - 근처(140px) 드롭을 향해 자석처럼 이동 → 접촉 시 획득 (골드 보너스는 펫 효과로 적용)
 *  - 펫 교체/해제는 WorldScene.onPetChanged에서 스프라이트만 교체
 */
export class Pet extends Phaser.GameObjects.Image {
  declare scene: WorldScene;
  key: PetKey;

  constructor(scene: WorldScene, key: PetKey, x: number, y: number) {
    super(scene, x, y, PET_DEFS[key].icon);
    this.key = key;
    scene.add.existing(this);
    this.setDepth(11).setScale(1.1);
    // 은은한 부유 모션
    scene.tweens.add({
      targets: this,
      y: y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  /** 매 프레임 — 플레이어 추적 + 가장 가까운 드롭으로 헤엄치기
   *  v2.9 — 맵 전체 드롭 흡입 (사용자 지시 #4): 사거리 제한 삭제, 멀수록 빠르게 수렴 */
  tick(dt: number, px: number, py: number) {
    const t = dt / 1000;
    // 목표: 맵 전체에서 가장 가까운 드롭, 없으면 플레이어 뒤쪽
    const drop = this.scene.nearestDrop(this.x, this.y, 99999);
    let tx = px - 26;
    let ty = py + 6;
    let k = 4.2;
    if (drop) {
      tx = drop.x;
      ty = drop.y;
      const d = Phaser.Math.Distance.Between(this.x, this.y, drop.x, drop.y);
      // v3.0.6 — 아틀라스(3번째 펫)는 맵 전체 드롭을 더 빠르게 흡수
      k = this.key === "pet_atlas" ? (d > 320 ? 22 : 14) : d > 320 ? 14 : 7.5;
    } else if (this.scene.player.flipX) {
      tx = px + 26;
    }
    const step = Math.min(1, t * k);
    this.x += (tx - this.x) * step;
    // 부유 트윈과 충돌하지 않게 y는 부드럽게 보정 (baseY는 트윈이 관리)
    this.y += (ty - this.y) * step * 0.9;
    // 방향 전환 (드롭 쪽을 볼 때만)
    if (drop) this.setFlipX(drop.x < this.x);
  }
}
