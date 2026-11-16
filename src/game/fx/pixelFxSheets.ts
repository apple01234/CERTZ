/** Existing admitted FX sheets; do not fetch unadmitted giant variants on demand. */
export const PIXELFX_SHEETS = [
  "arcane-orb", "big-explosion", "bleeding", "blink-in", "blunt-hit", "bullet-impact",
  "claw-swipe", "coin-spin", "collect-burst", "crit-hit", "crystal-shard", "dissolve-burn",
  "divine-shield", "fireball", "frozen", "gem-spin", "hammer-smash", "haste", "heal",
  "healing-bloom", "hit-spark", "ice-spikes", "impact-frame", "implosion", "leaf-storm",
  "level-up", "pixel-dissolve", "poisoned", "poof", "portal", "quest-complete", "rage",
  "resurrection", "shadow-flames", "shatter-death", "shield-block", "smite", "soul-rise",
  "spawn-portal", "spin-slash", "splash", "summon-rise", "sunburst", "sword-slash", "zap-hit",
  /* vc289 — 2026-11-09 Drive 배급 "FX Pack 1" 8종 (128px 24f).
   *  tools/import_drive_20261109.py 가 원본 시트를 CERTZ pixelfx 스키마로 변환했다. */
  "storm", "shockwave-big", "plasma", "energy-crack",
  "pentagram", "implosion-drive", "orbit-rings", "sparks-glow",
];
export const ADMITTED_PIXELFX = new Set(PIXELFX_SHEETS);
/** WeaponMasterCombat uses these synchronously, including after an in-place class change. */
export const SIGNATURE_PIXELFX = ["sunburst", "healing-bloom", "zap-hit", "arcane-orb", "divine-shield", "heal", "shadow-flames", "splash", "hammer-smash"];
