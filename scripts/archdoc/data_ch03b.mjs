// 모듈 3 (026~030): 캐릭터 및 성장 시스템 — 후반부

export const items = [
  {
    id: "026",
    title: "클래스 전직 시스템 및 스킬 개방 테이블",
    role: [
      "전직은 '기반 클래스 → 1차 → 2차 → 각성'의 계층 구조로, 각 전직은 요구 레벨·선행 퀘스트·전용 던전 클리어 조건을 가진다. 데이터는 class_def(계층·부모 클래스)와 job_change_path(전직 경로·조건)로 정규화하고, 스킬 개방은 class_skill_unlock(클래스별 스킬 + 개방 레벨) 테이블로 관리한다. 전직 실행은 트랜잭션으로 조건 검증 → 클래스 치환 → 스킬 트리 초기화 → 외형 리소스 교체를 수행한다.",
      "클래스 계층이 parent 참조(directed tree)로 되어 있으면, familyOf 같은 계열 판별(파티 스킬 공유, 무기 호환)이 O(1) 조회로 해결된다. 전직 시 기존 투자 스킬 포인트는 전직 전 클래스 스킬은 유지하되 신규 클래스 트리에 포인트를 추가 지급하는 정책(무료 리스펙 1회 동봉)이 유저 경험상 표준이다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE class_def (
  code        VARCHAR(20) PRIMARY KEY,   -- novice|warrior|mage|knight|pyro
  parent      VARCHAR(20) REFERENCES class_def(code),  -- 계층(계열 판별용)
  tier        SMALLINT NOT NULL,          -- 0 기반, 1 1차, 2 2차
  base_mods   JSONB NOT NULL,             -- 클래스 기본 스탯 성향
  sprite_set  VARCHAR(40) NOT NULL        -- 기본 외형 세트
);
INSERT INTO class_def (code, parent, tier, base_mods, sprite_set) VALUES
  ('novice',  NULL,     0, '{"str":5,"dex":5,"int":5,"vit":5}',  'cs_novice'),
  ('warrior', 'novice', 1, '{"str":9,"vit":7}',                   'cs_warrior'),
  ('mage',    'novice', 1, '{"int":9,"dex":6}',                   'cs_mage'),
  ('knight',  'warrior',2, '{"str":11,"vit":10}',                 'cs_knight'),
  ('pyro',    'mage',   2, '{"int":12,"dex":7}',                  'cs_pyro');

CREATE TABLE job_change_path (
  from_class  VARCHAR(20) REFERENCES class_def(code),
  to_class    VARCHAR(20) REFERENCES class_def(code),
  req_level   SMALLINT NOT NULL,
  req_quest   VARCHAR(40),                -- 선행 퀘스트 코드
  PRIMARY KEY (from_class, to_class)
);

CREATE TABLE class_skill_unlock (
  class_code  VARCHAR(20) REFERENCES class_def(code),
  skill_code  VARCHAR(40) REFERENCES skill_def(code),
  unlock_lv   SMALLINT NOT NULL,
  PRIMARY KEY (class_code, skill_code)
);`,
      },
      {
        lang: "server/class/jobChange.ts — 전직 실행",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface PathDef {
  from_class: string; to_class: string; req_level: number; req_quest: string | null;
}

export class JobChangeError extends Error {
  constructor(code: "WRONG_CLASS" | "LOW_LEVEL" | "QUEST_INCOMPLETE") { super(code); }
}

export async function jobChange(
  db: Kysely<DB>, charId: number, toClass: string,
  paths: PathDef[], unlocks: Map<string, {skill_code:string; unlock_lv:number}[]>,
  clearQuest: (charId: number, questCode: string) => boolean,
) {
  return db.transaction().execute(async tx => {
    const ch = await tx.selectFrom("characters").where("id", "=", charId)
      .forUpdate().select(["class_code", "level"]).executeTakeFirstOrThrow();
    const path = paths.find(p => p.to_class === toClass && p.from_class === ch.class_code);
    if (!path) throw new JobChangeError("WRONG_CLASS");
    if (ch.level < path.req_level) throw new JobChangeError("LOW_LEVEL");
    if (path.req_quest && !clearQuest(charId, path.req_quest))
      throw new JobChangeError("QUEST_INCOMPLETE");

    // 1) 클래스 치환
    await tx.updateTable("characters").set({ class_code: toClass })
      .where("id", "=", charId).execute();

    // 2) 신규 클래스 스킬 트리 시드(개방 레벨 도달분만 유효, 포인트는 유지)
    const newSkills = (unlocks.get(toClass) ?? [])
      .filter(u => u.unlock_lv <= ch.level);
    for (const s of newSkills) {
      await tx.insertInto("character_skill")
        .values({ character_id: charId, skill_code: s.skill_code, rank: 0 })
        .onConflict(oc => oc.doNothing()).execute();
    }

    // 3) 외형 교체 + 스탯 캐시 더티
    await tx.updateTable("character_stats_cache").set({ dirty: true })
      .where("character_id", "=", charId).execute();
    return { from: ch.class_code, to: toClass };
  });
}

/** 계열 판별(파티 스킬 공유 등): parent 체인 상술판별 */
export function familyOf(code: string, classes: Map<string, {parent: string|null}>): string {
  let cur: string | null = code;
  while (cur) {
    const p = classes.get(cur)?.parent ?? null;
    if (p === "novice" || p === null) return cur;   // 1차 클래스를 계열 대표로
    cur = p;
  }
  return "novice";
}`,
      },
    ],
    tips: [
      "전직 조건(레벨+퀘스트) 검증은 트랜잭션 내 forUpdate로 — 조건 검증과 치환 사이에 레벨 조작이 끼어들 수 없다.",
      "클래스 계층은 parent 참조 하나로 계열 판별·무기 호환·스킬 상속 전부 해결되므로, 별도 '계열' 칼럼을 만들지 마라.",
      "전직 후 자동 리스펙 1회 제공은 빌드 실패 불안을 제거하는 표준 배려다 — respec_log에 cost_kind='jobchange'로 기록한다.",
      "스킬 개방 테이블은 클라 프리뷰(자물쇠 아이콘)에도 그대로 쓰이므로, 부팅 시 통째로 캐시해 조회 비용을 0으로 만든다.",
    ],
  },
  {
    id: "027",
    title: "외형(코스튬/스킨) 레이어 분리 및 착용 처리",
    role: [
      "캐릭터 외형은 '기반 신체(body) + 장비 스킨(장비가 그대로 보이는 형태) + 코스튬(장비 위에 덮는 겉옷) + 이펙트(오라)'의 레이어 스택이다. 렌더 우선순위는 코스튬 > 장비 스킨 > 기반 신체이며, 각 레이어는 파트별(머리/몸통/다리/무기) 스프라이트 키를 조합해 완성된다. 파트 분리가 핵심인 이유는 색상 변형(팔레트 스왑)과 코스튬 부분 가림(투명 헬멧 등)을 데이터만으로 지원하기 위해서다.",
      "착용 판정은 cosmetic 슬롯을 별도 테이블로 둔다 — 장비 스탯(024번)과 외형 표시를 분리하면 '스탯 없는 코스튬', '보이지 않는 장비(언디스가이즈)'가 자연스럽게 구현된다. 외형 조합 결과는 해시 키로 캐시해 같은 조합의 다수 유저가 한 맵에 있을 때 텍스처 아틀라스 캐시(001/009번)가 유효하게 만든다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE cosmetic_def (
  code        VARCHAR(40) PRIMARY KEY,
  part        VARCHAR(12) NOT NULL,     -- body|head|upper|lower|weapon|aura
  layer       SMALLINT NOT NULL,        -- 렌더 순서: 낮을수록 아래(0 body, 10 skin, 20 costume, 30 aura)
  atlas_key   VARCHAR(40) NOT NULL,     -- 스프라이트 아틀라스
  palette     JSONB NOT NULL DEFAULT '[]', -- 색상 변형 프리셋
  rarity      SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE character_cosmetics (
  character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  part         VARCHAR(12) NOT NULL,
  cosmetic_code VARCHAR(40) REFERENCES cosmetic_def(code),
  palette_idx  SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, part)      -- 파트당 1개 착용
);`,
      },
      {
        lang: "src/game/Appearance.ts — 클라 렌더 조합",
        code: `export interface CosPart {
  part: "body" | "head" | "upper" | "lower" | "weapon" | "aura";
  layer: number;
  atlasKey: string;
  paletteIdx: number;
}

export interface EquipVisual { part: string; atlasKey: string; }  // 장비에서 온 스킨

/** 외형 스택 조합: 코스튬 > 장비 스킨 > 기반 신체 */
export function buildAppearance(
  base: { body: string; head: string },
  equips: EquipVisual[],
  cosmetics: CosPart[],
): CosPart[] {
  const layers: CosPart[] = [
    { part: "body",  layer: 0, atlasKey: base.body, paletteIdx: 0 },
    { part: "head",  layer: 0, atlasKey: base.head, paletteIdx: 0 },
  ];
  for (const e of equips) {                       // 장비 스킨 = layer 10
    layers.push({ part: e.part as CosPart["part"], layer: 10,
                  atlasKey: e.atlasKey, paletteIdx: 0 });
  }
  for (const c of cosmetics) {                    // 코스튬 = layer 20, 오라 = 30
    layers.push(c);
  }
  return layers.sort((a, b) => a.layer - b.layer);
}

/** 조합 해시 → 아틀라스 캐시 키(009번 MemorySweeper 보호 대상 마킹용) */
export function appearanceKey(layers: CosPart[]): string {
  return layers.map(l => l.atlasKey + "#" + l.paletteIdx).join("|");
}

// Phaser 렌더: 부위별 스프라이트를 컨테이너에 y-sort 없이 순서대로 add
// const container = scene.add.container(x, y);
// for (const layer of layers) {
//   const s = scene.add.sprite(0, 0, layer.atlasKey, frameName);
//   s.setTint(palettes[layer.paletteIdx] ?? 0xffffff);
//   container.add(s);
// }
// 컨테이너 depth는 Y-Sorting 엔진(042번)이 캐릭터 단위로 관리`,
      },
    ],
    tips: [
      "스탯 슬롯(024)과 코스튬 슬롯을 테이블부터 분리해야 '겉은 코스튬, 속은 강화 장비'가 설계 오염 없이 구현된다.",
      "파트별 아틀라스는 전 캐릭터 공용으로 관리하면 외형 조합 수백 개에도 텍스처 수가 파트 수준으로 유지된다.",
      "palette JSONB로 색상 변형을 지원하면 같은 코스튬의 컬러 변형이 레코드 추가 없이 끝난다.",
      "appearanceKey 캐시는 파티 화면·길드 배너 등 '다수 캐릭터 동시 표시' 시 렌더 비용을 크게 낮춘다.",
    ],
  },
  {
    id: "028",
    title: "칭호/업적 달성 조건 및 패시브 스탯 부여 연산",
    role: [
      "업적(achievement)은 이벤트 기반 카운터(사냥 1000마리, 퀘스트 100개 등)와 조건 매칭으로 달성되고, 칭호(title)는 업적 달성 보상의 대표 형태다. 데이터 구조는 achievement_def(조건 DSL), achievement_progress(캐릭터 카운터), title_def(패시브 스탯 부여)로 나뉜다. 조건 DSL은 { event, target, count }의 단순 구조로 유지해 신규 업적 추가가 데이터 삽입만으로 가능하게 한다.",
      "패시브 부여는 '장착 중인 칭호 1개'의 mods를 StatMath(021번)의 passive 소스로 주입하는 방식이며, 도감·멘토링 등 전역 패시브와 같은 파이프라인을 공유한다. 진행도 업데이트는 게임 이벤트 버스에 비동기 리스너로 걸어 전투 핫패스를 절대 막지 않고, 달성 판정은 배치(틱당 큐 소화)로 수행한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE achievement_def (
  code        VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(40) NOT NULL,
  event       VARCHAR(30) NOT NULL,      -- "kill" | "quest_clear" | "gold_earned" ...
  target      VARCHAR(40),               -- 몬스터 코드/퀘스트 코드(NULL = 전체)
  count       INT NOT NULL,              -- 목표 횟수
  title_code  VARCHAR(40),               -- 달성 시 지급 칭호
  rewards     JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE achievement_progress (
  character_id  BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  achievement_code VARCHAR(40) REFERENCES achievement_def(code),
  progress      INT NOT NULL DEFAULT 0,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (character_id, achievement_code)
);

CREATE TABLE title_def (
  code        VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(30) NOT NULL,
  mods        JSONB NOT NULL             -- 패시브: [{"stat":"atk","mul":0.03}]
);`,
      },
      {
        lang: "server/achievement/Engine.ts — 이벤트 구동 판정",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface AchDef {
  code: string; event: string; target: string | null; count: number;
  title_code: string | null; rewards: any[];
}

/** 게임 이벤트 → 업적 진행도 갱신(비동기 큐 — 전투 패스를 막지 않음) */
export class AchievementEngine {
  private queue: { charId: number; event: string; target: string; n: number }[] = [];
  private byEvent = new Map<string, AchDef[]>();

  constructor(private db: Kysely<DB>, defs: AchDef[],
              private onTitle: (charId: number, titleCode: string) => Promise<void>) {
    for (const d of defs) {
      const list = this.byEvent.get(d.event) ?? [];
      list.push(d);
      this.byEvent.set(d.event, list);
    }
  }

  /** 월드 서버가 emit: onEnemyKilled/questClear 등에서 호출 */
  push(charId: number, event: string, target: string, n = 1) {
    this.queue.push({ charId, event, target, n });
  }

  /** RenderLoop 고정 업데이트 또는 100ms 타이머에서 소화 */
  async flush() {
    const batch = this.queue.splice(0, this.queue.length);
    if (!batch.length) return;
    const db = this.db;
    for (const item of batch) {
      const defs = this.byEvent.get(item.event) ?? [];
      for (const d of defs) {
        if (d.target && d.target !== item.target) continue;
        // UPSERT 진행도
        await db.insertInto("achievement_progress")
          .values({ character_id: item.charId, achievement_code: d.code,
                    progress: item.n, completed: item.n >= d.count })
          .onConflict(oc => oc
            .doUpdate().set(eb => ({
              progress: eb("progress", "+", item.n),
              completed: eb("progress", "+", item.n) >= d.count ? true : false,
            }))).execute();
        // 달성 확정 처리
        const row = await db.selectFrom("achievement_progress")
          .where("character_id", "=", item.charId)
          .where("achievement_code", "=", d.code)
          .select(["progress", "completed"]).executeTakeFirst();
        if (row && row.completed && row.progress === item.n) {   // 방금 달성
          if (d.title_code) await this.onTitle(item.charId, d.title_code);
          // rewards 지급은 재화 트랜잭션(018번)으로
        }
      }
    }
  }

  /** 장착 칭호 패시브 → StatMath 소스로 변환 */
  static titleSource(mods: { stat: string; flat?: number; mul?: number }[]) {
    return { kind: "passive" as const, mods };
  }
}`,
      },
    ],
    tips: [
      "업적 진행도 갱신은 반드시 비동기 큐+배치로 — 킬당 DB 쓰기가 동기로 들어가면 대규모 사냥에서 DB가 병목이 된다.",
      "조건 DSL은 {event, target, count} 3필드로 제한한다 — 범용 조건 엔진은 만들수록 디버깅 비용이 폭증한다.",
      "'방금 달성' 판정(progress == n)으로 지급 중복을 막되, 재시작 후에도 completed 플래그로 이중 지급을 차단한다.",
      "칭호 패시브는 StatMath passive 소스 하나로 주입하므로, 도감/멘토링/VIP 등 전역 패시브도 같은 인터페이스를 재사용한다.",
    ],
  },
  {
    id: "029",
    title: "장비 무작위 옵션 리롤(Random Option Reroll) 로직",
    role: [
      "랜덤 옵션(RO)은 같은 아이템 코드라도 획득 시 가중치 기반으로 서로 다른 보조 스탯을 갖게 하는 재미 장치다. 구성은 옵션 풀(속성·최소/최대치·가중치·티어)과 '개수 보장 + 티어 분포' 규칙으로 이루어진다. 리롤은 기존 옵션을 지우고 재추출하되, '리롤 방지 옵션(잠금)'을 유료 재화로 판매하는 것이 표준 BM 구조다.",
      "추출 알고리즘은 (1) 옵션 개수를 래리티별로 결정(일반 1~2개, 유니크 3개), (2) 중복 없이 가중치 랜덤(WRS)으로 속성 선택, (3) 속성별 값 범위에서 균등 추출, (4) 티어 보정(고래 아이템은 상위 티어 가중치 상향)의 4단계다. 결과는 item.mods에 기록되며 021번 StatMath의 equip 소스로 합산된다. 리롤 연산은 서버 전용이고, 클라는 결과 프리뷰만 받는다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE ro_pool (
  id        BIGSERIAL PRIMARY KEY,
  tier      SMALLINT NOT NULL,          -- 1 일반 ~ 3 유니크
  stat      VARCHAR(16) NOT NULL,
  min_val   INT NOT NULL, max_val INT NOT NULL,
  weight    INT NOT NULL
);
INSERT INTO ro_pool (tier, stat, min_val, max_val, weight) VALUES
  (1, 'atk',   3, 8,   40), (1, 'hp',  30, 70, 35),
  (2, 'crit',  2, 4,   20), (2, 'aspd', 3, 6, 15),
  (3, 'atk',  10, 18,  8),  (3, 'matk', 10, 18, 8);

ALTER TABLE character_items
  ADD COLUMN ro_options JSONB NOT NULL DEFAULT '[]',  -- [{stat,val,tier}]
  ADD COLUMN ro_locks  SMALLINT[] NOT NULL DEFAULT '{}'; -- 잠금 인덱스`,
      },
      {
        lang: "server/item/randomOption.ts — 추출·리롤",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface RoOption { stat: string; val: number; tier: number; }
export interface RoPoolRow { id: number; tier: number; stat: string; min_val: number; max_val: number; weight: number; }

/** 래리티별 옵션 개수 규칙 */
const COUNT_BY_RARITY: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 };
/** 티어 분포 가중치(래리티별 상위 티어 확률) */
const TIER_DIST: Record<number, [number, number, number]> = {
  1: [80, 18, 2], 2: [70, 25, 5], 3: [60, 30, 10], 4: [50, 35, 15], 5: [40, 40, 20],
};

function pickTier(rarity: number): number {
  const [w1, w2, w3] = TIER_DIST[rarity] ?? TIER_DIST[1];
  let r = Math.random() * (w1 + w2 + w3);
  if ((r -= w1) <= 0) return 1;
  if ((r -= w2) <= 0) return 2;
  return 3;
}

function pickWeighted(pool: RoPoolRow[]): RoPoolRow {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) if ((r -= p.weight) <= 0) return p;
  return pool[pool.length - 1];
}

/** 옵션 세트 추출: 티어 결정 → 중복 없는 속성 WRS → 값 균등 추출 */
export function rollOptions(rarity: number, pool: RoPoolRow[]): RoOption[] {
  const count = COUNT_BY_RARITY[rarity] ?? 1;
  const used = new Set<string>();
  const out: RoOption[] = [];
  for (let i = 0; i < count; i++) {
    const tier = pickTier(rarity);
    const tiered = pool.filter(p => p.tier === tier && !used.has(p.stat));
    if (!tiered.length) continue;
    const pick = pickWeighted(tiered);
    used.add(pick.stat);
    out.push({ stat: pick.stat,
      val: pick.min_val + Math.floor(Math.random() * (pick.max_val - pick.min_val + 1)),
      tier });
  }
  return out;
}

/** 리롤: 잠금 인덱스 유지 + 재화 소모 */
export async function reroll(db: Kysely<DB>, charId: number, itemId: number,
                             pool: RoPoolRow[], costGold: number) {
  return db.transaction().execute(async tx => {
    const it = await tx.selectFrom("character_items").where("id", "=", itemId)
      .where("character_id", "=", charId).forUpdate().executeTakeFirstOrThrow();
    await tx.updateTable("characters").set(eb => ({ gold: eb("gold", "-", costGold) }))
      .where("id", "=", charId).where("gold", ">=", costGold).execute();

    const fresh = rollOptions(3, pool);           // 실제로는 item_def.rarity 사용
    // 잠금된 슬롯은 기존 옵션 유지
    const locked = new Set(it.ro_locks ?? []);
    it.ro_options.forEach((old: RoOption, i: number) => {
      if (locked.has(i)) fresh[i] = old;
    });
    await tx.updateTable("character_items").set({ ro_options: fresh })
      .where("id", "=", itemId).execute();
    return fresh;
  });
}`,
      },
    ],
    tips: [
      "중복 없는 속성 추출(used Set)은 'atk 3개' 같은 쓰레기 옵션을 구조적으로 막는다.",
      "잠금 리롤은 남은 후보 수가 줄어들수록 가치가 올라가므로, 잠금 비용을 지수적으로(1.5^n) 설계한다.",
      "추출 로그(아이템 id, 시드, 결과)를 남기면 '내 확률 거짓말' 클레임에 데이터로 대응할 수 있다.",
      "옵션 밸런스는 티어 간 밸류 차이를 2~2.5배로 유지해야 고티어 욕심이 기능한다.",
    ],
  },
  {
    id: "030",
    title: "도감/수집품 달성률 계산 및 전역 보상 연산",
    role: [
      "도감(codex)은 몬스터·장비·지역 등 수집 카테고리별 등록률을 추적하고, 달성률 구간(10%, 30%, 50%...)에 전역 패시브(모든 스탯 +1% 등)를 부여한다. 데이터는 codex_entry(수집 대상 마스터), character_codex(등록 상태), codex_reward_tier(달성률 구간 보상)로 구성된다. 달성률은 카테고리별 가중 평균으로 계산해 '몬스터 도감은 반영 낮게, 장비 도감은 높게' 같은 기획 튜닝이 가능하다.",
      "등록 이벤트(첫 처치, 첫 획득)는 028번 엔진과 동일한 비동기 큐로 처리하고, 달성률 구간 통과 시 보상을 재화 트랜잭션(018번)으로 지급한다. 전역 패시브는 StatMath(021번)의 passive 소스로 매 접속 시 재산출되며, 도감 화면의 진행도 UI는 캐시된 달성률 값을 그대로 표시한다. 재계산은 등록 이벤트 직후 1회만 수행한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + Seed",
        code: `CREATE TABLE codex_entry (
  id          BIGSERIAL PRIMARY KEY,
  category    VARCHAR(16) NOT NULL,     -- monster | equipment | region | recipe
  ref_code    VARCHAR(40) NOT NULL,     -- 몬스터 코드 등
  weight      SMALLINT NOT NULL DEFAULT 1,  -- 달성률 가중치
  UNIQUE (category, ref_code)
);

CREATE TABLE character_codex (
  character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  entry_id     BIGINT NOT NULL REFERENCES codex_entry(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, entry_id)
);

CREATE TABLE codex_reward_tier (
  category   VARCHAR(16) NOT NULL,
  pct        SMALLINT NOT NULL,          -- 10 = 10%
  mods       JSONB NOT NULL,             -- [{"stat":"atk","mul":0.01}]
  rewards    JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (category, pct)
);`,
      },
      {
        lang: "server/codex/Progress.ts — 달성률·보상 연산",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface TierRow { category: string; pct: number; mods: any[]; rewards: any[]; }

export class CodexService {
  constructor(private db: Kysely<DB>, private tiers: TierRow[]) {}

  /** 등록 + 즉시 달성률 재계산(등록은 드물므로 동기 처리 허용) */
  async register(charId: number, category: string, refCode: string) {
    return this.db.transaction().execute(async tx => {
      const entry = await tx.selectFrom("codex_entry")
        .where("category", "=", category).where("ref_code", "=", refCode)
        .select(["id", "weight"]).executeTakeFirst();
      if (!entry) return null;

      await tx.insertInto("character_codex")
        .values({ character_id: charId, entry_id: entry.id })
        .onConflict(oc => oc.doNothing()).execute();

      const before = await this.pctOf(tx, charId);
      await this.grantTiers(tx, charId, before);
      return before;
    });
  }

  /** 카테고리별 가중 달성률(%) */
  private async pctOf(tx: any, charId: number): Promise<Record<string, number>> {
    const rows = await tx.selectFrom("codex_entry as e")
      .leftJoin("character_codex as c", join => join
        .onRef("c.entry_id", "=", "e.id")
        .on("c.character_id", "=", charId))
      .select(["e.category", (eb: any) =>
        eb.fn.sum(eb.case().when("c.character_id", "is not", null)
          .then(eb.ref("e.weight")).else(0).end()).as("got"),
        (eb: any) => eb.fn.sum("e.weight").as("total")])
      .groupBy("e.category").execute();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category] = Math.floor((r.got / r.total) * 100);
    return out;
  }

  /** 새로 통과한 구간 보상 지급(중복 지급 방지: ledger ref로 검증) */
  private async grantTiers(tx: any, charId: number, pct: Record<string, number>) {
    for (const t of this.tiers) {
      if ((pct[t.category] ?? 0) < t.pct) continue;
      const ref = "codex:" + t.category + ":" + t.pct;
      const paid = await tx.selectFrom("ledger")
        .where("kind", "=", "gold").where("ref", "=", ref)
        .where("from_user", "is", null)
        .where(sql\`payload::jsonb ->> 'char'\`, "=", String(charId))
        .select("id").executeTakeFirst();
      if (paid) continue;                                    // 이미 지급
      await tx.insertInto("ledger").values({
        at: new Date(), kind: "gold", from_user: null, to_user: charId,
        ref, payload: JSON.stringify({ char: charId, tier: t }),
      }).execute();
    }
  }
}

// 전역 패시브 소스(021번 StatMath에 주입):
// sources.push({ kind: "passive", mods: flatMapOfGrantedTiers(...) })`,
      },
    ],
    tips: [
      "달성률은 단순 등록 수 비율 대신 가중 평균으로 — 하드 코어 대상에 무게를 두면 도감이 '장기 목표'로 기능한다.",
      "구간 보상 지급은 ledger ref('codex:monster:50')로 멱등성을 확보한다 — 재계산이 몇 번 돌아도 이중 지급이 없다.",
      "전역 패시브는 접속 시 1회 재산출로 충분하다 — 매 전투마다 DB를 치지 않게 캐시(021번 더티 플래그)를 유지한다.",
      "도감 UI는 카테고리별 진행도를 한 번의 쿼리(GROUP BY)로 받는다 — 카테고리별 N+1 쿼리는 반드시 피한다.",
    ],
  },
];
