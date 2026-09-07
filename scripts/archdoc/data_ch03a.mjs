// 모듈 3 (021~025): 캐릭터 및 성장 시스템 — 전반부
// 스택: PostgreSQL DDL, Kysely, TypeScript Seed 스크립트, TypeScript

export const items = [
  {
    id: "021",
    title: "주/보조 스탯 계산 및 최종 수치 연산 시스템",
    role: [
      "캐릭터의 최종 스탯은 기본치(레벨/클래스), 장비, 버프, 패시브(칭호/도감), 특성 투자 등 다수 소스의 합성이다. 이 시스템은 모든 소스를 동일한 StatMod 구조(flat/add + percent/mul)로 정규화하고, 순서를 고정한 합산 파이프라인(기본치 → 장비 flat → 패시브 flat → 전체 % → 상한 클램프)으로 최종값을 산출한다. 계산은 순수 함수로 만들어 서버(판정)와 클라(UI 표시)가 동일 결과를 보장한다.",
      "성능을 위해 스탯 변경 이벤트(장비 착용, 레벨업, 버프 적용)가 발생할 때만 재계산하는 더티 플래그 방식을 쓰고, 결과를 캐릭터 캐시에 저장한다. 합산 순서가 중요한 이유는 곱연산의 교환 법칙이 소수점 환경에서 성립하지 않기 때문이며, 서버/클라 동일 순서 강제는 결정론의 전제다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE characters (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT      NOT NULL,
  name          VARCHAR(20) NOT NULL UNIQUE,
  class_code    VARCHAR(20) NOT NULL,
  level         INT         NOT NULL DEFAULT 1,
  exp           BIGINT      NOT NULL DEFAULT 0,
  base_str      INT NOT NULL DEFAULT 5,   -- 기본 주 스탯(성장으로 증가)
  base_dex      INT NOT NULL DEFAULT 5,
  base_int      INT NOT NULL DEFAULT 5,
  base_vit      INT NOT NULL DEFAULT 5,
  stat_points   INT NOT NULL DEFAULT 0,   -- 자유 분배 포인트
  allocated     JSONB NOT NULL DEFAULT '{}', -- {"str":3,"vit":2}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 장비(착용 상태 포함) — 024번과 연결
CREATE TABLE character_items (
  id            BIGSERIAL PRIMARY KEY,
  character_id  BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_code     VARCHAR(40) NOT NULL,
  slot          VARCHAR(16),              -- NULL = 인벤토리, 착용 시 부위
  enhance       SMALLINT NOT NULL DEFAULT 0,
  mods          JSONB NOT NULL DEFAULT '[]',  -- [{stat:"atk", flat:12}, ...]
  version       INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_citems_char_slot ON character_items(character_id, slot);

-- 스탯 최종 캐시(재계산 결과 저장 — 조회 최적화)
CREATE TABLE character_stats_cache (
  character_id  BIGINT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  final         JSONB NOT NULL,           -- {"atk":120.5, "hp":3200, ...}
  dirty         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      },
      {
        lang: "src/game/StatMath.ts — 순수 스탯 연산",
        code: `export type StatKey =
  | "str" | "dex" | "int" | "vit"     // 1차
  | "atk" | "matk" | "def" | "hp" | "mp" | "crit" | "aspd";  // 2차

export interface StatMod {
  stat: StatKey;
  flat?: number;        // 가산
  mul?: number;         // 승산(0.1 = +10%)
}

export interface StatSource {
  kind: "base" | "equip" | "passive" | "buff";
  mods: StatMod[];
}

/** 합산 순서 고정: base flat → equip flat → passive flat → 전체 mul → 클램프 */
export function computeFinal(base: Record<string, number>, sources: StatSource[]): Record<string, number> {
  const flat: Record<string, number> = { ...base };
  let mulAll: Record<string, number> = {};

  for (const src of sources) {
    for (const m of src.mods) {
      if (m.flat) flat[m.stat] = (flat[m.stat] ?? 0) + m.flat;
      if (m.mul)  mulAll[m.stat] = (mulAll[m.stat] ?? 0) + m.mul;
    }
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(flat)) {
    const mul = 1 + (mulAll[k] ?? 0);
    out[k] = Math.max(0, Math.round(flat[k] * mul * 100) / 100);
  }
  return out;
}

/** 2차 스탯 도출(1차 → 2차 변환 공식도 여기서 관리) */
export function deriveSecondaries(primary: Record<string, number>): Record<string, number> {
  return {
    atk:  Math.round(primary.str * 2.2 + primary.dex * 0.6),
    matk: Math.round(primary.int * 2.4),
    def:  Math.round(primary.vit * 1.8),
    hp:   Math.round(80 + primary.vit * 22 + primary.str * 4),
    mp:   Math.round(40 + primary.int * 15),
    crit: Math.min(50, Math.round(primary.dex * 0.25)),      // % 상한 50
    aspd: Math.min(190, 100 + Math.round(primary.dex * 0.4)), // % 상한 190
    ...primary,
  };
}

/** 더티 플래그 재계산 훅 — 장비/버프/레벨 변화 시 호출 */
export function recompute(
  char: { level: number; base: Record<string, number>; allocated: Record<string, number> },
  sources: StatSource[],
): Record<string, number> {
  const base = { ...char.base };
  for (const [k, v] of Object.entries(char.allocated)) base[k] = (base[k] ?? 0) + (v as number);
  const lvlBonus = { str: char.level * 0.4, dex: char.level * 0.4,
                     int: char.level * 0.4, vit: char.level * 0.5 };
  for (const [k, v] of Object.entries(lvlBonus)) base[k] = (base[k] ?? 0) + v;
  return deriveSecondaries(computeFinal(base, sources));
}`,
      },
    ],
    tips: [
      "합산 순서를 절대 바꾸지 마라 — 'flat 먼저, mul 나중'이 산수상 이득이 아니라 '결정론'의 문제다.",
      "2차 스탯 상한(crit 50% 등)은 deriveSecondaries 한 곳에서만 관리해야 기획 변경 시 한 줄 수정으로 끝난다.",
      "스탯 캐시 테이블의 dirty 플래그는 로그아웃 시 저장, 접속 시 1회 재계산 정책과 결합하면 DB 쓰기를 크게 줄인다.",
      "클라 UI는 서버 산출값을 표시만 하고 자체 계산하지 않는다 — 양쪽 계산은 반드시 공유 코드(이 파일) 하나로.",
    ],
  },
  {
    id: "022",
    title: "레벨별 요구 경험치 곡선 및 스탯 상승 공식",
    role: [
      "경험치 곡선은 게임 페이스의 뼈대다. 이 시스템은 닫힌 형태의 공식(예: next = floor(60 * L^2.4 + 120 * L))으로 레벨별 요구치를 계산하되, 기획 튜닝을 위해 구간별 보정 계수 테이블(exp_curve 세그먼트)을 DB에 둔다. 스탯 상승은 레벨당 자동 증가분 + 자유 분배 포인트 두 트랙으로 나누고, 성장 곡선 지수(level curve)는 클래스별로 다르게 둔다.",
      "레벨업은 서버에서만 승인한다. 클라가 exp 증가를 보고하면 서버는 사냥 판정 히스토리로 검증(016번 철학의 확장)하고, 레벨업이 확정되면 스탯 재계산(021번), 신규 스킬 개방(026번), 이펙트 알림을 하나의 트랜잭션으로 처리한다. exp 손실 없는 안전장치로, 레벨업 직전 오버플로 exp는 누적해 다음 레벨 요구치에 이월한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE exp_curve (
  min_level   INT NOT NULL,
  max_level   INT NOT NULL,
  formula     VARCHAR(40) NOT NULL,     -- 'poly24' | 'poly30' | 'linear'
  k           NUMERIC(10,4) NOT NULL,   -- 계수
  stat_point  INT NOT NULL DEFAULT 3,   -- 레벨당 자유 포인트
  PRIMARY KEY (min_level)
);
INSERT INTO exp_curve (min_level, max_level, formula, k, stat_point) VALUES
  (1,  30,  'poly24',  60, 5),    -- 초반: 60*L^2.4 — 빠른 성장 체감
  (31, 70,  'poly27',  45, 3),    -- 중반: 45*L^2.7
  (71, 99,  'poly30',  30, 2);    -- 후반: 30*L^3.0 — 장기 목표

CREATE TABLE class_growth (
  class_code  VARCHAR(20) PRIMARY KEY,
  curve       JSONB NOT NULL       -- 클래스별 레벨 성장 지수
              -- {"str":0.35,"dex":0.35,"int":0.35,"vit":0.5}
);`,
      },
      {
        lang: "src/game/Growth.ts — 경험치 곡선·스탯 상승 연산",
        code: `export interface CurveRow { min_level: number; max_level: number; formula: string; k: number; stat_point: number; }

/** 세그먼트 공식 평가 — 서버 부팅 시 전체 테이블을 메모리에 올려 사용 */
export function expForLevel(level: number, curve: CurveRow[]): number {
  const row = curve.find(c => level >= c.min_level && level <= c.max_level)
             ?? curve[curve.length - 1];
  switch (row.formula) {
    case "poly24": return Math.floor(row.k * Math.pow(level, 2.4) + 120 * level);
    case "poly27": return Math.floor(row.k * Math.pow(level, 2.7) + 200 * level);
    case "poly30": return Math.floor(row.k * Math.pow(level, 3.0) + 300 * level);
    default:       return Math.floor(row.k * level * 100);
  }
}

/** 누적 exp → (레벨, 남은 exp) 변환 — 세이브는 누적 exp만 저장하는 형태 권장 */
export function levelFromTotalExp(total: number, curve: CurveRow[], maxLevel = 99) {
  let level = 1, rest = total;
  while (level < maxLevel) {
    const need = expForLevel(level, curve);
    if (rest < need) break;
    rest -= need; level++;
  }
  return { level, rest, statPoint: level * (curve.find(c => c.min_level <= level)!.stat_point) };
}

/** 레벨업 확정 트랜잭션(서버) */
import { Kysely } from "kysely";
type DB = import("./schema").Database;
export async function applyExp(db: Kysely<DB>, charId: number, gain: number, curve: CurveRow[]) {
  return db.transaction().execute(async tx => {
    const ch = await tx.selectFrom("characters").where("id", "=", charId)
      .select(["level", "exp", "stat_points"]).forUpdate().executeTakeFirstOrThrow();
    const total = Number(ch.exp) + gain;
    const next = levelFromTotalExp(total, curve);
    await tx.updateTable("characters").set({
      level: next.level,
      exp: total,
      stat_points: ch.stat_points + (next.level - ch.level) * 5,
    }).where("id", "=", charId).execute();
    return { leveledUp: next.level > ch.level, level: next.level };
  });
}`,
      },
    ],
    tips: [
      "요구치 공식은 지수 2.4~3.0 구간이 MMORPG 표준 밴드다 — 2.4 미만은 콘텐츠 소모가 빠르고 3.0 초과는 후반 이탈률이 급증한다.",
      "세이브는 '레벨+구간 내 exp'보다 '누적 exp' 단일 값이 안전하다 — 곡선 리밸런싱에도 유저 자산이 보존된다.",
      "레벨업 보너스(포인트 5개 등)는 곡선 세그먼트별로 다르게 두면 구간 페이스 조절이 쉬워진다.",
      "exp 게인은 서버가 몬스터 처치 판정과 함께만 승인하고 클라 보고 수치를 그대로 더하지 않는다.",
    ],
  },
  {
    id: "023",
    title: "스킬 트리 & 특성 포인트 투자/초기화 데이터 구조",
    role: [
      "스킬 트리는 '노드(스킬) + 간선(선행 스킬 요구)'의 DAG이며, 각 노드는 최대 투자 레벨과 레벨별 효과 공식을 가진다. 데이터 구조는 세 계층으로 나뉜다. skill_def(스킬 정의), skill_node(트리 배치·선행 요구), character_skill(투자 상태). 투자는 포인트 소비 트랜잭션으로, 선행 노드 요구 레벨 검증을 서버가 항상 수행한다 — 클라 UI는 미리보기일 뿐이다.",
      "초기화(리스펙)는 유료/무료 정책에 따라 소모 재화를 결정하고, 투자 기록 전체를 한 번에 리셋하되 '환급 포인트'를 정확히 합산해 돌려준다. 리스펙은 남용되면 경제 지표가 흔들리므로 주 1회 무료 + 유료 아이템 정책을 서버 규칙으로 강제한다. 트리 구조는 프론트에서 렌더링 가능하도록 x/y 좌표와 프리뷰 아이콘을 정의에 포함한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE skill_def (
  code         VARCHAR(40) PRIMARY KEY,
  name         VARCHAR(40) NOT NULL,
  class_code   VARCHAR(20) NOT NULL,
  max_rank     SMALLINT NOT NULL DEFAULT 10,
  type         VARCHAR(12) NOT NULL,     -- active | passive | ultimate
  cooldown_ms  INT NOT NULL DEFAULT 0,
  cost_mp      INT NOT NULL DEFAULT 0,
  rank_formula JSONB NOT NULL            -- 랭크별 효과: {"dmg": "0.5+0.12*r", ...}
);

CREATE TABLE skill_node (
  skill_code   VARCHAR(40) REFERENCES skill_def(code) ON DELETE CASCADE,
  tier         SMALLINT NOT NULL,        -- 트리 단계(가로 배치)
  pos_x        SMALLINT NOT NULL, pos_y  SMALLINT NOT NULL,  -- UI 좌표
  requires     JSONB NOT NULL DEFAULT '[]',  -- [{"code":"s001","rank":5}]
  PRIMARY KEY (skill_code)
);

CREATE TABLE character_skill (
  character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_code   VARCHAR(40) NOT NULL REFERENCES skill_def(code),
  rank         SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, skill_code)
);

CREATE TABLE respec_log (
  id           BIGSERIAL PRIMARY KEY,
  character_id BIGINT NOT NULL,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded     INT NOT NULL,
  cost_kind    VARCHAR(20) NOT NULL      -- free_weekly | cash | gold
);`,
      },
      {
        lang: "server/skill/tree.ts — 투자/초기화 연산",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export class TreeError extends Error {
  constructor(code: "NO_POINT" | "PREREQ" | "MAX_RANK" | "LOCKED_CLASS") { super(code); }
}

export async function investSkill(
  db: Kysely<DB>, charId: number, skillCode: string, treeDefs: Map<string, {max_rank:number; requires:{code:string;rank:number}[]}>,
) {
  return db.transaction().execute(async tx => {
    const ch = await tx.selectFrom("characters").where("id", "=", charId)
      .select(["stat_points", "class_code"]).forUpdate().executeTakeFirstOrThrow();
    const def = treeDefs.get(skillCode);
    if (!def) throw new TreeError("LOCKED_CLASS");

    // 선행 요구 검증
    for (const req of def.requires) {
      const have = await tx.selectFrom("character_skill")
        .where("character_id", "=", charId).where("skill_code", "=", req.code)
        .select("rank").executeTakeFirst();
      if (!have || have.rank < req.rank) throw new TreeError("PREREQ");
    }

    const cur = await tx.selectFrom("character_skill")
      .where("character_id", "=", charId).where("skill_code", "=", skillCode)
      .select("rank").executeTakeFirst();
    const nextRank = (cur?.rank ?? 0) + 1;
    if (nextRank > def.max_rank) throw new TreeError("MAX_RANK");
    if (ch.stat_points < 1) throw new TreeError("NO_POINT");

    await tx.updateTable("characters").set(eb => ({ stat_points: eb("stat_points", "-", 1) }))
      .where("id", "=", charId).execute();
    await tx.insertInto("character_skill").values({ character_id: charId, skill_code: skillCode, rank: nextRank })
      .onConflict(oc => oc.doUpdate().set({ rank: nextRank })).execute();
    return nextRank;
  });
}

/** 리스펙: 전체 환급 + 정책 비용 */
export async function respec(
  db: Kysely<DB>, charId: number, freeAllowed: boolean, costGold: number,
) {
  return db.transaction().execute(async tx => {
    const invested = await tx.selectFrom("character_skill")
      .where("character_id", "=", charId).select(["skill_code", "rank"]).execute();
    const refund = invested.reduce((s, r) => s + r.rank, 0);
    if (!freeAllowed) {
      await tx.updateTable("characters")
        .set(eb => ({ gold: sql\`gold - \${costGold}\` }))
        .where("id", "=", charId).where("gold", ">=", costGold).executeTakeFirst();
    }
    await tx.deleteFrom("character_skill").where("character_id", "=", charId).execute();
    await tx.updateTable("characters").set(eb => ({ stat_points: eb("stat_points", "+", refund) }))
      .where("id", "=", charId).execute();
    await tx.insertInto("respec_log").values({
      character_id: charId, refunded: refund, cost_kind: freeAllowed ? "free_weekly" : "gold",
    }).execute();
    return refund;
  });
}`,
      },
    ],
    tips: [
      "선행 요구 검증은 반드시 서버 트랜잭션 안에서 — 클라 UI 우회(패킷 위조)의 가장 흔한 표적이다.",
      "rank_formula는 문자열 수식 대신 {base, perRank, cap} 구조가 안전하다 — 수식 파서는 튜닝 비용보다 버그 비용이 크다.",
      "리스펙 무료 주기는 '주 1회 접속 기준'으로 리셋해 유저가 부담 없이 실험하게 만들면 빌드 다양성이 커진다.",
      "트리 UI 좌표(pos_x/pos_y)를 DB에 두면 기획이 데이터만으로 트리 배치를 조정할 수 있다.",
    ],
  },
  {
    id: "024",
    title: "장비 부위별 착용 슬롯 인벤토리 메커니즘",
    role: [
      "인벤토리는 '가방(칸 기반 목록)'과 '장착 슬롯(부위별 1개씩)'의 이중 구조다. 부위는 weapon/helmet/armor/gloves/boots/necklace/ring1/ring2 등으로 정의하며, ring처럼 복수 슬롯은 슬롯 코드로 구분한다. 착용은 트랜잭션으로 (1) 슬롯 점유 확인, (2) 기존 장비 탈착, (3) 새 장비 착용, (4) 스탯 캐시 더티 마킹을 한 번에 수행한다.",
      "아이템 행(item row)은 항상 하나의 위치 소속만 갖도록 설계한다(인벤토리 슬롯 번호 또는 장비 부위). 중복 소유, 유령 아이템, 복제 버그의 상당수가 '하나의 아이템이 두 위치에 존재'하는 상태에서 발생하므로, 위치 칼럼을 단일 진실로 두고 이동은 항상 UPDATE 한 문장으로 표현한다. 파티 트레이드/우편 이동도 같은 위치 칼럼을 공유해 데이터 흐름이 단일하다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE item_def (
  code         VARCHAR(40) PRIMARY KEY,
  name         VARCHAR(40) NOT NULL,
  category     VARCHAR(16) NOT NULL,      -- weapon|armor|accessory|consumable|material
  equip_slot   VARCHAR(16),               -- NULL이면 착용 불가 소모품/재료
  req_level    SMALLINT NOT NULL DEFAULT 1,
  req_class    VARCHAR(20),               -- NULL = 전 클래스
  base_mods    JSONB NOT NULL,            -- 기본 스탯 [{"stat":"atk","flat":30}]
  max_stack    INT NOT NULL DEFAULT 1,    -- 1 = 개별 아이템(강화/옵션 존재)
  rarity       SMALLINT NOT NULL DEFAULT 1 -- 1~5 (컬러/드롭 확률 기준)
);

-- 캐릭터 소유 아이템: 위치의 단일 진실 = (bag_slot NULL ↔ equip_slot NOT NULL)
ALTER TABLE character_items
  ADD CONSTRAINT chk_pos CHECK (
    (slot IS NOT NULL AND bag_slot IS NULL) OR
    (slot IS NULL AND bag_slot IS NOT NULL)
  );
ALTER TABLE character_items
  ADD COLUMN bag_slot SMALLINT;

CREATE UNIQUE INDEX uq_equip_slot ON character_items(character_id, slot)
  WHERE slot IS NOT NULL;                       -- 부위당 1개 강제
CREATE UNIQUE INDEX uq_bag_slot ON character_items(character_id, bag_slot)
  WHERE bag_slot IS NOT NULL;                   -- 가방 칸 1개 1아이템`,
      },
      {
        lang: "server/item/equip.ts — 착용/탈착 트랜잭션",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

const BAG_SIZE = 60;

export class EquipError extends Error {
  constructor(code: "NOT_EQUIPPABLE" | "REQ_FAIL" | "BAG_FULL" | "SLOT_EMPTY") { super(code); }
}

export async function equipItem(db: Kysely<DB>, charId: number, itemId: number, itemDef: Map<string, any>) {
  return db.transaction().execute(async tx => {
    const it = await tx.selectFrom("character_items").where("id", "=", itemId)
      .where("character_id", "=", charId).forUpdate().executeTakeFirst();
    if (!it) throw new EquipError("SLOT_EMPTY");
    const def = itemDef.get(it.item_code);
    if (!def?.equip_slot) throw new EquipError("NOT_EQUIPPABLE");

    const ch = await tx.selectFrom("characters").where("id", "=", charId)
      .select(["level", "class_code"]).executeTakeFirstOrThrow();
    if (ch.level < def.req_level || (def.req_class && def.req_class !== ch.class_code))
      throw new EquipError("REQ_FAIL");

    // 1) 기존 장비 탈착 → 빈 가방 칸으로
    const old = await tx.selectFrom("character_items")
      .where("character_id", "=", charId).where("slot", "=", def.equip_slot)
      .forUpdate().executeTakeFirst();
    if (old) {
      const used = await tx.selectFrom("character_items")
        .where("character_id", "=", charId).where("bag_slot", "is not", null)
        .select("bag_slot").execute();
      const taken = new Set(used.map(r => r.bag_slot));
      let free = -1;
      for (let i = 0; i < BAG_SIZE; i++) if (!taken.has(i)) { free = i; break; }
      if (free < 0) throw new EquipError("BAG_FULL");
      await tx.updateTable("character_items").set({ slot: null, bag_slot: free })
        .where("id", "=", old.id).execute();
    }
    // 2) 새 장비 착용(부분 유니크 인덱스가 부위당 1개를 물리 강제)
    await tx.updateTable("character_items").set({ slot: def.equip_slot, bag_slot: null })
      .where("id", "=", itemId).execute();

    // 3) 스탯 캐시 더티(021번)
    await tx.updateTable("character_stats_cache").set({ dirty: true })
      .where("character_id", "=", charId).execute();
    return def.equip_slot;
  });
}`,
      },
    ],
    tips: [
      "부분 유니크 인덱스(WHERE slot IS NOT NULL)는 '부위당 1개'를 DB가 물리적으로 보장하는 가장 강력한 방법이다.",
      "CHECK 제약으로 위치 칼럼 상호배타(가방 XOR 장착)를 강제해 복제 버그의 구조적 원인을 차단한다.",
      "가방 칸 이동(swap/drag)은 클라 UI 편의일 뿐이며 서버는 항상 '아이템 id + 목표 칸'으로 재검증한다.",
      "스택 가능 아이템(max_stack>1)은 분할 이동(qty 나누기)까지 트랜잭션으로 처리해야 재료 소모 버그가 사라진다.",
    ],
  },
  {
    id: "025",
    title: "장비 강화/인챈트 확률 및 스탯 부여 연산",
    role: [
      "강화는 '단계별 성공률 + 실패 시 결과(유지/하락/파괴)'의 확률 표이며, 인챈트는 '속성 풀에서 가중치 랜덤 추출'의 문제다. 두 시스템 모두 서버가 결정론적 RNG(seeded)로 수행하고, 시도 로그를 남겨 유저 클레임 시 재현 검증이 가능하게 한다. 확률은 절대 클라에서 계산해 보고하지 않는다 — 서버가 표를 조회해 결과만 통보한다.",
      "보상 설계로 천장(pity) 개념을 강화에도 도입할 수 있다. 연속 실패 횟수가 쌓이면 다음 성공률에 보정(+2%p씩)을 주는 연속 실패 보정(soft pity)은 유저 이탈을 크게 줄이는 표준 장치다. 강화 결과 스탯은 mods JSONB에 누적되며, 021번 StatMath의 equip 소스로 자연 합산된다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE enhance_table (
  level        SMALLINT PRIMARY KEY,      -- 강화 단계 0→1, 1→2 ...
  success_rate NUMERIC(5,4) NOT NULL,     -- 0.9 = 90%
  on_fail      VARCHAR(10) NOT NULL,      -- keep | downgrade | destroy
  cost_gold    INT NOT NULL,
  material     JSONB NOT NULL             -- [{"code":"mat_ore","qty":3}]
);
INSERT INTO enhance_table (level, success_rate, on_fail, cost_gold, material) VALUES
  (0, 1.0000, 'keep',      1000,  '[{"code":"mat_ore","qty":1}]'),
  (1, 0.9000, 'keep',      2000,  '[{"code":"mat_ore","qty":2}]'),
  (2, 0.8000, 'keep',      4000,  '[{"code":"mat_ore","qty":4}]'),
  (3, 0.7000, 'downgrade', 8000,  '[{"code":"mat_ore","qty":8}]'),
  (4, 0.5500, 'downgrade', 16000, '[{"code":"mat_ore","qty":16}]'),
  (5, 0.4000, 'destroy',   32000, '[{"code":"mat_ore","qty":32}]');

CREATE TABLE enchant_pool (
  id        BIGSERIAL PRIMARY KEY,
  tier      SMALLINT NOT NULL,            -- 인챈트 등급 풀
  stat      VARCHAR(16) NOT NULL,
  min_val   INT NOT NULL, max_val INT NOT NULL,
  weight    INT NOT NULL                  -- 가중치 랜덤
);
INSERT INTO enchant_pool (tier, stat, min_val, max_val, weight) VALUES
  (1, 'atk',  5, 12, 40), (1, 'crit', 1, 3, 25), (1, 'hp', 40, 90, 35);

ALTER TABLE character_items
  ADD COLUMN pity_fail SMALLINT NOT NULL DEFAULT 0;   -- 연속 실패 보정`,
      },
      {
        lang: "server/item/enhance.ts — 강화·인챈트 연산",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

/** 강화 시도 — 서버 확률표 + 연속 실패 보정 + 원자적 소모 */
export async function enhance(db: Kysely<DB>, charId: number, itemId: number, table: any[]) {
  return db.transaction().execute(async tx => {
    const it = await tx.selectFrom("character_items").where("id", "=", itemId)
      .where("character_id", "=", charId).forUpdate().executeTakeFirstOrThrow();
    const row = table[it.enhance];                 // 현재 단계 → 다음 단계 확률
    if (!row) throw new Error("MAX_ENHANCE");

    // 재료·골드 소모(부족 시 예외 — CHECK 제약이 음수 차단)
    await tx.updateTable("characters").set(eb => ({ gold: eb("gold", "-", row.cost_gold) }))
      .where("id", "=", charId).where("gold", ">=", row.cost_gold).execute();
    for (const m of row.material) {
      const upd = await tx.updateTable("character_items")
        .set(eb => ({ qty: eb("qty", "-", m.qty) }))
        .where("character_id", "=", charId).where("item_code", "=", m.code)
        .where("qty", ">=", m.qty).execute();
      if (Number(upd.numUpdatedRows) === 0n) throw new Error("NO_MATERIAL");
    }

    // 연속 실패 보정(soft pity): 실패마다 +2%p, 최대 +15%p
    const pity = Math.min(15, (it.pity_fail ?? 0) * 2) / 100;
    const roll = Math.random();
    const success = roll < Number(row.success_rate) + pity;

    if (success) {
      // 강화 보너스: 주 스탯 flat * (1 + 0.12 * 다음 단계)
      const bonus = 1 + 0.12 * (it.enhance + 1);
      await tx.updateTable("character_items")
        .set({ enhance: it.enhance + 1, pity_fail: 0 })
        .where("id", "=", itemId).execute();
      return { ok: true, level: it.enhance + 1, bonusMult: bonus };
    }
    if (row.on_fail === "destroy") {
      await tx.deleteFrom("character_items").where("id", "=", itemId).execute();
      return { ok: false, result: "destroy" };
    }
    if (row.on_fail === "downgrade" && it.enhance > 0) {
      await tx.updateTable("character_items")
        .set({ enhance: it.enhance - 1, pity_fail: it.pity_fail + 1 })
        .where("id", "=", itemId).execute();
      return { ok: false, result: "downgrade", level: it.enhance - 1 };
    }
    await tx.updateTable("character_items").set({ pity_fail: it.pity_fail + 1 })
      .where("id", "=", itemId).execute();
    return { ok: false, result: "keep" };
  });
}

/** 인챈트: 가중치 랜덤(WRS)으로 풀에서 1개 추출 */
export function rollEnchant(pool: {stat:string; min_val:number; max_val:number; weight:number}[]) {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) {
      const val = p.min_val + Math.floor(Math.random() * (p.max_val - p.min_val + 1));
      return { stat: p.stat, flat: val };
    }
  }
  return { stat: pool[0].stat, flat: pool[0].min_val };
}`,
      },
    ],
    tips: [
      "성공률 계산은 반드시 서버 Math.random(또는 CSPRNG)으로 하고, roll 값을 강화 로그에 함께 기록해 클레임 검증을 가능하게 한다.",
      "soft pity(+2%p)는 파괴 단계부터 적용하면 유저 불만이 눈에 띄게 줄고 경제 영향은 미미하다.",
      "재료 소모는 UPDATE ... WHERE qty >= n의 영향 행 수로 검증한다 — SELECT 후 UPDATE 방식은 동시 요청에서 음수 재고가 나온다.",
      "인챈트 가중치는 stat별 파워 밸런스가 흔들리지 않게 티어별로 관리하며, 최상위 티어는 이벤트로만 풀에 추가한다.",
    ],
  },
];
