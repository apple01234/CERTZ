import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { ItemKey } from "../data";

/**
 * 드롭 아이템 (2D MMORPG 기본 요소)
 *  - 골드 코인 / HP·MP 물약이 몬스터 사망 지점에 튕겨 나오고
 *  - 플레이어가 가까이 가면 자석처럼 끌려와 접촉 시 획득 (라그나로크/메이플류 픽업 감각)
 */
export type DropKind = "gold" | ItemKey;

export class Drop extends Phaser.Physics.Arcade.Image {
  declare scene: WorldScene;
  kind: DropKind = "gold";
  amount = 1;

  private bornAt = 0;

  constructor(scene: WorldScene, x: number, y: number) {
    super(scene, x, y, "item_coin");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(10, 6, 6);
    body.setBounce(0.45, 0.45);
    body.setDrag(0.0001, 0.0001);
    body.setCollideWorldBounds(true);
  }

  /** 풀 재사용 초기화 — 사망 지점에서 튕겨 나감 */
  spawn(kind: DropKind, x: number, y: number, amount: number) {
    this.kind = kind;
    this.amount = amount;
    this.setTexture(
      kind === "gold" ? "item_coin" : kind === "potion_hp" ? "item_potion_hp" : "item_potion_mp"
    );
    this.setPosition(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-6, 2));
    this.setScale(kind === "gold" ? 0.72 : 0.9);
    this.setActive(true).setVisible(true).setAlpha(1);
    this.bornAt = this.scene.time.now;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const a = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
    body.reset(this.x, this.y);
    body.setVelocity(Math.cos(a) * 130, Math.sin(a) * 130 - 90);
    // 은은한 빛 — 코인은 금빛, 물약은 원색 유지
    this.clearTint();
  }

  /** 씬 update에서 호출 — 자석 + 픽업 */
  tick(dt: number, px: number, py: number) {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    const age = this.scene.time.now - this.bornAt;

    // 튕긴 직후(250ms)는 자석 무시 — 자연스러운 흩어짐
    if (age > 250 && d < 120) {
      const pull = d < 34 ? 560 : 260;
      const a = Phaser.Math.Angle.Between(this.x, this.y, px, py);
      body.setVelocity(Math.cos(a) * pull, Math.sin(a) * pull);
    } else {
      // 마찰 감쇠
      const f = Math.pow(0.02, dt / 1000);
      body.setVelocity(body.velocity.x * f, body.velocity.y * f);
    }

    if (age > 200 && d < 30) {
      this.scene.collectDrop(this.kind, this.amount, this.x, this.y);
      this.release();
    }
  }

  release() {
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).reset(0, -9999);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}
