import Phaser from "phaser";

/**
 * 애니메이션 등록 전용 모듈.
 * 그래픽 자체는 모두 외부 에셋(public/assets/) — 캔버스 절차 생성 코드는 전면 제거되었다.
 *  - 참격: Weapon Slash - Effect by Cethiel (CC0) 6프레임
 *  - 차원문: Animated Portal by varkalandar (CC-BY 4.0) 8프레임
 *  - 이외 캐릭터/몬스터/이펙트: ArMM1998/Kenney/LPC/Sotrak (CREDITS.md 참조)
 */

/** 전역 애니메이션 등록 (최초 1회) — 실제 에셋 시트 프레임 기반 */
export function buildAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  if (a.exists("hero-idle")) return;
  const fr = (prefix: string, n: number, rate: number, repeat: number) => ({
    frames: Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}` })),
    frameRate: rate,
    repeat,
  });
  // 주인공 (방향별 실제 스윙 프레임)
  a.create({ key: "hero-idle", ...fr("hero_idle", 4, 4, -1) });
  a.create({ key: "hero-walk", ...fr("hero_walk", 4, 9, -1) }); // 아래
  a.create({ key: "hero-walk-up", ...fr("hero_walkup", 4, 9, -1) });
  a.create({ key: "hero-walk-side", ...fr("hero_walkside", 4, 9, -1) }); // 오른쪽 기준(좌는 flipX)
  a.create({ key: "hero-atk", ...fr("hero_atk", 4, 16, 0) }); // 측면(오른쪽)
  a.create({ key: "hero-atk-down", ...fr("hero_atkdown", 4, 16, 0) });
  a.create({ key: "hero-atk-up", ...fr("hero_atkup", 4, 16, 0) });
  // 몬스터
  a.create({ key: "wolf-idle", ...fr("wolf_idle", 2, 2, -1) });
  a.create({ key: "wolf-run", ...fr("wolf_run", 4, 10, -1) });
  a.create({ key: "minion-idle", ...fr("minion_idle", 2, 3, -1) });
  a.create({ key: "minion-run", ...fr("minion_run", 4, 8, -1) });
  a.create({ key: "boss-idle", ...fr("boss_idle", 2, 2, -1) });
  // VFX — 참격 초승달 스윕(외부 애니), 차원문 소용돌이
  a.create({ key: "fx-slash", ...fr("slash", 6, 30, 0) });
  a.create({ key: "portal-spin", ...fr("portal", 8, 10, -1) });
  // 장식 이펙트
  a.create({ key: "flame-burn", ...fr("flame", 4, 8, -1) });
  a.create({ key: "sparkle", ...fr("sparkle", 2, 3, -1) });
}
