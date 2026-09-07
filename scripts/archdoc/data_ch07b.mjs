// 모듈 7 (066~070): 주요 콘텐츠 시스템 — 후반부

export const items = [
  {
    id: "066",
    title: "제작/연금술 재료 합성 레시피 연산 모듈",
    role: [
      "제작 시스템은 '레시피(재료 → 결과물 + 확률/대체재) → 재고 검증 → 소모 → 산출'의 연산 파이프라인이다. 레시피 정의는 (1) 재료 목록(코드, 수량, 대체재 허용 여부), (2) 결과물(아이템/수량/랜덤 옵션 여부), (3) 스킬·도구 요구(연금술 레벨, 제작대 접근)로 구성된다. 재고 검증과 소모는 단일 트랜잭션으로 — 검증과 소모 사이의 동시 제작 요청이 재료를 이중 소모하는 레이스를 차단한다.",
      "성공률/품질 계산도 서버 연산이다. 기본 성공률 + 제작 스킬 보정 + 행운 버프로 성공을 판정하고, 실패 시 재료의 일부(예: 50%)만 회수하는 정책으로 실패 부담을 조절한다. 연금술(포션)은 개수 배치 제작(1회 시도로 N개)을 지원해 재고 연산을 수율(multiplier)로 일반화한다. 제작 이력은 로그로 남겨 경제 지표(재료 소비량) 분석에 쓴다.",
    ],
    blocks: [
      {
        lang: "server/craft/Craft.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface Ingredient { itemCode: string; qty: number; substitutes?: string[]; }
export interface RecipeDef {
  id: string; name: string;
  craftMs: number;                  // 제작 소요(0 = 즉시)
  requiredSkillLevel?: number;      // 연금술/대장장이 레벨
  ingredients: Ingredient[];
  output: { itemCode: string; qty: number };
  successRate: number;              // 0~1
  failRefundRate: number;           // 실패 시 회수율(0.5 = 절반)
  allowBatch: boolean;              // 개수 배치(연금술)
}

export class CraftService {
  constructor(private db: Kysely<DB>, private recipes: Map<string, RecipeDef>) {}

  /** 제작 실행: 재고 검증 → 원자적 소모 → 산출 */
  async craft(charId: number, recipeId: string, batch = 1) {
    const def = this.recipes.get(recipeId);
    if (!def) throw new Error("NO_RECIPE");
    if (batch < 1 || (!def.allowBatch && batch > 1)) throw new Error("BATCH_FORBIDDEN");

    return this.db.transaction().execute(async tx => {
      // 1) 스킬 요구
      if (def.requiredSkillLevel) {
        const sk = await tx.selectFrom("character_skill")
          .where("character_id", "=", charId)
          .where("skill_code", "=", "craft_" + recipeId.split("_")[0])
          .select("rank").executeTakeFirst();
        if (!sk || sk.rank < def.requiredSkillLevel) throw new Error("LOW_SKILL");
      }
      // 2) 재료 소유 검증 + 소모(수량 n배)
      for (const ing of def.ingredients) {
        const need = ing.qty * batch;
        // 대체재 포함 보유량 합산 후 차감
        const codes = [ing.itemCode, ...(ing.substitutes ?? [])];
        const owned = await tx.selectFrom("character_items")
          .where("character_id", "=", charId)
          .where(eb => eb("item_code", "in", codes))
          .select(["id", "item_code", "qty"]).forUpdate().execute();
        const have = owned.reduce((s, r) => s + r.qty, 0);
        if (have < need) throw new Error("NO_MATERIAL");
        let left = need;
        for (const row of owned.sort((a, b) => a.qty - b.qty)) {
          if (left <= 0) break;
          const take = Math.min(row.qty, left);
          left -= take;
          await tx.updateTable("character_items")
            .set(eb => ({ qty: eb("qty", "-", take) }))
            .where("id", "=", row.id).execute();
        }
      }
      // 3) 성공 판정 + 산출
      const ok = Math.random() < def.successRate;
      if (!ok) {
        // 실패: 재료 일부 회수(재고로 환원)
        for (const ing of def.ingredients) {
          const refund = Math.floor(ing.qty * batch * def.failRefundRate);
          if (refund > 0) {
            await tx.updateTable("character_items")
              .set(eb => ({ qty: eb("qty", "+", refund) }))
              .where("character_id", "=", charId)
              .where("item_code", "=", ing.itemCode).execute();
          }
        }
        return { ok: false, output: null };
      }
      const outQty = def.output.qty * batch;
      await tx.updateTable("character_items")
        .set(eb => ({ qty: eb("qty", "+", outQty) }))
        .where("character_id", "=", charId)
        .where("item_code", "=", def.output.itemCode).execute();
      // 제작 이력(경제 지표)
      await tx.insertInto("ledger").values({
        at: new Date(), kind: "item", from_user: null, to_user: charId,
        ref: "craft:" + recipeId, payload: JSON.stringify({ batch, outQty }),
      }).execute();
      return { ok: true, output: { code: def.output.itemCode, qty: outQty } };
    });
  }
}`,
      },
    ],
    tips: [
      "재료 소모는 '보유량 합산 → 차감' 패턴으로 대체재를 지원한다 — 개별 재고 검증 방식은 대체재 로직이 중복된다.",
      "실패 회수율(50%)은 제작 실패의 스트레스와 재료 경제 사이의 균형점이며, 고급 레시피는 60~70%로 완화한다.",
      "배치 제작(연금술)은 반복 클릭을 없애는 UX 장치이자, 재고 연산을 수율로 일반화하는 설계 이점이 있다.",
      "제작 이력 로그는 인플레이션 모니터링(085번)의 원천 데이터로 필수다.",
    ],
  },
  {
    id: "067",
    title: "펫/탈것 이동속도 보정 및 자동 루팅 AI",
    role: [
      "펫/탈것은 (1) 이동 속도 보정(스탯 파이프라인 021번의 speedMult), (2) 팔로우 AI(주인 뒤따르기), (3) 자동 루팅(드롭 근접 시 획득)의 세 기능으로 구성된다. 속도 보정은 탈것 등급(일반 1.3배, 희귀 1.5배, 레전더리 1.8배)과 펫 보너스를 합산하되, 전투 중 페널티(전투 시 0.6배)와 지형 제한(실내 탑승 금지) 규칙이 함께 적용된다.",
      "자동 루팅은 '드롭 스폰 → 펫이 목표로 이동 → 반경 도달 시 획득 요청'의 AI 사이클이다. 획득은 서버가 검증(053번 fffa 규칙과 동일 — 근접 + 선착)하고, 펫은 주인과 드롭 사이 우선순위(드롭이 3타일 이내면 페치, 아니면 팔로우)로 결정한다. 봇 탐지(093번)와의 경계 때문에, 자동 루팅은 '주인이 유효한 전투 상태일 때만' 활성화하는 게이팅을 둔다.",
    ],
    blocks: [
      {
        lang: "src/game/PetAI.ts",
        code: `import type { Vec } from "../combat/hitbox";

export interface MountDef { code: string; speedMult: number; canCombat: boolean; }
export interface PetState {
  x: number; y: number;
  mode: "follow" | "fetch";
  fetchTarget: { dropId: number; x: number; y: number } | null;
}

export class PetBrain {
  private static FOLLOW_DIST = 64;       // 팔로우 유지 거리
  private static FETCH_RANGE = 96;       // 루팅 판정 반경
  private static PET_SPEED = 170;        // 주인보다 약간 빠르게

  constructor(private rng: () => number = Math.random) {}

  /** 고정 업데이트: 우선순위(페치 > 팔로우)로 이동 벡터 산출 */
  tick(pet: PetState, owner: Vec & { inCombat: boolean; mounted: boolean },
       drops: { id: number; x: number; y: number; claimed: boolean }[],
       dtMs: number): { vx: number; vy: number; wantAcquire: number | null } {
    const dt = dtMs / 1000;

    // 1) 루팅: 주인이 비전투 + 미탑승 + 미점유 드롭 존재
    if (!owner.inCombat && !owner.mounted) {
      const near = drops
        .filter(d => !d.claimed
          && Math.hypot(d.x - owner.x, d.y - owner.y) < PetBrain.FETCH_RANGE)
        .sort((a, b) => Math.hypot(a.x - pet.x, a.y - pet.y)
                      - Math.hypot(b.x - pet.x, b.y - pet.y))[0];
      if (near) {
        pet.mode = "fetch";
        pet.fetchTarget = { dropId: near.id, x: near.x, y: near.y };
      }
    }
    if (pet.mode === "fetch" && pet.fetchTarget) {
      const t = pet.fetchTarget;
      const d = Math.hypot(t.x - pet.x, t.y - pet.y);
      if (d <= 16) {                                    // 도달 → 획득 요청
        pet.mode = "follow"; pet.fetchTarget = null;
        return { vx: 0, vy: 0, wantAcquire: t.dropId };
      }
      const ux = (t.x - pet.x) / d, uy = (t.y - pet.y) / d;
      pet.x += ux * PetBrain.PET_SPEED * dt;
      pet.y += uy * PetBrain.PET_SPEED * dt;
      return { vx: ux, vy: uy, wantAcquire: null };
    }

    // 2) 팔로우: 유지 거리 밖이면 접근(약간의 지연/브레이크로 자연스럽게)
    const dist = Math.hypot(owner.x - pet.x, owner.y - pet.y);
    if (dist > PetBrain.FOLLOW_DIST) {
      const ux = (owner.x - pet.x) / dist, uy = (owner.y - pet.y) / dist;
      const speed = PetBrain.PET_SPEED * (dist > 200 ? 1.4 : 1);   // 멀면 가속
      pet.x += ux * speed * dt;
      pet.y += uy * speed * dt;
      return { vx: ux, vy: uy, wantAcquire: null };
    }
    return { vx: 0, vy: 0, wantAcquire: null };
  }
}

/** 속도 보정 합산(021번 StatMath와 연결) */
export function movementSpeedMult(mount: MountDef | null,
                                 petBuffs: { stat: string; mul?: number }[],
                                 inCombat: boolean): number {
  let mult = mount?.speedMult ?? 1;
  for (const b of petBuffs) if (b.stat === "aspd" && b.mul) mult += b.mul;
  if (inCombat) mult *= 0.6;            // 전투 중 탈것 페널티
  return Math.min(2.2, mult);           // 상한 클램프
}`,
      },
    ],
    tips: [
      "펫 속도는 주인보다 15~20% 빠르게 — 느리면 항상 뒤처져 '버려진 펫'처럼 보인다.",
      "페치(루팅) 조건에 '주인 비전투 + 미탑승' 게이팅은 봇 탐지(093번) 오탐을 크게 줄인다.",
      "팔로우는 거리 멀수록 가속(멀면 1.4배)해 유저가 워프하는 느낌 없이 따라붙게 만든다.",
      "드롭 획득은 반드시 서버 근접+선착 검증(053번)으로 — 펫이 자동 획득해도 규칙은 사람과 동일하다.",
    ],
  },
  {
    id: "068",
    title: "하우징/개인 영지 가구 배치 및 인스턴스 공간 생성",
    role: [
      "하우징은 '개인 전용 인스턴스 공간 + 가구 배치(그리드 스냅) + 방문자 초대'의 구조다. 집은 017번 룸 시스템에서 kind=housing 룸으로 생성되고, 주인 접속 시 1회 생성(유휴 10분 후 회수), 방문자는 초대 토큰으로 입장한다. 가구 배치 데이터는 (가구 코드, 타일 좌표, 회전, 스킨)의 배열이며, 세이브는 JSONB로 통째로 저장한다(부분 업데이트가 아니라 배치 편집 완료 시 덤프).",
      "배치 편집 UX의 핵심은 그리드 스냅 + 충돌(가구 겹침) 검증 + 배치 유효 좌표(벽/문 위 배치 금지)다. 클라는 드래그 편집 중 미리보기를 제공하고, 저장 시 서버가 전체 배치를 재검증(코드 유효성, 좌표 범위, 겹침)한다. 가구는 스탯 효과(편의도 — 회복 배율 등)를 가질 수 있어 050번 핫스팟 회복과 파이프라인을 공유한다.",
    ],
    blocks: [
      {
        lang: "server/housing/Housing.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface FurnitureDef {
  code: string;                       // "bed_wood", "table_oak"
  w: number; h: number;               // 그리드 점유 크기(타일)
  category: "bed" | "table" | "decor" | "storage";
  facility?: { kind: "rest"; regenMult: number } | { kind: "storage"; slots: number };
  priceGold: number;
}
export interface PlacedFurniture {
  defCode: string; x: number; y: number; rot: 0 | 90 | 180 | 270; skin?: string;
}

const HOUSE_W = 24, HOUSE_H = 18;      // 집 내부 그리드(타일)

export class HousingService {
  constructor(private db: Kysely<DB>, private defs: Map<string, FurnitureDef>) {}

  /** 배치 검증: 범위/코드/겹침/벽 */
  validate(placed: PlacedFurniture[], blocked: Uint8Array): string | null {
    const occupied = new Set<string>();
    for (const p of placed) {
      const def = this.defs.get(p.defCode);
      if (!def) return "unknown:" + p.defCode;
      // 회전 시점에 w/h 스왑
      const [w, h] = p.rot % 180 === 90 ? [def.h, def.w] : [def.w, def.h];
      if (p.x < 0 || p.y < 0 || p.x + w > HOUSE_W || p.y + h > HOUSE_H) return "out_of_bounds";
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const gx = p.x + dx, gy = p.y + dy;
          if (blocked[gy * HOUSE_W + gx]) return "on_wall:" + gx + "," + gy;
          const key = gx + "," + gy;
          if (occupied.has(key)) return "overlap:" + key;
          occupied.add(key);
        }
      }
    }
    return null;
  }

  /** 배치 저장(주인 세이브 — JSONB 덤프) */
  async saveLayout(charId: number, placed: PlacedFurniture[], blocked: Uint8Array) {
    const err = this.validate(placed, blocked);
    if (err) throw new Error("INVALID_LAYOUT:" + err);
    const convenience = placed.reduce((s, p) => {
      const def = this.defs.get(p.defCode);
      return s + (def?.facility?.kind === "rest" ? 1 : 0);
    }, 0);
    await this.db.updateTable("housing")
      .set({ layout: JSON.stringify(placed), convenience })
      .where("owner_id", "=", charId).execute();
    return { convenience };               // 편의도 → 회복 배율(050번 연계)
  }

  /** 입장(주인/방문자): 룸 세션 연결 */
  async enter(db: DB, charId: number, ownerId: number) {
    // 룸 존재 확인/생성(017번 Registry 위임) + 방문자 권한(초대 목록 검증)
    return { roomId: "housing:" + ownerId, isOwner: charId === ownerId };
  }
}`,
      },
    ],
    tips: [
      "배치 데이터는 '편집 완료 시 덤프 저장'이 정답이다 — 가구 하나당 UPDATE는 N+1 쓰기 폭탄이 된다.",
      "그리드 스냅(타일 단위) + 서버 재검증(겹침/벽)은 필수다 — 픽셀 자유 배치는 충돌 검증이 수학적으로 지옥이 된다.",
      "편의도(convenience) 같은 가구 누적 효과는 회복 배율(050번)로 자연스럽게 콘텐츠화된다.",
      "방문자 초대는 토큰(만료 24시간) 방식이 간단하고, 친구 목록 연동(054번)은 2단계로 추가한다.",
    ],
  },
  {
    id: "069",
    title: "캐주얼 미니게임(낚시 타이밍 미니게임 등) 상호작용",
    role: [
      "낚시 미니게임은 '기다림(랜덤 대기) → 입질 신호 → 타이밍 판정(성공 구간 밴드) → 결과(어종/등급)'의 사이클이다. 타이밍 판정은 막대(게이지)가 이동하는 동안 유저가 클릭한 순간의 위치가 성공 밴드에 들어가는지로 판정하며, 성공 밴드 폭과 막대 속도가 난이도 파라미터다. 서버는 시도 기록(시작/판정 시각)으로 검증해 자동화(매크로)를 통계로 잡아낸다(093번).",
      "구현 원칙은 '연출은 클라, 판정은 서버'다. 클라는 입질 확률/타이밍 창을 받아 게이지를 그리고, 클릭 시 로컬 판정 결과를 서버에 보고하면 서버는 시간 검증(입질 후 최소 150ms 이내 클릭은 인위적) + 밴드 재계산으로 최종 승인한다. 결과 보상은 어종 테이블(등급별 무게 분포)로 추출하고, 도감(030번)/미션(062번) 이벤트로 흘려보낸다.",
    ],
    blocks: [
      {
        lang: "src/game/Fishing.ts — 클라 미니게임 + 서버 검증",
        code: `import Phaser from "phaser";

export interface FishingWindow {
  startAt: number;         // 입질 시각(서버 기준)
  bandStart: number;       // 성공 밴드(0~1 정규화)
  bandWidth: number;
  speed: number;           // 마커 속도(초당 왕복 횟수)
  timeoutMs: number;       // 판정 제한
}

/** 클라: 게이지 렌더 + 클릭 판정 보고 */
export class FishingMinigame {
  private win: FishingWindow | null = null;
  private marker = 0;                       // 0~1
  private direction = 1;

  start(w: FishingWindow) { this.win = w; }

  update(dtMs: number) {
    if (!this.win) return;
    const dt = dtMs / 1000;
    this.marker += this.direction * this.win.speed * dt;
    if (this.marker > 1) { this.marker = 1; this.direction = -1; }
    if (this.marker < 0) { this.marker = 0; this.direction = 1; }
  }

  /** 클릭: 로컬 판정 + 서버 보고 */
  onClick(nowLocal: number) {
    if (!this.win) return null;
    const elapsed = nowLocal - this.win.startAt;
    const inBand = this.marker >= this.win.bandStart
                && this.marker <= this.win.bandStart + this.win.bandWidth;
    this.win = null;
    return { hit: inBand, marker: this.marker, elapsedMs: elapsed };
  }
}

/** 서버: 시간 검증 + 밴드 재계산으로 최종 승인 */
import { Kysely } from "kysely";
type DB = import("./schema").Database;
export class FishingAuthority {
  constructor(private db: Kysely<DB>, private rng: () => number = Math.random) {}

  verify(report: { hit: boolean; marker: number; elapsedMs: number },
         win: FishingWindow): boolean {
    if (report.elapsedMs > win.timeoutMs) return false;     // 제한 초과 무효
    if (report.elapsedMs < 120) return false;               // 인간 반응 하한(매크로 방지)
    // 서버가 밴드 재계산(마커는 속도로 역산)
    const pos = (report.elapsedMs / 1000 * win.speed) % 2;
    const serverMarker = pos <= 1 ? pos : 2 - pos;
    return report.hit
      && serverMarker >= win.bandStart
      && serverMarker <= win.bandStart + win.bandWidth;
  }

  /** 어종 추출: 등급 가중치 + 무게 분포 */
  rollFish(tierWeights: { tier: number; weight: number }[]) {
    const total = tierWeights.reduce((s, t) => s + t.weight, 0);
    let r = this.rng() * total;
    for (const t of tierWeights) if ((r -= t.weight) <= 0) {
      const weightG = Math.round(200 + this.rng() * 1800);  // 200g~2kg
      return { tier: t.tier, weightG };
    }
    return { tier: 1, weightG: 200 };
  }
}`,
      },
    ],
    tips: [
      "판정은 서버가 마커를 역산해 재계산한다 — 클라 보고값(hit)만 믿으면 매크로가 100% 성공률을 얻는다.",
      "인간 반응 하한(120ms) 검증은 가장 저렴한 매크로 필터이며, 093번 통계 탐지의 1차 데이터가 된다.",
      "입질 대기 시간은 지수 분포(평균 8~15초)가 체감상 자연스럽다 — 균일 분포는 리듬이 노출된다.",
      "성공 밴드 폭은 어종 등급별로(하급 넓게, 최상급 좁게) 두면 난이도 곡선이 자동 형성된다.",
    ],
  },
  {
    id: "070",
    title: "시즌 패스 / 배틀 패스 달성도 및 보상 지급 로직",
    role: [
      "배틀 패스는 '시즌(30~60일) → 레벨(경험치 티어) → 트랙(무료/프리미엄) → 보상'의 구조다. 패스 경험치는 미션(062번 이벤트 스키마 재사용)에서 누적되고, 레벨은 고정 필요치(예: 1000XP)의 단순 누적으로 계산한다. 각 레벨은 무료 트랙 보상 + 프리미엄 트랙 보상 2종을 가지며, 프리미엄은 시즌 내 구매(082번 결제)로 개방된다.",
      "지급 로직의 핵심은 '레벨 도달과 보상 수령의 분리'다. 도달은 자동이지만 수령은 유저가 클레임하며(재방문 유인), 클레임은 ledger ref 멱등 지급(060번 패턴)으로 이중 수령을 막는다. 프리미엄 구매 시점 이전에 달성한 레벨 보상도 소급 수령 가능해야 하며(구매 후 전 레벨 클레임 가능), 시즌 종료 시 미수령 보상은 우편으로 일괄 전환(배치)한다.",
    ],
    blocks: [
      {
        lang: "server/seasonpass/SeasonPass.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface SeasonDef {
  id: string;                       // "s3"
  startsAt: number; endsAt: number;
  xpPerLevel: number;               // 1000
  maxLevel: number;                 // 50
  tracks: {
    level: number;
    free: { gold?: number; itemCode?: string; qty?: number } | null;
    premium: { gold?: number; itemCode?: string; qty?: number } | null;
  }[];
}
export class SeasonPassService {
  constructor(private db: Kysely<DB>, private def: SeasonDef) {}

  /** 패스 XP 적립(미션 시스템에서 호출) */
  async addXp(charId: number, xp: number) {
    const now = Date.now();
    if (now < this.def.startsAt || now >= this.def.endsAt) return;
    await this.db.updateTable("season_pass")
      .set(eb => ({ xp: eb("xp", "+", xp) }))
      .where("character_id", "=", charId)
      .where("season_id", "=", this.def.id).execute();
  }

  /** 현재 레벨 계산(저장 xp → 레벨) */
  levelOf(xp: number): number {
    return Math.min(this.def.maxLevel, Math.floor(xp / this.def.xpPerLevel) + 1);
  }

  /** 보상 클레임: 트랙 권한(프리미엄) + 멱등 지급 + 소급 수령 */
  async claim(charId: number, level: number, track: "free" | "premium") {
    const row = await this.db.selectFrom("season_pass")
      .where("character_id", "=", charId).where("season_id", "=", this.def.id)
      .select(["xp", "premium"]).executeTakeFirst();
    if (!row) throw new Error("NO_PASS");
    if (this.levelOf(row.xp) < level) throw new Error("LEVEL_NOT_REACHED");
    if (track === "premium" && !row.premium) throw new Error("NEED_PREMIUM");

    const tier = this.def.tracks.find(t => t.level === level);
    if (!tier) throw new Error("NO_TIER");
    const reward = tier[track];
    if (!reward) throw new Error("EMPTY_REWARD");

    const ref = "sp:" + this.def.id + ":" + level + ":" + track + ":" + charId;
    const paid = await this.db.selectFrom("ledger")
      .where("ref", "=", ref).select("id").executeTakeFirst();
    if (paid) throw new Error("ALREADY_CLAIMED");

    await this.db.transaction().execute(async tx => {
      if (reward.gold) {
        await tx.updateTable("characters").set(eb => ({ gold: eb("gold", "+", reward.gold) }))
          .where("id", "=", charId).execute();
      }
      if (reward.itemCode) {
        await tx.updateTable("character_items")
          .set(eb => ({ qty: eb("qty", "+", reward.qty ?? 1) }))
          .where("character_id", "=", charId)
          .where("item_code", "=", reward.itemCode).execute();
      }
      await tx.insertInto("ledger").values({
        at: new Date(), kind: "gold", from_user: null, to_user: charId,
        ref, payload: JSON.stringify(reward),
      }).execute();
    });
    return reward;
  }

  /** 프리미엄 구매(082번 결제 검증 완료 후 호출) — 소급 개방 */
  async grantPremium(charId: number, paymentRef: string) {
    await this.db.updateTable("season_pass").set({ premium: true })
      .where("character_id", "=", charId).where("season_id", "=", this.def.id).execute();
    // 이전 레벨 프리미엄 보상은 클레임 목록에 소급 표시(수령은 유저 클레임)
    await this.db.insertInto("ledger").values({
      at: new Date(), kind: "gold", from_user: null, to_user: charId,
      ref: "sp:premium:" + paymentRef, payload: JSON.stringify({ season: this.def.id }),
    }).execute();
  }
}`,
      },
    ],
    tips: [
      "도달(자동)과 수령(클레임)의 분리는 재방문 유인이자 이중 지급 방지의 구조적 해법이다.",
      "프리미엄 소급 수령은 필수다 — 구매 시점 이전 레벨 보상을 못 받으면 결제 불만이 바로 터진다.",
      "시즌 종료 미수령 보상은 우편 전환 배치로 자동화해 CS(고객 문의)를 원천 차단한다.",
      "패스 XP는 062번 미션 이벤트 스키마에 태그 하나(dailyPass)로 붙여 이벤트 파이프라인을 공유한다.",
    ],
  },
];
