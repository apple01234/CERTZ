// 모듈 9 (081~085): 경제 및 BM(수익화) 시스템 — 전반부
// 스택: Node.js, Kysely(PostgreSQL), 외부 결제 PG/IAP API

export const items = [
  {
    id: "081",
    title: "다중 재화(골드, 캐시, 이벤트 코인, 길드 포인트) 관리 시스템",
    role: [
      "재화 시스템은 '재화 정의(특성: 저장소, 상한, 소스/싱크) + 잔액 변경 API(단일 진입점) + 흐름 로그(ledger)'의 3계층이다. 골드/캐시는 유저 계정, 길드 포인트는 길드, 이벤트 코인은 이벤트 기간 캐릭터 단위 등 저장소 주체가 다르므로, 변경 API는 (ownerType, ownerId, currency, delta, reason)의 범용 시그니처로 단일화한다. 모든 변경은 트랜잭션 + CHECK 제약(음수 금지) + ledger 기록으로 안전장치를 삼중으로 둔다.",
      "핵심은 '지급(grant)과 소모(spend)의 분리된 진입점'이다. 소모는 잔액 검증 + 원자적 차감이 하나의 UPDATE 문(WHERE balance >= n)으로 수행되어 동시 요청에서 음수가 발생할 수 없다. 지급은 이벤트 소스(퀘스트, 보상, 결제)를 reason으로 남겨 감사·복구·인플레이션 분석(085번)의 원천 데이터가 된다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE wallets (
  owner_type  VARCHAR(10) NOT NULL,   -- char | guild | event
  owner_id    BIGINT NOT NULL,
  currency    VARCHAR(12) NOT NULL,   -- gold | cash | event_coin | guild_pt
  balance     BIGINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0, -- 낙관적 잠금(필요 시)
  PRIMARY KEY (owner_type, owner_id, currency)
);
ALTER TABLE wallets ADD CONSTRAINT chk_balance CHECK (balance >= 0);

CREATE TABLE currency_ledger (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_type  VARCHAR(10) NOT NULL,
  owner_id    BIGINT NOT NULL,
  currency    VARCHAR(12) NOT NULL,
  delta       BIGINT NOT NULL,        -- 양수 지급 / 음수 소모
  reason      VARCHAR(30) NOT NULL,   -- quest | shop | trade | pay | sink_...
  ref         VARCHAR(60),            -- 멱등 키
  balance_after BIGINT NOT NULL       -- 변경 후 잔액(감사)
);
CREATE INDEX idx_ledger_owner ON currency_ledger(owner_type, owner_id, at);
CREATE UNIQUE INDEX uq_ledger_ref ON currency_ledger(ref) WHERE ref IS NOT NULL;`,
      },
      {
        lang: "server/economy/Wallet.ts — Kysely 단일 진입점",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export type OwnerType = "char" | "guild" | "event";
export type Currency = "gold" | "cash" | "event_coin" | "guild_pt";

export class WalletError extends Error {
  constructor(code: "NO_FUNDS" | "NO_WALLET" | "OVER_CAP") { super(code); }
}

export class Wallet {
  constructor(private db: Kysely<DB>, private caps: Map<Currency, number> = new Map()) {}

  /** 소모: 잔액 검증 + 원자적 차감(WHERE balance >= n) */
  async spend(owner: { type: OwnerType; id: number }, c: Currency, amount: number,
              reason: string, ref?: string): Promise<number> {
    if (amount <= 0) throw new Error("amount must be positive");
    return this.db.transaction().execute(async tx => {
      const upd = await tx.updateTable("wallets")
        .set(eb => ({ balance: eb("balance", "-", amount) }))
        .where(eb => eb.and([
          eb("owner_type", "=", owner.type),
          eb("owner_id", "=", owner.id),
          eb("currency", "=", c),
          eb("balance", ">=", amount),
        ]))
        .returning("balance").executeTakeFirst();
      if (!upd) throw new WalletError("NO_FUNDS");
      await this.log(tx, owner, c, -amount, reason, ref, upd.balance);
      return upd.balance;
    });
  }

  /** 지급: 상한 클램프 + 멱등(ref 중복 무시) */
  async grant(owner: { type: OwnerType; id: number }, c: Currency, amount: number,
              reason: string, ref?: string): Promise<number> {
    if (amount <= 0) throw new Error("amount must be positive");
    if (ref) {
      const paid = await this.db.selectFrom("currency_ledger")
        .where("ref", "=", ref).select("id").executeTakeFirst();
      if (paid) return -1;                          // 이미 지급됨(멱등)
    }
    return this.db.transaction().execute(async tx => {
      // 지갑 보장(없으면 생성)
      await tx.insertInto("wallets").values({
        owner_type: owner.type, owner_id: owner.id, currency: c, balance: 0,
      }).onConflict(oc => oc.doNothing()).execute();
      const cap = this.caps.get(c) ?? Number.MAX_SAFE_INTEGER;
      const cur = await tx.selectFrom("wallets")
        .where(eb => eb.and([
          eb("owner_type", "=", owner.type), eb("owner_id", "=", owner.id),
          eb("currency", "=", c)]))
        .forUpdate().select("balance").executeTakeFirstOrThrow();
      const next = Math.min(cap, cur.balance + amount);
      await tx.updateTable("wallets").set({ balance: next })
        .where(eb => eb.and([
          eb("owner_type", "=", owner.type), eb("owner_id", "=", owner.id),
          eb("currency", "=", c)]))
        .execute();
      await this.log(tx, owner, c, next - cur.balance, reason, ref, next);
      return next;
    });
  }

  private async log(tx: any, owner: { type: OwnerType; id: number },
                    c: Currency, delta: number, reason: string,
                    ref: string | undefined, after: number) {
    await tx.insertInto("currency_ledger").values({
      owner_type: owner.type, owner_id: owner.id, currency: c,
      delta, reason, ref: ref ?? null, balance_after: after, at: new Date(),
    }).execute();
  }
}`,
      },
    ],
    tips: [
      "소모는 UPDATE ... WHERE balance >= n의 영향 행으로 판정한다 — SELECT-then-UPDATE는 동시 요청에서 반드시 구멍이 난다.",
      "CHECK(balance >= 0)는 앱 버그의 최후 방어선이며, 지급 상한(caps)은 캐시 계정 도용 피해 한도로도 기능한다.",
      "ledger의 balance_after 칼럼이 있으면 잔액 불일치 사고 시 '어느 시점에 어긋났는지'를 순회로 재구성할 수 있다.",
      "이벤트 코인은 기간 만료 시 소각 배치(0×잔액)를 둬야 기간제 재화가 다음 이벤트로 유출되지 않는다.",
    ],
  },
  {
    id: "082",
    title: "웹 PG 결제 API 및 모바일 인앱 결제(IAP) 영수증 서버 검증",
    role: [
      "결제 파이프라인은 '주문 생성(서버) → 결제 수행(웹 PG or 스토어 IAP) → 영수증 검증(서버 → PG/스토어 API) → 재화 지급(멱등)'의 4단계다. 웹 PG(토스/페이팔 등)는 결제 승인 API를 서버에서 재호출해 금액·상태를 검증하고, 모바일 IAP(구글/애플)는 영수증/토큰을 스토어 검증 API로 확인한다. 검증 성공 시에만 지급하며, 지급은 orderId 기준 멱등(중복 요청 무시)으로 처리한다.",
      "보안 원칙은 세 가지다. 첫째, 금액/상품은 클라가 아니라 서버 주문 테이블이 단일 진실이다 — 클라가 보낸 금액은 절대 신뢰하지 않는다. 둘째, 검증 실패/타임아웃은 주문을 pending으로 남겨 재조정(reconcile) 배치가 나중에 처리한다. 셋째, 환불(refund) 이벤트를 웹훅으로 받아 지급된 재화를 차감(음수 허용 로그)한다.",
    ],
    blocks: [
      {
        lang: "server/pay/PaymentService.ts",
        code: `import { Kysely } from "kysely";
import crypto from "node:crypto";
type DB = import("../schema").Database;

export interface OrderRow {
  order_id: string; char_id: number; sku: string;
  amount: number; currency: string;
  status: "pending" | "verified" | "granted" | "failed" | "refunded";
  provider: "webpg" | "google" | "apple";
  created_at: Date;
}

export class PaymentService {
  constructor(private db: Kysely<DB>,
              private pg: { confirmPayment(orderId: string, amount: number): Promise<{ ok: boolean; raw: string }> },
              private stores: {
                google: (token: string, sku: string) => Promise<{ ok: boolean; orderId: string }>;
                apple: (receipt: string) => Promise<{ ok: boolean; orderId: string }>;
              },
              private wallet: import("../economy/Wallet").Wallet,
              private skuTable: Map<string, { price: number; cash: number; bonusCash?: number }>) {}

  /** 1) 주문 생성(서버가 금액 결정 — 클라 금액 무시) */
  async createOrder(charId: number, sku: string) {
    const item = this.skuTable.get(sku);
    if (!item) throw new Error("UNKNOWN_SKU");
    const orderId = crypto.randomUUID();
    await this.db.insertInto("orders").values({
      order_id: orderId, char_id: charId, sku,
      amount: item.price, currency: "KRW", status: "pending", provider: "webpg",
      created_at: new Date(),
    }).execute();
    return { orderId, amount: item.price };       // PG SDK에 이 금액으로 결제 위임
  }

  /** 2) 웹 PG 결제 콜백: 서버 승인 재검증 → 지급 */
  async confirmWeb(orderId: string) {
    const order = await this.db.selectFrom("orders")
      .where("order_id", "=", orderId).select().executeTakeFirst();
    if (!order || order.status !== "pending") throw new Error("BAD_ORDER");
    const res = await this.pg.confirmPayment(orderId, order.amount);
    if (!res.ok) {
      await this.setStatus(orderId, "failed");
      throw new Error("PG_DECLINED");
    }
    return this.grantForOrder(orderId);
  }

  /** 3) IAP 영수증 검증(스토어 API) → 지급 */
  async confirmIap(provider: "google" | "apple", charId: number, token: string, sku: string) {
    const store = this.stores[provider];
    const verified = await store(token, sku);
    if (!verified.ok) throw new Error("RECEIPT_INVALID");
    // 스토어 orderId를 멱등 키로 사용(재전송 무시)
    const orderId = verified.orderId;
    const dup = await this.db.selectFrom("orders")
      .where("order_id", "=", orderId).select("status").executeTakeFirst();
    if (dup && dup.status === "granted") return { already: true };
    await this.db.insertInto("orders").values({
      order_id: orderId, char_id: charId, sku, amount: this.skuTable.get(sku)!.price,
      currency: "USD", status: "verified", provider, created_at: new Date(),
    }).onConflict(oc => oc.doNothing()).execute();
    return this.grantForOrder(orderId);
  }

  /** 4) 지급(멱등) — cash = 상품 캐시 + 이벤트 보너스 */
  private async grantForOrder(orderId: string) {
    const order = await this.db.selectFrom("orders")
      .where("order_id", "=", orderId).executeTakeFirstOrThrow();
    const sku = this.skuTable.get(order.sku)!;
    await this.wallet.grant(
      { type: "char", id: order.char_id }, "cash",
      sku.cash + (sku.bonusCash ?? 0), "pay", "pay:" + orderId);
    await this.setStatus(orderId, "granted");
    return { granted: sku.cash + (sku.bonusCash ?? 0) };
  }
  private async setStatus(orderId: string, s: OrderRow["status"]) {
    await this.db.updateTable("orders").set({ status: s })
      .where("order_id", "=", orderId).execute();
  }
}`,
      },
    ],
    tips: [
      "주문 금액은 서버가 결정한다 — 클라 금액을 승인 API에 그대로 쓰면 조작 결제가 즉시 가능해진다.",
      "IAP 멱등 키는 스토어 orderId — 앱 재시도/서버 재시도 양쪽에서 이중 지급이 차단된다.",
      "pending 주문에 대한 재조정 배치(5분 주기, PG 상태 재확인)는 결제 성공했는데 콜백이 유실된 사고의 유일한 회복 수단이다.",
      "환불 웹훅 처리(재화 음수 차감 + 사용 잔액 부채 기록)는 상점 도용 경제를 막는 필수 요소다.",
    ],
  },
  {
    id: "083",
    title: "확률형 상품(가챠) 뽑기 및 천장(Pity) 시스템 연산",
    role: [
      "가챠는 '등급 가중치 추출 → 등급 내 아이템 균등/가중 선택 → 천장 계산 → 지급'의 연산이다. 등급 확률(SR 5%, SSR 0.6% 등)은 가중치 랜덤(WRS)으로 추출하고, 천장은 'N회차 내 확정' 보장(soft pity: 확률 상승, hard pity: 100%)으로 구현한다. 표준 설계는 (1) hard pity(예: 80회차 확정 SSR), (2) soft pity(70회차부터 회차마다 +6%p), (3) 천장 카운터는 배너별·등급별로 분리 관리다.",
      "공정성 요건은 두 가지다. 확률·천장 정보를 게임 내에 표시(법규 준수 — 한국 확률형 아이템 정보공개)하고, 뽑기 기록(history)을 서버에 보존해 클레임 검증이 가능하게 한다. 10연차는 1회차~10회차로 각각 카운터를 진행하되, 하드 천장 도달 시 즉시 확정 등급을 강제한다. 중복 아이템은 파편(교환 재화)으로 전환하는 규칙도 연산에 포함한다.",
    ],
    blocks: [
      {
        lang: "server/gacha/Gacha.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface GachaTier { tier: number; weight: number; items: string[]; }
export interface BannerDef {
  id: string;
  tiers: GachaTier[];
  pityHard: number;                 // 80회차 확정(최상등급)
  pitySoftFrom: number;             // 70회차부터
  pitySoftStep: number;             // 회차당 +0.06(6%p)
  dupeShards: number;               // 중복 전환 파편 수
}
export interface PullResult {
  tier: number; itemCode: string; dupe: boolean;
  pityCount: number; pityTriggered: boolean;
}

export class GachaService {
  constructor(private db: Kysely<DB>, private rng: () => number = Math.random) {}

  /** 1회 뽑기: 천장 우선 → 등급 WRS → 아이템 선택 */
  async pull(charId: number, banner: BannerDef, count = 1): Promise<PullResult[]> {
    const out: PullResult[] = [];
    for (let i = 0; i < count; i++) {
      // 1) 천장 카운터 로드/증가(배너별)
      const state = await this.loadCounter(charId, banner.id);
      const pityCount = state.count + 1;

      // 2) 하드 천장: 최상등급 확정
      const topTier = Math.max(...banner.tiers.map(t => t.tier));
      let tier: number, pityTriggered = false;
      if (pityCount >= banner.pityHard) {
        tier = topTier;
        pityTriggered = true;
      } else {
        // soft pity: 상승분을 최상등급 가중치에 더함
        const softBoost = pityCount >= banner.pitySoftFrom
          ? (pityCount - banner.pitySoftFrom + 1) * banner.pitySoftStep : 0;
        tier = this.rollTier(banner.tiers, topTier, softBoost);
      }

      // 3) 등급 내 아이템 균등 선택
      const pool = banner.tiers.find(t => t.tier === tier)!.items;
      const itemCode = pool[Math.floor(this.rng() * pool.length)];

      // 4) 중복 판정(보유 이력) → 파편 전환
      const owned = state.owned.has(itemCode);
      if (owned) {
        await this.walletGrant(charId, "shard", banner.dupeShards);
      } else {
        state.owned.add(itemCode);
      }
      out.push({ tier, itemCode, dupe: owned, pityCount, pityTriggered });

      // 카운터 갱신(최상등급 획득 시 리셋)
      await this.saveCounter(charId, banner.id,
        tier === topTier ? 0 : pityCount, state.owned);
    }
    return out;
  }

  /** 등급 WRS: soft boost는 최상등급 가중치에 가산 */
  private rollTier(tiers: GachaTier[], topTier: number, softBoost: number): number {
    const adjusted = tiers.map(t => ({
      tier: t.tier,
      weight: t.weight + (t.tier === topTier ? softBoost : 0),
    }));
    const total = adjusted.reduce((s, t) => s + t.weight, 0);
    let r = this.rng() * total;
    for (const t of adjusted) if ((r -= t.weight) <= 0) return t.tier;
    return adjusted[adjusted.length - 1].tier;
  }

  private async loadCounter(charId: number, bannerId: string) {
    const row = await this.db.selectFrom("gacha_counter")
      .where("character_id", "=", charId).where("banner_id", "=", bannerId)
      .select(["count", "owned"]).executeTakeFirst();
    return {
      count: row?.count ?? 0,
      owned: new Set<string>(row ? (row.owned as string[]) : []),
    };
  }
  private async saveCounter(charId: number, bannerId: string,
                            count: number, owned: Set<string>) {
    await this.db.insertInto("gacha_counter").values({
      character_id: charId, banner_id: bannerId, count, owned: [...owned],
    }).onConflict(oc => oc.doUpdate().set({ count, owned: [...owned] })).execute();
  }
  private async walletGrant(charId: number, c: string, n: number) {
    // 081번 Wallet.grant 위임(발췌)
  }
}`,
      },
    ],
    tips: [
      "soft pity(+6%p/회차)는 '후반 스트레스를 확률로 해소'하는 표준이며, hard pity(80회)는 절대 보장선이다.",
      "천장 카운터는 배너별·등급별로 분리해야 — 최상등급 천장과 중간등급 천장이 섞이면 보장이 깨진다.",
      "10연차도 회차별로 개별 카운터를 진행해야 10연차가 천장을 10회 우회하는 어뷰징이 없다.",
      "중복 전환(파편)은 수확 체감을 줄이는 표준 장치이며, 전환율은 교환소 환율(088번)과 균형을 맞춘다.",
    ],
  },
  {
    id: "084",
    title: "VIP / 월정액 매일 자동 보상 지급 스케줄러",
    role: [
      "월정액(VIP) 상품은 '구매 → 자격 부여(기간) → 매일 접속 보상 지급'의 구조다. 자격은 subscriptions 테이블(시작/종료일, 자동 갱신 여부)로 관리하고, 일일 보상은 '첫 접속 시 1회' 정책으로 지급한다 — 접속하지 않으면 그날 보상은 소멸(또는 적립 옵션)되며, 이것이 앱 실행 유인의 핵심 동력이다. 지급은 (유저, 상품, 날짜) 멱등 키로 이중 지급을 막는다.",
      "스케줄러의 역할은 두 가지다. 첫째, 접속 시점 즉시 지급(로그인 핸들러 훅) — 대부분의 보상은 이 경로다. 둘째, 만료/자동 갱신/기간 종료 정산을 크론(일 1회)으로 처리한다. 자동 갱신 결제 실패 시 유예 기간(3일)을 두고, 유예 중에도 자격 유지 정책은 BM 설계로 결정한다. 모든 상태 변화는 구독 로그로 남겨 CS 대응 데이터를 확보한다.",
    ],
    blocks: [
      {
        lang: "server/vip/VipService.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface VipSku {
  skuId: string; days: number;
  dailyCash: number; dailyItem?: { code: string; qty: number };
  autoRenewable: boolean;
}

export class VipService {
  constructor(private db: Kysely<DB>, private skus: Map<string, VipSku>,
              private wallet: import("../economy/Wallet").Wallet) {}

  /** 구매 완료(082번 결제 검증 후) → 자격 부여(기존 잔여기간 + 신규 기간) */
  async activate(charId: number, skuId: string, paymentRef: string) {
    const sku = this.skus.get(skuId);
    if (!sku) throw new Error("NO_SKU");
    const now = Date.now();
    const cur = await this.db.selectFrom("vip_subscriptions")
      .where("character_id", "=", charId).where("sku_id", "=", skuId)
      .select(["expires_at"]).executeTakeFirst();
    const base = cur && cur.expires_at.getTime() > now ? cur.expires_at.getTime() : now;
    const expiresAt = new Date(base + sku.days * 86400000);
    await this.db.insertInto("vip_subscriptions").values({
      character_id: charId, sku_id: skuId, expires_at: expiresAt,
      started_at: new Date(), auto_renew: sku.autoRenewable,
    }).onConflict(oc => oc.doUpdate().set({ expires_at: expiresAt })).execute();
    await this.db.insertInto("vip_log").values({
      character_id: charId, event: "activate", sku_id: skuId,
      ref: paymentRef, at: new Date(),
    }).execute();
    return expiresAt;
  }

  /** 첫 접속 일일 보상(로그인 훅 — 멱등: (char, sku, date)) */
  async grantDailyOnLogin(charId: number, dateKey: string) {
    const subs = await this.db.selectFrom("vip_subscriptions")
      .where("character_id", "=", charId)
      .where("expires_at", ">", new Date())
      .select(["sku_id"]).execute();
    for (const s of subs) {
      const sku = this.skus.get(s.sku_id)!;
      const ref = "vip:daily:" + charId + ":" + s.sku_id + ":" + dateKey;
      await this.wallet.grant({ type: "char", id: charId }, "cash",
        sku.dailyCash, "vip_daily", ref);
      if (sku.dailyItem) {
        await this.wallet.grant({ type: "char", id: charId }, "event_coin",
          1, "vip_daily_item", ref + ":i");
      }
    }
  }

  /** 크론(일 1회): 만료 처리 + 자동 갱신 시도 */
  async cron(now: Date) {
    // 1) 만료
    await this.db.updateTable("vip_subscriptions")
      .set({ status: "expired" })
      .where("expires_at", "<=", now).where("status", "=", "active").execute();
    // 2) 자동 갱신(결제 시스템 082번 호출) — 실패 시 유예 기록
    const due = await this.db.selectFrom("vip_subscriptions")
      .where("auto_renew", "=", true)
      .where("expires_at", "<=", now + 3 * 86400000)
      .where("status", "=", "active")
      .select(["character_id", "sku_id"]).execute();
    for (const s of due) {
      // 실제 결제는 082번 confirmIap/confirmWeb 파이프라인 사용
      await this.db.insertInto("vip_log").values({
        character_id: s.character_id, event: "renew_attempt",
        sku_id: s.sku_id, ref: "cron", at: now,
      }).execute();
    }
  }
}`,
      },
    ],
    tips: [
      "일일 보상은 '첫 접속 시 지급 + 미접속 소멸'이 기본이며, 적립형(최대 3일 누적)은 유예 정책으로 채택 가능하다.",
      "기간 연장은 '잔여 기간 + 신규 기간' 합산으로 — 조기 구매가 손해가 되면 재구매율이 떨어진다.",
      "구독 상태 변화(활성/갱신/만료/유예)는 모두 vip_log로 — CS '보상 안 나왔다' 클레임의 1차 근거다.",
      "자동 갱신은 결제 실패 유예(3일) 중에도 보상을 지급하는 정책이 이탈을 줄인다(갱신 실패 곧 해지 방지).",
    ],
  },
  {
    id: "085",
    title: "인플레이션 방지를 위한 재화 소모(Sink) 매커니즘",
    role: [
      "MMORPG 경제는 '소스(지급)와 싱크(소모)의 균형'이 생명이다. 소스는 퀘스트·몬스터 드롭·이벤트에서 계속 늘어나므로, 싱크가 부족하면 물가가 폭등해 신규 유저 진입이 불가능해진다. 이 시스템은 재화 유동성 대시보드(소스/싱크 흐름 집계)와 싱크 설계(강화 비용, 제작 비용, 시세 수수료, 수리비, 텔레포트 비용 등)를 데이터로 운영한다. 싱크 강도는 소스 대비 목표 소비율(보통 60~80%)로 역산해 조정한다.",
      "구현은 (1) ledger 기반 흐름 집계(reason별 소스/싱크 합산, 081번 데이터 재사용), (2) 물가 지표(경매장 거래가 이동 평균 — 056번), (3) 동적 조정(특정 싱크 비용 배율 테이블)의 3단계다. 중요한 것은 싱크가 '강제 세금'이 아니라 '가치 소비'여야 한다는 점이다 — 강화/제작처럼 유저가 자발적으로 소비하는 싱크가 지속 가능하다.",
    ],
    blocks: [
      {
        lang: "server/economy/EconomyMonitor.ts",
        code: `import { Kysely } from "kysely";
type DB = import("../schema").Database;

export interface FlowRow {
  reason: string; inflow: number; outflow: number; net: number;
}
export class EconomyMonitor {
  constructor(private db: Kysely<DB>) {}

  /** 소스/싱크 집계(기간별) — 대시보드 + 싱크 조정 근거 */
  async flows(currency = "gold", days = 7): Promise<FlowRow[]> {
    const rows = await this.db.selectFrom("currency_ledger")
      .where("currency", "=", currency)
      .where("at", ">=", new Date(Date.now() - days * 86400000))
      .select(eb => [
        eb("reason").as("reason"),
        eb.fn.sum(eb.case().when("delta", ">", 0)
          .then(eb.ref("delta")).else(0).end()).as("inflow"),
        eb.fn.sum(eb.case().when("delta", "<", 0)
          .then(eb.ref("delta").neg()).else(0).end()).as("outflow"),
      ])
      .groupBy("reason").execute();
    return rows.map(r => ({
      reason: r.reason,
      inflow: Number(r.inflow), outflow: Number(r.outflow),
      net: Number(r.inflow) - Number(r.outflow),
    }));
  }

  /** 싱크 강도 지표: 소스 대비 소모율 */
  static sinkRate(flows: FlowRow[]): number {
    const inflow = flows.reduce((s, f) => s + f.inflow, 0);
    const outflow = flows.reduce((s, f) => s + f.outflow, 0);
    return inflow > 0 ? outflow / inflow : 0;
  }

  /** 동적 싱크 배율: 소모율 낮을수록 싱크 비용 상향(전략적 조정) */
  static sinkMultiplier(sinkRate: number): number {
    if (sinkRate >= 0.8) return 1.0;    // 건강: 기본 배율
    if (sinkRate >= 0.6) return 1.05;
    if (sinkRate >= 0.4) return 1.15;
    return 1.3;                          // 심각: 싱크 비용 +30%
  }
}

/** 싱크 설계 예시 — 유저가 자발적으로 소비하는 경로 */
// 1) 강화 비용(025번): 단계별 골드 소모 — 최대 싱크
// 2) 제작/연금술(066번): 재료 + 수수료
// 3) 경매장 수수료(056번): 거래 5% — 유동성 싱크
// 4) 수리비: 사망 시 장비 내구도 소모
// 5) 텔레포트/이동 주문서: 편의 소모
// 6) 명함/외형 합성: 수집형 소비

/** 경고 규칙(크론 일 1회) */
// sinkRate < 0.5 지속 3일 → 운영팀 알림 + 싱크 배율 상향 검토
// 특정 reason inflow 급증(이벤트 드롭 오류 등) → 이상 흐름 감지`,
      },
    ],
    tips: [
      "싱크는 '자발적 소비(강화/제작/외형)' 중심으로 설계한다 — 강제 세금형 싱크(수리비 폭탄)는 이탈의 주범이다.",
      "소모율(sinkRate) 0.6~0.8 밴드가 건강 구간이며, 0.4 미만이면 싱크 비용 배율로 서서히 조정한다(급격한 인상 금지).",
      "이벤트 기간 소스 폭증은 예측 가능하므로, 이벤트와 함께 전용 싱크(이벤트 코인 교환소 088번)를 동시에 오픈해야 한다.",
      "ledger reason 표준화가 없으면 흐름 분석 자체가 불가능하다 — reason은 서버 상수 테이블로 관리한다.",
    ],
  },
];
