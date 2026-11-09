/* =====================================================================
 * vc291 — 보스 러시 (Boss Rush)
 *
 * [무엇인가]
 *  보스를 연속으로 상대하는 모드. 웨이브를 넘길 때마다 인게임 레벨업
 *  (3택1 강화)을 골라 런 도중에 캐릭터가 강해진다. 한 번 죽으면 런 종료.
 *
 * [왜 만들었나]
 *  REA 로 ISEKAI GATE 번들을 분석했을 때 `BossRushModeIngamePlayerLevelUpHandler`
 *  가 확인됐다. 보스 연속전 + 인게임 레벨업 구조인데 SERTZ 에는 `bossRush` 문자열이
 *  0건이었다. 기존 보스 17종과 보상 체계가 이미 있으므로 **아트 제작 없이**
 *  조합만으로 성립하는 콘텐츠다.
 *
 * [설계 원칙 — isekai.ts 와 동일]
 *  이 파일은 **데이터 테이블 + 순수 계산**만 담당한다. Phaser 의존 금지.
 *  실제 상태(현재 웨이브, 남은 HP, 선택한 강화)는 SaveData + 런타임 씬에 둔다.
 *  이렇게 분리해야 테스트가 씬 없이 돌고, 세이브 구조가 흔들리지 않는다.
 *
 * [보상]
 *  기존 재화만 쓴다(에메랄드·골드). 새 재화를 만들지 않는다.
 * ===================================================================== */

import { BOSS_DEFS } from "./stages";

/** 런 난이도 — 기존 BOSS_DIFF 와 같은 축을 쓴다. */
export type BossRushTier = "easy" | "normal" | "hard" | "chaos";

/** 웨이브 정의 — 보스 키 + 배율. 배율은 기존 난이도 위에 한 번 더 곱한다. */
export type BossRushWave = {
  /** stages.ts BOSS_DEFS 의 키 */
  bossKey: string;
  /** 이 웨이브에서 표시할 이름 (스토리 호칭과 분리) */
  label: string;
  /** HP 배율 (1.0 = 원본) */
  hpMul: number;
  /** 공격력 배율 */
  atkMul: number;
  /** 클리어 시 지급 에메랄드 */
  emerald: number;
};

/**
 * 웨이브 편성 — 10 웨이브.
 *
 * [순서 설계]
 *  초반은 느린 근접형(guardian·behemoth)으로 손을 풀고, 중반에 원거리·소환형
 *  (surt·fenrir·skoll), 후반에 서사 보스(harold·scarlet)를 둔다.
 *  hpMul 은 완만히 오르되 6웨이브부터 가파르게 — "여기서부터 아프다"를 체감시킨다.
 *
 * [주의]
 *  bossKey 는 반드시 BOSS_DEFS 에 존재해야 한다.
 *  tests/boss-rush.test.mjs 가 이 불변식을 강제한다(오타로 빈 보스가 나오는 것을 막는다).
 */
export const BOSS_RUSH_WAVES: BossRushWave[] = [
  { bossKey: "guardian",  label: "첫 관문 — 수호자",       hpMul: 0.55, atkMul: 0.55, emerald: 2 },
  { bossKey: "behemoth",  label: "거인의 문",              hpMul: 0.62, atkMul: 0.62, emerald: 3 },
  { bossKey: "abysslord", label: "심연의 부름",            hpMul: 0.70, atkMul: 0.70, emerald: 4 },
  { bossKey: "nidhog",    label: "니드호그",               hpMul: 0.80, atkMul: 0.78, emerald: 5 },
  { bossKey: "surt",      label: "불의 시련",              hpMul: 0.90, atkMul: 0.86, emerald: 6 },
  { bossKey: "fenrir",    label: "굶주린 사냥 — 펜리르",   hpMul: 1.10, atkMul: 1.00, emerald: 8 },
  { bossKey: "skoll",     label: "달을 쫓는 — 스콜",       hpMul: 1.20, atkMul: 1.08, emerald: 9 },
  { bossKey: "gram",      label: "가름의 칼날",            hpMul: 1.32, atkMul: 1.16, emerald: 10 },
  { bossKey: "harold",    label: "해롤드",                 hpMul: 1.45, atkMul: 1.24, emerald: 12 },
  { bossKey: "scarlet",   label: "어둠의 군주 스칼렛",     hpMul: 1.65, atkMul: 1.35, emerald: 15 },
];

