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
  // 스토리 확장 몬스터 (동굴/니플헤임/심연)
  a.create({ key: "spider-idle", ...fr("spider_idle", 2, 3, -1) });
  a.create({ key: "spider-run", ...fr("spider_run", 4, 9, -1) });
  a.create({ key: "golem-idle", ...fr("golem_idle", 2, 2, -1) });
  a.create({ key: "golem-run", ...fr("golem_run", 4, 6, -1) });
  a.create({ key: "frostwolf-idle", ...fr("frostwolf_idle", 2, 2, -1) });
  a.create({ key: "frostwolf-run", ...fr("frostwolf_run", 4, 10, -1) });
  a.create({ key: "icegolem-idle", ...fr("icegolem_idle", 2, 2, -1) });
  a.create({ key: "icegolem-run", ...fr("icegolem_run", 4, 6, -1) });
  a.create({ key: "wraith-idle", ...fr("wraith_idle", 2, 3, -1) });
  a.create({ key: "wraith-run", ...fr("wraith_run", 4, 7, -1) });
  // 보스 3종 (guardian / behemoth / abysslord)
  a.create({ key: "boss-idle", ...fr("boss_idle", 2, 2, -1) });
  a.create({ key: "boss2-idle", ...fr("boss2_idle", 2, 2, -1) });
  a.create({ key: "boss3-idle", ...fr("boss3_idle", 2, 2, -1) });
  // v2.0 아뜰란티스 확장 몬스터 (v1.5 이관)
  a.create({ key: "swampbeast-idle", ...fr("swampbeast_idle", 2, 2, -1) });
  a.create({ key: "swampbeast-run", ...fr("swampbeast_run", 4, 7, -1) });
  a.create({ key: "emberwolf-idle", ...fr("emberwolf_idle", 2, 2, -1) });
  a.create({ key: "emberwolf-run", ...fr("emberwolf_run", 4, 10, -1) });
  a.create({ key: "firespirit-idle", ...fr("firespirit_idle", 2, 3, -1) });
  a.create({ key: "firespirit-run", ...fr("firespirit_run", 4, 8, -1) });
  a.create({ key: "runegolem-idle", ...fr("runegolem_idle", 2, 2, -1) });
  a.create({ key: "runegolem-run", ...fr("runegolem_run", 4, 6, -1) });
  a.create({ key: "helhound-idle", ...fr("helhound_idle", 2, 2, -1) });
  a.create({ key: "helhound-run", ...fr("helhound_run", 4, 10, -1) });
  // v2.0 아뜰란티스 신규 보스
  a.create({ key: "boss_nidhog-idle", ...fr("boss_nidhog_idle", 2, 2, -1) });
  a.create({ key: "boss_surt-idle", ...fr("boss_surt_idle", 2, 2, -1) });
  a.create({ key: "boss_fenrir-idle", ...fr("boss_fenrir_idle", 2, 2, -1) });
  a.create({ key: "boss_skoll-idle", ...fr("boss_skoll_idle", 2, 2, -1) });
  a.create({ key: "boss_gram-idle", ...fr("boss_gram_idle", 2, 2, -1) });
  a.create({ key: "boss_abudditos-idle", ...fr("boss_abudditos_idle", 2, 2, -1) });
  // 배치1 — 마을 모닥불 (Serene_Village campfire 32x32 4프레임)
  a.create({
    key: "sv-campfire",
    frames: [0, 1, 2, 3].map((f) => ({ key: "sv_campfire", frame: f })),
    frameRate: 6,
    repeat: -1,
  });
  // VFX — 참격 초승달 스윕(외부 애니), 차원문 소용돌이
  a.create({ key: "fx-slash", ...fr("slash", 6, 30, 0) });
  a.create({ key: "portal-spin", ...fr("portal", 8, 10, -1) });
  // 장식 이펙트
  a.create({ key: "flame-burn", ...fr("flame", 4, 8, -1) });
  a.create({ key: "sparkle", ...fr("sparkle", 2, 3, -1) });
}
