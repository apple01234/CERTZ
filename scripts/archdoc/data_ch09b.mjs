// 모듈 9 (086~090): 경제 및 BM(수익화) 시스템 — 후반부

export const items = [
  {
    id: "086",
    title: "귀속 / 비귀속 아이템 판정 및 거래 제한 상태 관리",
    role: [
      "귀속(binding)은 아이템의 이동 가능성을 정의하는 상태다. 비귀속(tradeable)은 모든 경로(거래/경매/창고/우편)로 이동 가능하고, 획득 귀속(acquire-bound)은 획득 즉시 귀속, 장착 귀속(equip-bound)은 장착한 순간 귀속된다. 판정은 단일 함수( canTrade(item) )로 수행하며, 모든 이동 경로(055번 거래, 056번 경매, 052번 창고, 우편)가 동일 함수를 호출해 규칙을 하나로 유지한다.",
      "거래 제한 상태는 귀속 외에도 여러 겹이다. 거래 쿨타임(획득 후 24시간 거래 불가 — RMT 차단), 스택 분해(스택 아이템의 부분 거래), 상한가/하한가(087번), 기간제 아이템(만료 시 소각) 등이다. 상태는 item row의 칼럼(bound_at, acquired_at, expires_at)으로 관리하며, 귀속 전환은 이벤트(장착/사용) 훅에서 원자적으로 기록된다.",
    ],
    blocks: [
      {
        lang: "server/item/Binding.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export type BindingKind = "tradeable" | "acquire_bound" | "equip_bound";

export interface ItemDefBinding {
  code: string;
  binding: BindingKind;
  tradeCooldownMs?: number;          // 획득 후 거래 쿨타임(RMT 방지)
  expiresAtMs?: number;              // 기간제(0 = 무기한)
}
export interface ItemRuntime {
  id: number; itemCode: string;
  binding: BindingKind;
  boundAt: number | null;            // 귀속 시각(null = 미귀속)
  acquiredAt: number;                // 획득 시각(쿨타임 계산)
  expiresAt: number | null;
  equipLockedPart?: string | null;   // 장착 중 부위(장착 귀속 판정)
}

export class BindingPolicy {
  /** 귀속 판정: 정의 + 런타임 상태 합산 */
  static isBound(rt: ItemRuntime): boolean {
    if (rt.binding === "acquire_bound") return true;
    if (rt.binding === "equip_bound" && rt.boundAt != null) return true;
    return false;
  }

  /** 거래 가능 판정(모든 이동 경로의 공통 게이트) */
  static canTrade(rt: ItemRuntime, def: ItemDefBinding, now: number):
    { ok: boolean; reason?: string } {
    if (BindingPolicy.isBound(rt)) return { ok: false, reason: "bound" };
    const cooldown = def.tradeCooldownMs ?? 0;
    if (now - rt.acquiredAt < cooldown)
      return { ok: false, reason: "trade_cooldown" };
    if (rt.expiresAt && rt.expiresAt <= now) return { ok: false, reason: "expired" };
    return { ok: true };
  }

  /** 장착 이벤트 훅: 장착 귀속 전환(원자적 기록) */
  static async onEquip(db: Kysely<DB>, itemId: number, now: number) {
    const it = await db.selectFrom("character_items").where("id", "=", itemId)
      .forUpdate().select(["binding", "bound_at"]).executeTakeFirstOrThrow();
    if (it.binding === "equip_bound" && it.bound_at == null) {
      await db.updateTable("character_items").set({ bound_at: new Date(now) })
        .where("id", "=", itemId).execute();
    }
  }
}`,
      },
      {
        lang: "PostgreSQL DDL — 상태 칼럼",
        code: `ALTER TABLE character_items
  ADD COLUMN binding      VARCHAR(16) NOT NULL DEFAULT 'tradeable',
  ADD COLUMN bound_at     TIMESTAMPTZ,        -- 귀속 전환 시각
  ADD COLUMN acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN expires_at   TIMESTAMPTZ;        -- 기간제 아이템

-- 기간제 아이템 만료 소각(크론 시간당)
-- DELETE FROM character_items WHERE expires_at IS NOT NULL AND expires_at <= now();
-- 대량 테이블이므로 배치 삭제 + ledger 기록으로 실제 구현`,
      },
    ],
    tips: [
      "규칙 판정은 BindingPolicy.canTrade 한 곳으로 — 경로별로 따로 만들면 '거래는 되는데 경매는 안 되는' 불일치가 난다.",
      "장착 귀속은 이벤트 훅에서 bound_at을 기록해야 CS에서 '언제 귀속됐는지'를 증명할 수 있다.",
      "거래 쿨타임(획득 후 24시간)은 RMT(현금거래) 흐름을 끊는 가장 효과적인 완충 장치다.",
      "기간제 아이템은 만료 소각을 크론으로 처리하되, 만료 24시간 전 알림(080번 푸시)을 함께 두면 불만이 사라진다.",
    ],
  },
  {
    id: "087",
    title: "어뷰징/현금거래 방지용 거래소 시세 상하한가 제어 로직",
    role: [
      "시세 상하한가는 '기준 시세 대비 등록/거래 가능 가격의 밴드'로, 시세 조작(자기 매수 반복)과 RMT(극단가 거래)를 동시에 차단한다. 기준 시세는 056번 marketPrice(최근 24h 거래가 평균)이며, 밴드는 기본 ±30%(등록)와 ±60%(거래 허용 임계) 이중으로 둔다. 밴드 밖 가격은 등록 자체가 거부되고, 이유(UI 안내: 시세 밖 가격입니다)를 명확히 전달한다.",
      "고급 장치는 유동성 부족 보호다. 거래량이 적은 아이템은 24h 평균이 왜곡되기 쉬우므로, 최소 표본(거래 5건) 미만이면 7일 평균으로 폴백하고 그것도 부족하면 item_def 기준가(정가)를 사용한다. 또한 '가격 급변 감지(1시간 내 평균 대비 ±50%)'는 시세 조작 시도 알림(094번 어드민)으로 연결된다. 시세 밴드는 카테고리별로 다르게 설정해 고가 희귀품은 완화한다.",
    ],
    blocks: [
      {
        lang: "server/auction/PriceGuard.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface PriceBand {
  min: number; max: number;
  basePrice: number; source: "24h" | "7d" | "def_price";
  sampleCount: number;
}

export class PriceGuard {
  /** 등록 밴드(±30%), 거래 밴드(±60%) */
  private static REGISTER_BAND = 0.30;
  private static TRADE_BAND = 0.60;
  private static MIN_SAMPLES = 5;

  constructor(private db: Kysely<DB>,
              private defPrice: (itemCode: string) => number) {}

  /** 기준 시세 산출: 24h → 7d → 정가 폴백(유동성 보호) */
  async basePrice(itemCode: string): Promise<PriceBand> {
    const day = await this.avg(itemCode, 1);
    if (day && day.count >= PriceGuard.MIN_SAMPLES) {
      return this.band(day.avg, "24h", day.count);
    }
    const week = await this.avg(itemCode, 7);
    if (week && week.count >= PriceGuard.MIN_SAMPLES) {
      return this.band(week.avg, "7d", week.count);
    }
    return this.band(this.defPrice(itemCode), "def_price", 0);
  }
  private band(base: number, source: PriceBand["source"], n: number): PriceBand {
    return {
      basePrice: Math.round(base),
      source, sampleCount: n,
      min: Math.max(1, Math.round(base * (1 - PriceGuard.REGISTER_BAND))),
      max: Math.round(base * (1 + PriceGuard.REGISTER_BAND)),
    };
  }
  private async avg(itemCode: string, days: number) {
    const row = await this.db.selectFrom("auction_trades")
      .innerJoin("auction_listings", "auction_trades.listing_id", "auction_listings.id")
      .where("auction_listings.item_code", "=", itemCode)
      .where("auction_trades.at", ">=",
             new Date(Date.now() - days * 86400000))
      .select(eb => [
        eb.fn.avg("final_price").as("avg"),
        eb.fn.count("auction_trades.id").as("cnt"),
      ]).executeTakeFirst();
    return row && Number(row.cnt) > 0
      ? { avg: Number(row.avg), count: Number(row.cnt) } : null;
  }

  /** 등록 검증(056번 등록 경로에서 호출) */
  async validateListing(itemCode: string, price: number):
    Promise<{ ok: boolean; reason?: string; hint?: PriceBand }> {
    const band = await this.basePrice(itemCode);
    if (price < band.min) return { ok: false, reason: "below_floor", hint: band };
    if (price > band.max) return { ok: false, reason: "above_ceiling", hint: band };
    return { ok: true, hint: band };
  }

  /** 가격 급변 감지(시세 조작 알림) — 1h 평균 vs 이전 1h */
  async detectAnomaly(itemCode: string): Promise<boolean> {
    const now = await this.avg(itemCode, 1 / 24);
    const prev = await this.avgRange(itemCode,
      Date.now() - 2 * 3600000, Date.now() - 1 * 3600000);
    if (!now || !prev) return false;
    const swing = Math.abs(now.avg - prev.avg) / Math.max(1, prev.avg);
    return swing > 0.5;                     // ±50% 급변
  }
  private async avgRange(itemCode: string, from: number, to: number) {
    const row = await this.db.selectFrom("auction_trades")
      .innerJoin("auction_listings", "auction_trades.listing_id", "auction_listings.id")
      .where("auction_listings.item_code", "=", itemCode)
      .where("auction_trades.at", ">=", new Date(from))
      .where("auction_trades.at", "<", new Date(to))
      .select(eb => [eb.fn.avg("final_price").as("avg")]).executeTakeFirst();
    return row ? { avg: Number(row.avg) } : null;
  }
}`,
      },
    ],
    tips: [
      "밴드 폴백 체인(24h → 7d → 정가) 없이는 신규 아이템이 '시세 없음'으로 등록 자체가 불가능해진다.",
      "등록 밴드(±30%)와 거래 밴드(±60%)를 분리하면 '이미 등록된 것의 급락'과 '신규 등록 조작'을 다르게 통제할 수 있다.",
      "급변 감지는 자동 제재가 아니라 어드민(094번) 알림으로 — 오탐(이벤트로 인한 자연 급등)을 사람이 판단한다.",
      "시세 표시 UI에 표본 수(최근 거래 N건 기준)를 함께 보여주면 '가짜 시세' 불신을 예방한다.",
    ],
  },
  {
    id: "088",
    title: "이벤트 코인 교환소 기간 제한 매커니즘",
    role: [
      "이벤트 코인 교환소는 '획득(코인 드롭) → 교환(코인 → 아이템) → 만료(잔여 코인 소각)'의 기간제 경제다. 교환소 상품은 (상품 코드, 코인 가격, 구매 한도(1인/전체), 재고)로 정의되고, 이벤트 기간(start~end) 동안만 거래가 가능하다. 종료 시점 이후에는 교환 API가 기간 검증에서 거부되고, 잔여 코인은 만료 배치에서 0으로 소각해(081번 ledger 기록) 다음 이벤트로 이월되지 않게 한다.",
      "설계 포인트는 세 가지다. 첫째, 전체 재고 한도(서버 전체 판매량 제한)로 희소품 가치를 유지한다. 둘째, 구매 한도는 1인 기준 + 서버 재고의 원자적 차감(UPDATE WHERE stock >= n)으로 동시 구매 경쟁을 안전하게 처리한다. 셋째, 교환은 이벤트 종료 직전(마지막 24시간) 트래픽 폭증이 예상되므로, 상품별 캐시(재고/한도 Redis)로 DB 부담을 분산한다.",
    ],
    blocks: [
      {
        lang: "server/exchange/CoinExchange.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface ExchangeDef {
  eventId: string;
  startsAt: number; endsAt: number;
  goods: {
    code: string;                       // 상품 코드
    coinCost: number;                   // 코인 가격
    perUserLimit?: number;              // 1인 구매 한도
    stock?: number;                     // 전체 재고(null = 무제한)
    itemCode: string; qty: number;
  }[];
}
export class CoinExchange {
  constructor(private db: Kysely<DB>, private def: ExchangeDef,
              private wallet: import("../economy/Wallet").Wallet) {}

  /** 교환: 기간 → 한도 → 재고 → 코인 소모 → 지급(단일 트랜잭션) */
  async exchange(charId: number, goodsCode: string) {
    const now = Date.now();
    if (now < this.def.startsAt) throw new Error("NOT_OPENED");
    if (now >= this.def.endsAt) throw new Error("EXPIRED");      // 기간 만료

    const g = this.def.goods.find(x => x.code === goodsCode);
    if (!g) throw new Error("NO_GOODS");

    return this.db.transaction().execute(async tx => {
      // 1) 1인 한도 검증
      if (g.perUserLimit) {
        const bought = await tx.selectFrom("exchange_purchases")
          .where("character_id", "=", charId)
          .where("event_id", "=", this.def.eventId)
          .where("goods_code", "=", goodsCode)
          .select(eb => eb.fn.sum("qty").as("n")).executeTakeFirst();
        if (Number(bought?.n ?? 0) + g.qty > g.perUserLimit)
          throw new Error("LIMIT_REACHED");
      }
      // 2) 전체 재고 원자적 차감
      if (g.stock != null) {
        const upd = await tx.updateTable("exchange_stock")
          .set(eb => ({ remaining: eb("remaining", "-", g.qty) }))
          .where("event_id", "=", this.def.eventId)
          .where("goods_code", "=", goodsCode)
          .where("remaining", ">=", g.qty)
          .returning("remaining").executeTakeFirst();
        if (!upd) throw new Error("SOLD_OUT");
      }
      // 3) 코인 소모(081번 spend — 잔액 부족 시 예외)
      await this.wallet.spend({ type: "event", id: charId },
        "event_coin", g.coinCost, "exchange:" + this.def.eventId,
        "ex:" + this.def.eventId + ":" + goodsCode + ":" + charId + ":" + Date.now());
      // 4) 아이템 지급
      await tx.updateTable("character_items")
        .set(eb => ({ qty: eb("qty", "+", g.qty) }))
        .where("character_id", "=", charId)
        .where("item_code", "=", g.itemCode).execute();
      await tx.insertInto("exchange_purchases").values({
        character_id: charId, event_id: this.def.eventId,
        goods_code: goodsCode, qty: g.qty, at: new Date(),
      }).execute();
      return { itemCode: g.itemCode, qty: g.qty };
    });
  }

  /** 만료 배치(크론): 이벤트 종료 후 잔여 코인 소각 */
  async expireEvent() {
    const now = Date.now();
    if (now < this.def.endsAt) return;
    // 코인 잔액 전체 소각 + ledger 기록(sink: ev_expire)
    // UPDATE wallets SET balance = 0 WHERE currency='event_coin'
    //   AND owner_type='event' AND owner_id IN (이벤트 참여자);
    // 실제 구현은 페이지네이션 배치(수만 건)로 분할 수행
  }
}`,
      },
    ],
    tips: [
      "기간 검증은 서버 단일 시각으로 — 클라 시계 조작으로 만료 후 교환하는 것을 차단한다.",
      "전체 재고 차감은 UPDATE ... WHERE remaining >= n으로 — SELECT 후 UPDATE는 동시 구매에서 초판매가 발생한다.",
      "잔여 코인 소각은 반드시 ledger 기록(reason: ev_expire)으로 — 이벤트 경제 회고(085번)의 핵심 데이터다.",
      "마지막 24시간 트래픽 폭증 대비 상품별 재고 캐시(Redis) + DB 원자 차감의 이중 구조가 안전하다.",
    ],
  },
  {
    id: "089",
    title: "무료/프리미엄 배틀패스 보상 트랙 분기 처리",
    role: [
      "배틀패스 트랙 분기는 '같은 레벨 구간에서 무료 트랙과 프리미엄 트랙이 다른 보상을 지급'하는 구조다(070번 기본 파이프라인의 확장). 핵심 차별점은 세 가지다. (1) 프리미엄 전용 레벨 구간(무료는 30레벨, 프리미엄은 50레벨까지), (2) 프리미엄 보상의 가치(외형/탈것 등), (3) 프리미엄 XP 가속(+20% 등)의 이중 이점이다. 분기 판정은 claim 시점에 트랙 권한(구독 여부)으로 수행한다.",
      "추가 요건은 시즌 종료 후 처리다. 무료 트랙 미수령 보상은 우편 일괄 전환, 프리미엄 미수령 보상은 '다음 시즌 구매 시 소급 클레임 가능' 기간(7일)을 두는 정책이 표준이다. 트랙 데이터는 JSON 정의로 관리해 시즌마다 리밸런싱이 코드 수정 없이 가능하며, 레벨별 보상이 비어있으면(null) 스킵 마커로 UI에 표시한다.",
    ],
    blocks: [
      {
        lang: "server/seasonpass/TrackPolicy.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface TrackReward { gold?: number; itemCode?: string; qty?: number; }
export interface SeasonTracks {
  seasonId: string;
  freeMaxLevel: number;                 // 무료 트랙 상한(30)
  maxLevel: number;                     // 프리미엄 상한(50)
  premiumXpBoost: number;               // 0.2 = +20%
  levels: { free: TrackReward | null; premium: TrackReward | null }[];
}

export class TrackPolicy {
  constructor(private db: Kysely<DB>, private tracks: SeasonTracks,
              private wallet: import("../economy/Wallet").Wallet) {}

  /** XP 적립: 프리미엄 가속 적용(062번 미션 이벤트에서 호출) */
  async addXp(charId: number, baseXp: number) {
    const row = await this.db.selectFrom("season_pass")
      .where("character_id", "=", charId).where("season_id", "=", this.tracks.seasonId)
      .select(["xp", "premium"]).executeTakeFirst();
    const boost = row?.premium ? 1 + this.tracks.premiumXpBoost : 1;
    const gained = Math.floor(baseXp * boost);
    await this.db.updateTable("season_pass")
      .set(eb => ({ xp: eb("xp", "+", gained) }))
      .where("character_id", "=", charId).where("season_id", "=", this.tracks.seasonId)
      .execute();
    return gained;
  }

  /** 트랙 분기 클레임(070번 claim 확장 — 상한 레벨 구간 처리) */
  async claim(charId: number, level: number, track: "free" | "premium") {
    const row = await this.db.selectFrom("season_pass")
      .where("character_id", "=", charId).where("season_id", "=", this.tracks.seasonId)
      .select(["xp", "premium"]).executeTakeFirstOrThrow();
    const userLevel = Math.min(this.levelOf(row.xp), this.tracks.maxLevel);

    // 무료 트랙은 freeMaxLevel 이후 구간 자체가 없음
    if (track === "free" && level > this.tracks.freeMaxLevel)
      throw new Error("FREE_TRACK_LIMIT");
    // 프리미엄 전용 구간(31~50): 무료 유저는 도달 불가 개념
    if (track === "premium" && !row.premium) throw new Error("NEED_PREMIUM");
    if (userLevel < level) throw new Error("LEVEL_NOT_REACHED");

    const tier = this.tracks.levels[level - 1];
    const reward = tier[track];
    if (!reward) throw new Error("EMPTY_REWARD");
    const ref = "sp:" + this.tracks.seasonId + ":" + level + ":" + track + ":" + charId;
    await this.wallet.grant({ type: "char", id: charId }, "gold",
      reward.gold ?? 0, "season_pass", ref);
    return reward;
  }

  /** 시즌 종료 배치: 미수령 보상 우편 전환(멱등) */
  async sweepUnclaimed() {
    // 실제 구현: season_pass 전체 순회 → levelOf(xp) 이하 레벨 중
    // ledger에 ref 없는 보상을 우편 테이블로 이관
    // 무료/프리미엄 각각 처리, 프리미엄은 premium 여부 확인
  }
  private levelOf(xp: number): number {
    const lv = Math.floor(xp / 1000) + 1;          // 070번 xpPerLevel 재사용
    return Math.min(this.tracks.maxLevel, lv);
  }
}`,
      },
    ],
    tips: [
      "무료 트랙 상한(30레벨)과 프리미엄 상한(50레벨)의 격차가 프리미엄 가치의 본질이다 — 같은 상한이면 구매 동기가 없다.",
      "프리미엄 XP 가속(+20%)은 '구매 후 성장 속도' 이점으로, 트랙 보상 외에 체감 이점을 하나 더 준다.",
      "빈 보상(null) 스킵 마커를 UI에 명확히 표시해 '보상 누락' 클레임을 예방한다.",
      "시즌 정의는 JSON 데이터로 관리해 리밸런싱(레벨 보상 조정)이 배포 없이 이뤄지게 한다.",
    ],
  },
  {
    id: "090",
    title: "스테미너 / 피로도 자동 회복 및 차감 연산",
    role: [
      "스테미너는 '행동 게이팅(던전 진입, 보스 도전 횟수) + 시간 자동 회복(분당 n점)'의 자원이다. 핵심 연산은 '오프라인 회복'이다. 접속 종료 중에도 시간이 흐르므로, 재접속 시 (현재 시각 - 마지막 회복 시각) / 회복 주기로 회복량을 계산하고 상한(예: 120)까지 클램프한다. 저장은 '현재 잔량 + 마지막 회복 시각' 두 값만 유지하면 계산이 프레임율/접속 패턴과 무관하게 결정론적으로 성립한다.",
      "차감은 서버 권위로 — 던전 진입 요청 시 잔량 검증 + 원자적 차감을 한 트랜잭션으로 수행한다. 회복 속도 부스트(VIP/아이템)는 '회복 주기 단축'과 '상한 증가'의 두 파라미터로 모델링하며, 스테미너 충전 아이템은 상한 초과 허용 여부를 정책으로 명시한다(보통 상한 초과 허용, 최대 2배).",
    ],
    blocks: [
      {
        lang: "server/stamina/Stamina.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface StaminaConfig {
  max: number;                 // 자연 상한 120
  regenMs: number;             // 6분당 1점 회복
  hardCapMult: number;         // 아이템 충전 상한 배율(2.0)
}

export class StaminaService {
  constructor(private db: Kysely<DB>, private cfg: StaminaConfig) {}

  /** 현재 스테미너 계산(저장값 + 오프라인 회복 재구성) */
  async current(charId: number, regenBoost = 1): Promise<number> {
    const row = await this.db.selectFrom("stamina")
      .where("character_id", "=", charId)
      .select(["value", "last_regen_at"]).executeTakeFirst();
    if (!row) return this.cfg.max;             // 신규 = 풀 충전
    const elapsed = Date.now() - row.last_regen_at.getTime();
    const regen = Math.floor(elapsed / (this.cfg.regenMs / regenBoost));
    return Math.min(this.cfg.max, row.value + regen);
  }

  /** 접속 시 동기화: 계산 결과를 저장(이후 차감은 저장값 기준) */
  async sync(charId: number, regenBoost = 1): Promise<number> {
    const value = await this.current(charId, regenBoost);
    await this.db.insertInto("stamina").values({
      character_id: charId, value, last_regen_at: new Date(),
    }).onConflict(oc => oc.doUpdate().set({
      value,
      last_regen_at: value >= this.cfg.max
        ? new Date()                          // 상한 도달 — 회복 시각 리셋
        : this.lastRegenShift(charId, regenBoost),
    })).execute();
    return value;
  }
  private async lastRegenShift(charId: number, boost: number) {
    const row = await this.db.selectFrom("stamina")
      .where("character_id", "=", charId).select("last_regen_at").executeTakeFirst();
    const prev = row?.last_regen_at.getTime() ?? Date.now();
    const consumed = Math.floor((Date.now() - prev) / (this.cfg.regenMs / boost))
      * (this.cfg.regenMs / boost);
    return new Date(prev + consumed);
  }

  /** 차감(던전 진입 등) — 원자적 검증 + 차감 */
  async consume(charId: number, cost: number): Promise<boolean> {
    return this.db.transaction().execute(async tx => {
      const row = await tx.selectFrom("stamina")
        .where("character_id", "=", charId)
        .forUpdate().select(["value", "last_regen_at"]).executeTakeFirstOrThrow();
      // 저장값을 현재 시점으로 갱신 후 검증
      const elapsed = Date.now() - row.last_regen_at.getTime();
      const regen = Math.floor(elapsed / this.cfg.regenMs);
      const value = Math.min(this.cfg.max, row.value + regen);
      if (value < cost) return false;                       // 부족
      const next = value - cost;
      const consumedMs = regen * this.cfg.regenMs;
      await tx.updateTable("stamina").set({
        value: next,
        last_regen_at: new Date(row.last_regen_at.getTime() + consumedMs),
      }).where("character_id", "=", charId).execute();
      return true;
    });
  }

  /** 충전 아이템: 상한 배율(hardCap)까지 허용 */
  async charge(charId: number, amount: number): Promise<number> {
    const row = await this.db.selectFrom("stamina")
      .where("character_id", "=", charId)
      .forUpdate().select(["value", "last_regen_at"]).executeTakeFirstOrThrow();
    const cap = this.cfg.max * this.cfg.hardCapMult;
    const next = Math.min(cap, row.value + amount);
    await this.db.updateTable("stamina").set({ value: next })
      .where("character_id", "=", charId).execute();
    return next;
  }
}`,
      },
    ],
    tips: [
      "저장은 '잔량 + 마지막 회복 시각' 두 값으로 충분하다 — 분당 회복량을 전부 저장하면 데이터가 계속 변한다.",
      "회복 소수점 처리는 '소모된 ms를 last_regen_at에 반영'으로 — 매 계산마다 잔여 시간이 유실되지 않는다.",
      "차감은 forUpdate + 잔량 검증으로 — 동시 던전 진입 요청에서 음수 스테미너가 발생하지 않는다.",
      "상한 도달 시 last_regen_at을 리셋해야 '상한 도달 후 다시 빠지면 즉시 회복되는' 무한 회복 버그가 막힌다.",
    ],
  },
];