/* ─────────────── 인게임 레벨업 (3택1) ─────────────── */

/** 강화 효과 종류. 수치는 런 한정이며 세이브에 스탯으로 굳지 않는다. */
export type RushUpgradeKind =
  | "atk"      // 공격력 +%
  | "maxHp"    // 최대 HP +%
  | "heal"     // 즉시 회복 (%)
  | "speed"    // 이동속도 +%
  | "crit"     // 치명타 확률 +%p
  | "cooldown"; // 쿨다운 감소 %

export type RushUpgrade = {
  key: string;
  kind: RushUpgradeKind;
  /** 한글 이름 — UI 에 그대로 노출 */
  name: string;
  /** 한 줄 설명 */
  desc: string;
  /** 효과 크기. kind 에 따라 단위가 다르다(% 또는 %p). */
  amount: number;
};

/**
 * 강화 풀.
 *
 * [왜 고정 풀인가]
 *  무작위 3택1 이므로 **풀이 좁으면 매 런이 같아진다.** 6종을 두루 제공해
 *  "이번 런은 공격형, 저번 런은 생존형" 이 갈리게 한다.
 *  ponytail: 종류를 더 늘리려면 이 배열에만 추가한다. UI 는 length 를 읽는다.
 */
export const RUSH_UPGRADES: RushUpgrade[] = [
  { key: "atk_s",    kind: "atk",      name: "예리한 칼날",   desc: "공격력 +12%",           amount: 12 },
  { key: "atk_l",    kind: "atk",      name: "분쇄",          desc: "공격력 +22%",           amount: 22 },
  { key: "hp_s",     kind: "maxHp",    name: "강인한 육체",   desc: "최대 HP +15%",          amount: 15 },
  { key: "heal",     kind: "heal",     name: "응급 처치",     desc: "즉시 HP 40% 회복",      amount: 40 },
  { key: "spd",      kind: "speed",    name: "가벼운 발놀림", desc: "이동속도 +10%",         amount: 10 },
  { key: "crit",     kind: "crit",     name: "급소 간파",     desc: "치명타 확률 +8%p",      amount: 8 },
  { key: "cdr",      kind: "cooldown", name: "빠른 손놀림",   desc: "쿨다운 -8%",            amount: 8 },
];

/** 런 도중 누적되는 강화 배율 (세이브에 저장하지 않는다 — 런 종료 시 소멸). */
export type RushBuff = {
  atkPct: number;
  maxHpPct: number;
  speedPct: number;
  critPct: number;
  cdrPct: number;
};

export const EMPTY_BUFF: RushBuff = { atkPct: 0, maxHpPct: 0, speedPct: 0, critPct: 0, cdrPct: 0 };

/**
 * 강화를 버프에 적용한다. **원본을 변형하지 않고 새 객체를 돌려준다** —
 * 리렌더 판정이 참조 비교로 이뤄지는 UI에서 제자리 변형은 갱신 누락을 만든다.
 */
export function applyUpgrade(buff: RushBuff, up: RushUpgrade): RushBuff {
  const next = { ...buff };
  switch (up.kind) {
    case "atk":      next.atkPct    += up.amount; break;
    case "maxHp":    next.maxHpPct  += up.amount; break;
    case "speed":    next.speedPct  += up.amount; break;
    case "crit":     next.critPct   += up.amount; break;
    case "cooldown": next.cdrPct    += up.amount; break;
    case "heal":     /* heal 은 즉시 회복이라 지속 버프에 누적되지 않는다 */ break;
  }
  return next;
}

/**
 * 3택1 선택지를 뽑는다.
 *
 * [결정성]
 *  시드를 받아 **같은 시드면 같은 선택지**가 나오게 한다. 테스트가 가능해지고,
 *  "리롤 어뷰징"도 막힌다(시드는 런 시작 시 한 번 고정).
 *  시드�� 없으면 Math.random 을 쓰되, 그 경우 테스트는 분포만 확인한다.
 */
export function rollUpgradeChoices(seed: number | null, count = 3): RushUpgrade[] {
  const pool = [...RUSH_UPGRADES];
  const picked: RushUpgrade[] = [];
  /* 간단한 LCG — 외부 의존 없이 결정적 난수를 만든다. */
  let s = seed == null ? Math.floor(Math.random() * 0x7fffffff) : seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const want = Math.max(1, Math.min(count, pool.length));
  for (let i = 0; i < want; i++) {
    const idx = Math.floor(rnd() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/* ─────────────── 웨이브 진행 / 정산 ─────────────── */

/** 런 진행 상태. 씬이 아니라 데이터로 두어 세이브·테스트가 쉽게 한다. */
export type RushRun = {
  /** 현재 웨이브 인덱스 (0-based). BOSS_RUSH_WAVES 길이와 같아지면 클리어. */
  wave: number;
  /** 누적 에메랄드 */
  emerald: number;
  /** 죽었는지 */
  dead: boolean;
  /** 런 시드 — 강화 선택지 결정에 쓴다 */
  seed: number;
};

export function newRun(seed: number): RushRun {
  return { wave: 0, emerald: 0, dead: false, seed: seed >>> 0 };
}

/** 현재 웨이브 정의. 범위를 벗어나면 null (클리어 상태). */
export function currentWave(run: RushRun): BossRushWave | null {
  return BOSS_RUSH_WAVES[run.wave] ?? null;
}

/** 전 웨이브를 클리어했는가. */
export function isCleared(run: RushRun): boolean {
  return !run.dead && run.wave >= BOSS_RUSH_WAVES.length;
}

/**
 * 웨이브 클리어를 반영한다. **새 런 객체를 돌려준다.**
 * 클리어 후 남은 웨이브가 있으면 다음 인덱스로, 없으면 wave 가 길이와 같아진다.
 */
export function clearWave(run: RushRun): RushRun {
  const w = currentWave(run);
  if (!w || run.dead) return run;
  return { ...run, wave: run.wave + 1, emerald: run.emerald + w.emerald };
}

/** 런 종료(사망). 이미 죽었으면 그대로 둔다 — 중복 정산 방지. */
export function killRun(run: RushRun): RushRun {
  if (run.dead) return run;
  return { ...run, dead: true };
}

/**
 * 난이도 배율을 웨이브 배율에 곱한다.
 *
 * [왜 곱하나]
 *  BOSS_DIFF 는 이미 게임 전체 난이도다. 보스 러시는 그 위에 런 자체의 난이도를
 *  한 번 더 얹는다(웨이브마다 hpMul 이 오르는 구조). 두 축을 곱해야
 *  "이지 러시 10웨이브" 와 "카오스 러시 1웨이브" 가 서로 다른 체감을 준다.
 */
export function scaledStats(wave: BossRushWave, tierMul: { hp: number; atk: number }) {
  return {
    hpMul: wave.hpMul * tierMul.hp,
    atkMul: wave.atkMul * tierMul.atk,
  };
}

/** 보스 키가 실제로 존재하는지 (테스트·런타임 가드 공용). */
export function isValidBossKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BOSS_DEFS, key);
}

/** 최고 기록 저장 형태. 세이브에는 이 형태만 들어간다. */
export type RushBest = {
  /** 도달한 최고 웨이브 (클리어 수) */
  bestWave: number;
  /** 완주 횟수 */
  clears: number;
  /** 누적 획득 에메랄드 (표시용) */
  totalEmerald: number;
};

export const EMPTY_BEST: RushBest = { bestWave: 0, clears: 0, totalEmerald: 0 };

/**
 * 런 종료 시 최고 기록을 갱신한다. **단조 증가만 허용** —
 * 이상한 값이 들어와도 기록이 줄어들지 않는다.
 */
export function mergeBest(best: RushBest, run: RushRun): RushBest {
  const cleared = run.wave;
  const wasClear = isCleared(run);
  return {
    bestWave: Math.max(best.bestWave, cleared),
    clears: best.clears + (wasClear && !run.dead ? 1 : 0),
    totalEmerald: best.totalEmerald + Math.max(0, run.emerald),
  };
}
