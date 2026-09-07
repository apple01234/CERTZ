// 모듈 6 (056~060): 소셜 및 커뮤니티 시스템 — 후반부

export const items = [
  {
    id: "056",
    title: "통합 경매장/위탁 판매소 (검색, 시세, 등록, 즉시 구매)",
    role: [
      "경매장은 '등록(판매자가 아이템+가격 업로드) → 검색/시세 조회 → 구매(즉시구매 또는 낙찰) → 정산'의 파이프라인이다. 등록 시 아이템은 소유자에서 경매장 계좌(escrow)로 이전되고, 판매 완료 시 판매자에게 금액(수수료 차감)이 지급된다. 즉시구매는 buyout 가격 필수이며, 입찰 경매는 마감 시간에 최고 입찰자가 낙찰받는다. 검색은 카테고리/이름/레벨/강화 단계 필터 + 정렬 + 페이지네이션의 표준 API다.",
      "시세(마켓 프라이스)는 최근 24시간 거래 완료가의 이동 평균으로 집계해 상하한가 제어(087번)와 유저 가격 참고 UI에 쓴다. 성능 핵심은 목록 조회 캐싱(30초 Redis)과 인덱스 설계(category, item_code, buyout_price)다. 등록 취소는 상태를 canceled로 바꾸고 escrow에서 원상복구하는 트랜잭션으로 처리한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE auction_listings (
  id           BIGSERIAL PRIMARY KEY,
  seller_id    BIGINT NOT NULL,
  item_id      BIGINT NOT NULL,            -- escrow된 character_items.id
  item_code    VARCHAR(40) NOT NULL,
  category     VARCHAR(16) NOT NULL,       -- 검색 필터
  enhance      SMALLINT NOT NULL DEFAULT 0,
  qty          INT NOT NULL DEFAULT 1,
  price_now    BIGINT NOT NULL,            -- 즉시구매가
  price_start  BIGINT,                     -- 입찰 경매 시작가(NULL = 즉시구매 전용)
  top_bid      BIGINT,                     -- 현재 최고 입찰
  top_bidder   BIGINT,
  status       VARCHAR(12) NOT NULL DEFAULT 'active',
               -- active|sold|canceled|expired
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_auction_search ON auction_listings
  (status, category, item_code, price_now) WHERE status = 'active';
CREATE INDEX idx_auction_expire ON auction_listings (expires_at)
  WHERE status = 'active';

CREATE TABLE auction_trades (
  id           BIGSERIAL PRIMARY KEY,
  listing_id   BIGINT NOT NULL,
  buyer_id     BIGINT NOT NULL,
  final_price  BIGINT NOT NULL,
  fee          BIGINT NOT NULL,            -- 수수료(5%)
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      },
      {
        lang: "server/auction/Auction.ts — 등록/검색/구매 Kysely 쿼리",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

const FEE_RATE = 0.05;

export class AuctionService {
  constructor(private db: Kysely<DB>) {}

  /** 즉시 구매: escrow 아이템 인도 + 정산(단일 트랜잭션) */
  async buyNow(listingId: number, buyerId: number) {
    return this.db.transaction().execute(async tx => {
      const l = await tx.selectFrom("auction_listings").where("id", "=", listingId)
        .where("status", "=", "active").forUpdate().executeTakeFirst();
      if (!l) throw new Error("NOT_AVAILABLE");
      if (l.seller_id === buyerId) throw new Error("SELF_PURCHASE");

      const u = await tx.selectFrom("users").where("id", "=", buyerId)
        .forUpdate().select("gold").executeTakeFirstOrThrow();
      if (u.gold < l.price_now) throw new Error("NO_FUNDS");

      // 1) 구매자 재화 차감 → 판매자 지급(수수료 차감)
      await tx.updateTable("users").set(eb => ({ gold: eb("gold", "-", l.price_now) }))
        .where("id", "=", buyerId).execute();
      const net = Math.floor(l.price_now * (1 - FEE_RATE));
      await tx.updateTable("users").set(eb => ({ gold: eb("gold", "+", net) }))
        .where("id", "=", l.seller_id).execute();

      // 2) 아이템 인도(escrow → 구매자)
      await tx.updateTable("character_items").set({ character_id: buyerId })
        .where("id", "=", l.item_id).execute();
      await tx.updateTable("auction_listings").set({ status: "sold" })
        .where("id", "=", listingId).execute();
      await tx.insertInto("auction_trades").values({
        listing_id: listingId, buyer_id: buyerId, final_price: l.price_now,
        fee: l.price_now - net, at: new Date(),
      }).execute();
      return { net };
    });
  }

  /** 검색: 필터 + 정렬 + 페이지네이션(30초 Redis 캐시 전제) */
  async search(q: {
    category?: string; itemCode?: string; minEnhance?: number;
    maxPrice?: number; sort?: "price_asc" | "price_desc" | "recent";
    page?: number; size?: number;
  }) {
    let query = this.db.selectFrom("auction_listings")
      .where("status", "=", "active");
    if (q.category) query = query.where("category", "=", q.category);
    if (q.itemCode) query = query.where("item_code", "=", q.itemCode);
    if (q.minEnhance) query = query.where("enhance", ">=", q.minEnhance);
    if (q.maxPrice) query = query.where("price_now", "<=", q.maxPrice);
    const size = Math.min(50, q.size ?? 20), page = Math.max(0, q.page ?? 0);
    const sorted = q.sort === "price_asc" ? query.orderBy("price_now asc")
      : q.sort === "price_desc" ? query.orderBy("price_now desc")
      : query.orderBy("created_at desc");
    return sorted.limit(size).offset(page * size).execute();
  }

  /** 시세 집계: 최근 24h 완료가 평균(시세 UI + 087번 상하한가 기준) */
  async marketPrice(itemCode: string) {
    const row = await this.db.selectFrom("auction_trades")
      .innerJoin("auction_listings", "auction_trades.listing_id", "auction_listings.id")
      .where("auction_listings.item_code", "=", itemCode)
      .where("auction_trades.at", ">=", new Date(Date.now() - 86400000))
      .select(eb => eb.fn.avg("final_price").as("avg")).executeTakeFirst();
    return row ? Math.round(Number(row.avg)) : null;
  }
}`,
      },
    ],
    tips: [
      "escrow 패턴(등록 시 소유 이전)은 판매자가 판매 중 아이템을 우편으로 빼가는 사기를 구조적으로 차단한다.",
      "검색 인덱스는 부분 인덱스(WHERE status='active')로 — 활성 목록만 조회하므로 인덱스가 절반 이하로 작아진다.",
      "구매 트랜잭션은 '재화 차감 → 아이템 인도 → 상태 변경' 순서를 지켜야 부분 실패 시 돌아갈 지점이 명확하다.",
      "시세는 24시간 거래가 이동 평균이며, 거래가 없으면 null로 표시해 가짜 시세(조작)를 만들지 않는다.",
    ],
  },
  {
    id: "057",
    title: "감정표현(Emote) 및 픽셀 애니메이션 동기화",
    role: [
      "감정표현은 '애니메이션 재생 + 주변 유저 방송'의 저비용 이벤트다. 정의는 emote_def(코드, 애니메이션 키, 지속 시간, 파티클/사운드 옵션)로 관리하고, 유저가 감정표현을 실행하면 서버는 스로틀 검증 후 AOI 토픽(013번)에 이벤트 1회를 발행한다. 수신 클라는 대상 캐릭터 컨테이너(027번 외형)에 애니메이션 오버레이를 재생하고, 지속 시간 후 원복한다.",
      "픽셀 애니메이션 동기화의 원칙은 '이벤트 방송, 상태 전송 금지'다. 애니메이션 프레임 인덱스를 매 프레임 보내는 것은 낭비이며, 'emote 실행' 이벤트 1개로 시작 시각(서버 시각)과 코드를 전달하면 각 클라가 자동 재생을 맞춘다. 스폰 직후 입장한 유저는 '현재 진행 중인 emote'를 스냅샷에 포함해 받는다(남은 시간 계산 후 부분 재생).",
    ],
    blocks: [
      {
        lang: "src/world/Emote.ts — 정의 + 클라 재생",
        code: `import Phaser from "phaser";

export interface EmoteDef {
  code: string;                   // "wave" | "dance" | "laugh" | "bow"
  animKey: string;                // 스프라이트 애니메이션 키
  durationMs: number;
  particles?: string;             // 옵션: 파티클 텍스처
  sound?: string;
  loop: boolean;
}

export const EMOTES: Record<string, EmoteDef> = {
  wave:  { code: "wave",  animKey: "emote_wave",  durationMs: 1500, loop: false },
  dance: { code: "dance", animKey: "emote_dance", durationMs: 6000, particles: "fx_note",
           sound: "sfx_dance", loop: true },
  laugh: { code: "laugh", animKey: "emote_laugh", durationMs: 1200, loop: false },
  bow:   { code: "bow",   animKey: "emote_bow",   durationMs: 1000, loop: false },
};

const RATE_MS = 1200;                     // 연속 감정표현 스로틀

export class EmotePlayer {
  private lastAt = 0;
  private activeKey: string | null = null;

  constructor(private scene: Phaser.Scene, private container: Phaser.GameObjects.Container) {}

  /** 내가 실행(서버 승인 요청 전 로컬 예측 재생 허용) */
  play(code: string, now: number): boolean {
    if (now - this.lastAt < RATE_MS) return false;
    const def = EMOTES[code];
    if (!def) return false;
    this.lastAt = now;
    this.playLocal(def, def.durationMs);
    return true;                          // 호출자가 C2S_EMOTE 전송
  }

  /** 원격 유저 감정표현 수신(서버 시각 + 코드) */
  playRemote(code: string, serverStartAt: number, nowServer: number) {
    const def = EMOTES[code];
    if (!def) return;
    const elapsed = Math.max(0, nowServer - serverStartAt);
    if (def.loop) {
      this.playLocal(def, def.durationMs);          // 루프는 남은 시간 무관 재생
    } else if (elapsed < def.durationMs) {
      this.playLocal(def, def.durationMs - elapsed); // 부분 재생
    }
  }

  private playLocal(def: EmoteDef, durationMs: number) {
    const sprite = this.container.list[0] as Phaser.GameObjects.Sprite;
    if (this.activeKey) this.stop();
    this.activeKey = def.animKey;
    sprite.play(def.animKey);

    if (def.particles) {
      const fx = this.scene.add.particles(this.container.x, this.container.y - 40,
        def.particles, { speedY: { min: -30, max: -10 }, lifespan: 900, quantity: 1,
                         frequency: 300, alpha: { start: 0.8, end: 0 } });
      fx.setDepth(4600);
      this.scene.time.delayedCall(durationMs, () => fx.destroy());
    }
    this.scene.time.delayedCall(durationMs, () => {
      sprite.play("idle_down");             // 원복
      this.activeKey = null;
    });
  }
  private stop() {
    const sprite = this.container.list[0] as Phaser.GameObjects.Sprite;
    sprite.play("idle_down");
    this.activeKey = null;
  }
}`,
      },
    ],
    tips: [
      "감정표현은 이벤트 1회 방송 + 서버 시작 시각만 전달하면 충분하다 — 프레임 동기화는 필요 없다.",
      "스로틀(1.2초)은 스팸이 아니라 '재생 충돌 방지' 목적이며, 서버가 최종 검증한다.",
      "스폰 스냅샷에 '진행 중 emote + 남은 시간'을 포함해야 맵 진입 직후에도 진행 중 표현이 보인다.",
      "감정표현은 파티 모집(안전장치: 파티 리더만 dance 전용 버전) 같은 비언어적 소통 도구로 확장 가치가 크다.",
    ],
  },
  {
    id: "058",
    title: "영지전 / 공성전 대규모 PvP 인스턴스 권한 시스템",
    role: [
      "공성전은 '공격 길드 연합 vs 수성 길드'의 대규모(100~300명) PvP 인스턴스다. 권한 시스템은 (1) 참가 자격(길드 가입, 레벨, 신청 완료), (2) 진영(faction) 배정, (3) 전장 내 특수 권한(공성 무기 사용, 문 개폐, 플래그 소유), (4) 관전자(사망 관전/외부 관전)의 4계층으로 구성된다. 인스턴스는 전용 룸(017번)으로 생성되며, 진입 시 진영 배정 정보를 세이브가 아닌 세션에 저장한다(전장 종료 후 원래 상태 복원).",
      "핵심 안전장치는 권한의 지속 재검증이다. 전장 도중 길드 탈퇴/추방되면 즉시 참가 권한 상실(강제 관전 전환)되고, 전장 상태(문 개폐, 무기 사용)는 서버가 매 액션마다 세션 권한을 재확인한다. 점수(킬/오브젝트 파괴/기여)는 이벤트 큐로 적립해 실시간 점수판을 만들고, 종료 시 기여도 기반 보상을 지급한다(064번 파이프라인 재사용).",
    ],
    blocks: [
      {
        lang: "server/siege/Siege.ts",
        code: `export type Faction = "attack" | "defense" | "spectator";
export interface SiegePermission {
  charId: number; guildId: number;
  faction: Faction;
  canUseSiegeWeapon: boolean;        // 공성 무기
  canOpenGate: boolean;              // 성문 개폐
  canCarryFlag: boolean;             // 플래그 운반
  inBattle: boolean;                 // false = 관전
}
export interface SiegeInstance {
  roomId: string; phase: "register" | "prep" | "battle" | "ended";
  startsAt: number; endsAt: number;
  perms: Map<number, SiegePermission>;
  scores: Map<number, { kills: number; dmg: number; objectives: number }>;
  gateHp: number;                    // 수성 성문
}

export class SiegeAuthority {
  private sieges = new Map<string, SiegeInstance>();

  /** 참가 신청(등록 단계): 길드 검증 + 진영 배정 */
  register(siegeId: string, charId: number, guildId: number, isDefGuild: boolean): boolean {
    const s = this.sieges.get(siegeId);
    if (!s || s.phase !== "register") return false;
    s.perms.set(charId, {
      charId, guildId,
      faction: isDefGuild ? "defense" : "attack",
      canUseSiegeWeapon: false,       // prep 단계에서 직급 기반 부여
      canOpenGate: false,
      canCarryFlag: false,
      inBattle: true,
    });
    return true;
  }

  /** 전장 진입 직전: 직급 기반 특수 권한 부여 */
  grantRolePerms(siegeId: string, charId: number, guildRole: "master" | "officer" | "member") {
    const p = this.sieges.get(siegeId)?.perms.get(charId);
    if (!p) return;
    p.canUseSiegeWeapon = guildRole !== "member";
    p.canOpenGate = p.faction === "defense" && guildRole !== "member";
    p.canCarryFlag = true;            // 모든 참가자 가능 — 플래그 소유는 획득 판정
  }

  /** 액션 권위 검증(전장 내 모든 특수 액션 전 호출) */
  authorize(siegeId: string, charId: number, action: "weapon" | "gate" | "flag"): boolean {
    const s = this.sieges.get(siegeId);
    if (!s || s.phase !== "battle") return false;
    const p = s.perms.get(charId);
    if (!p || !p.inBattle || p.faction === "spectator") return false;
    switch (action) {
      case "weapon": return p.canUseSiegeWeapon;
      case "gate":   return p.canOpenGate && s.gateHp > 0;
      case "flag":   return p.canCarryFlag;
    }
  }

  /** 길드 탈퇴 등 이벤트 → 즉시 권한 상실(강제 관전) */
  revokeGuildMembership(charId: number, guildId: number) {
    for (const s of this.sieges.values()) {
      const p = s.perms.get(charId);
      if (p && p.guildId === guildId && s.phase !== "ended") {
        p.inBattle = false;
        p.faction = "spectator";
        p.canUseSiegeWeapon = p.canOpenGate = p.canCarryFlag = false;
      }
    }
  }

  /** 점수 적립(킬/피해/오브젝트) — 이벤트 큐로 비동기 */
  score(siegeId: string, charId: number, kind: "kill" | "dmg" | "objective", value = 1) {
    const s = this.sieges.get(siegeId);
    if (!s || s.phase !== "battle") return;
    const sc = s.scores.get(charId) ?? { kills: 0, dmg: 0, objectives: 0 };
    if (kind === "kill") sc.kills += value;
    if (kind === "dmg") sc.dmg += value;
    if (kind === "objective") sc.objectives += value;
    s.scores.set(charId, sc);
  }
}`,
      },
    ],
    tips: [
      "진영 배정은 세이브가 아닌 세션 데이터로 — 전장 종료 후 원래 소속(길드/PVP 상태)을 그대로 복원해야 한다.",
      "특수 권한(공성 무기 등)은 직급 기반 초기 부여 + 매 액션 재검증의 이중 구조다 — 초기 부여만 믿으면 직급 변경 후에도 권한이 남는다.",
      "성문 HP 같은 공성 오브젝트는 서버 단일 권위로 두고, 클라 연출은 상태 방송(파괴 진행도)에 맞춘다.",
      "관전자 수용(죽으면 관전 모드)은 전장 참여 유지보수(사망 페널티 없음) 정책과 함께 설계해야 이탈률이 관리된다.",
    ],
  },
  {
    id: "059",
    title: "Redis ZSET 기반 실시간 레벨/PvP/길드 랭킹 산출",
    role: [
      "랭킹은 Redis Sorted Set(ZSET)의 member=유저 id, score=랭킹 지표 구조로 실시간 산출한다. 업데이트는 ZADD/ZINCRBY(이벤트 발생 시 증분), 조회는 ZREVRANGE(순위) + ZSCORE(내 순위) + ZCOUNT(분포)다. 레벨 랭킹은 절대값(score=exp), PvP는 시즌 점수(ZINCRBY 증분), 길드 랭킹은 멤버 합산(주기 배치로 길드 ZSET 갱신)이다.",
      "실무 포인트는 두 가지다. 첫째, 시즌 랭킹은 시즌 키(ranking:pvp:s3)로 분리해 시즌 종료 시 스냅샷(DB) 후 새 키로 재시작한다. 둘째, 랭킹 조회는 Redis에서 상위 N명의 id를 얻고 DB에서 상세(이름/클래스)를 배치 조회한다 — Redis에 이름까지 넣으면 갱신 비용이 2배가 된다. 타이 랭크(동점)는 score에 보조 정밀도(1e-6)를 더해 안정적 순서를 만든다.",
    ],
    blocks: [
      {
        lang: "server/ranking/Ranking.ts",
        code: `import Redis from "ioredis";
import { Kysely } from "kysely";
type DB = import("./schema").Database;

export type RankingKind = "level" | "pvp" | "guild";
const KEY = (kind: RankingKind, season: string) => "rank:" + kind + ":" + season;

export class RankingService {
  constructor(private redis: Redis, private db: Kysely<DB>, private season = "s3") {}

  /** 절대값 랭킹(레벨/exp) — 세이브 시점 갱신 */
  async setLevelRank(charId: number, totalExp: number) {
    await this.redis.zadd(KEY("level", this.season), totalExp, String(charId));
  }

  /** 증분 랭킹(PvP 점수, 길드 기여) */
  async incr(kind: RankingKind, id: number, delta: number) {
    await this.redis.zincrby(KEY(kind, this.season), delta, String(id));
  }

  /** 상위 N: Redis에서 id → DB 상세 배치 조회 */
  async top(kind: RankingKind, n = 50) {
    const ids = await this.redis.zrevrange(KEY(kind, this.season), 0, n - 1, "WITHSCORES");
    const out: { id: number; score: number; name?: string; classCode?: string }[] = [];
    for (let i = 0; i < ids.length; i += 2) {
      out.push({ id: Number(ids[i]), score: Number(ids[i + 1]) });
    }
    if (!out.length) return [];
    const details = await this.db.selectFrom("characters")
      .where("id", "in", out.map(o => o.id))
      .select(["id", "name", "class_code"]).execute();
    const dmap = new Map(details.map(d => [d.id, d]));
    return out.map(o => ({ ...o, name: dmap.get(o.id)?.name, classCode: dmap.get(o.id)?.class_code }));
  }

  /** 내 순위 + 전후 랭커(마이 랭킹 UI) */
  async around(kind: RankingKind, id: number, span = 3) {
    const rank = await this.redis.zrevrank(KEY(kind, this.season), String(id));
    if (rank == null) return { rank: null, neighbors: [] };
    const start = Math.max(0, rank - span);
    const ids = await this.redis.zrevrange(KEY(kind, this.season), start, rank + span, "WITHSCORES");
    const neighbors: { rank: number; id: number; score: number }[] = [];
    for (let i = 0; i < ids.length; i += 2) {
      neighbors.push({ rank: start + i / 2, id: Number(ids[i]), score: Number(ids[i + 1]) });
    }
    return { rank: rank + 1, neighbors };
  }

  /** 시즌 종료: 스냅샷(DB 저장) 후 새 키로 롤오버 */
  async rolloverSeason(kind: RankingKind, newSeason: string) {
    const oldKey = KEY(kind, this.season);
    const all = await this.redis.zrevrange(oldKey, 0, 999, "WITHSCORES");
    await this.db.transaction().execute(async tx => {
      for (let i = 0; i < all.length; i += 2) {
        await tx.insertInto("ranking_snapshot").values({
          kind, season: this.season, target_id: Number(all[i]),
          rank: i / 2 + 1, score: Number(all[i + 1]), at: new Date(),
        }).execute();
      }
    });
    this.season = newSeason;      // 이후 갱신은 새 시즌 키로
  }
}`,
      },
    ],
    tips: [
      "ZSET 갱신은 이벤트 발생 즉시 ZINCRBY — 주기 배치로 모으면 '순위 반영 지연' 클레임이 생긴다.",
      "타이(동점) 안정화는 score에 소수 정밀도 보조(예: exp*1e-6 + 달성시각 역수)로 해결한다.",
      "상위 1000명 외 조회는 '내 순위 + 전후' 패턴(ZREVRANK + 범위 조회)으로 절약한다 — 전체 순위 페이지네이션은 비용이 크다.",
      "시즌 롤오버는 스냅샷(DB) + 새 키 생성이 원자적이어야 한다 — 롤오버 순간의 갱신 유실을 방지한다.",
    ],
  },
  {
    id: "060",
    title: "멘토링 및 추천인 시스템 연계 보상 로직",
    role: [
      "멘토링은 '숙련 유저(멘토) ↔ 신규 유저(멘티) 매칭 + 함께 플레이 보상' 구조다. 자격은 레벨/플레이 시간 기준으로 판정하고, 매칭은 멘티 신청 → 멘토 수락의 큐 방식으로 진행한다. 보상은 세 단계로 지급된다. 매칭 성립 보상(즉시), 함께 플레이 보상(공동 사냥 시간 누적), 졸업 보상(멘티가 목표 레벨 도달)이다. 추천인 시스템은 가입 시점에 추천 코드를 입력한 관계를 고정하고, 멘티의 성장 지표에 따라 추천인에게 누적 보상을 준다.",
      "어뷰징 방지가 설계의 절반이다. 자기 자신/동일 IP 다계정 매칭 차단(디바이스/IP 유사도), 함께 플레이 인정 조건(양쪽 모두 전투 참여, 최소 10분), 졸업 보상 지급 시 재검증(멘티 실제 플레이 지표)을 둔다. 보상은 ledger ref로 멱등 지급('mentor:grad:<pairId>')하며, 관계 종료(멘티 졸업/중도 해지) 후 재매칭은 쿨다운(24시간)을 둔다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + server/mentor/Mentor.ts",
        code: `CREATE TABLE mentor_pairs (
  id          BIGSERIAL PRIMARY KEY,
  mentor_id   BIGINT NOT NULL REFERENCES characters(id),
  mentee_id   BIGINT NOT NULL REFERENCES characters(id),
  status      VARCHAR(12) NOT NULL DEFAULT 'active',
              -- active|graduated|ended
  play_min    INT NOT NULL DEFAULT 0,        // 함께 플레이 누적(분)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE TABLE referral (
  mentee_id   BIGINT PRIMARY KEY REFERENCES characters(id),
  referrer_id BIGINT NOT NULL REFERENCES characters(id),
  code_used   VARCHAR(12) NOT NULL,
  rewarded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      },
      {
        lang: "server/mentor/Mentor.ts — 매칭·보상·어뷰징 검증",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

const GRADUATE_LEVEL = 30;
const CO_REWARD_MINUTES = 30;        // 누적 30분마다 보상
const REWARD_GOLD = 5000;

export class MentorService {
  constructor(private db: Kysely<DB>) {}

  /** 매칭 성립: 자격 + 어뷰징 검증 */
  async pair(mentorId: number, menteeId: number, abuseCheck: {
    similarDevice: (a: number, b: number) => boolean;
  }): Promise<boolean> {
    const [mentor, mentee] = await Promise.all([
      this.db.selectFrom("characters").where("id", "=", mentorId)
        .select(["level", "play_min"]).executeTakeFirst(),
      this.db.selectFrom("characters").where("id", "=", menteeId)
        .select(["level", "play_min"]).executeTakeFirst(),
    ]);
    if (!mentor || !mentee) return false;
    if (mentor.level < 40) return false;              // 멘토 자격
    if (mentee.level > 25) return false;              // 멘티 자격(신규)
    if (abuseCheck.similarDevice(mentorId, menteeId)) return false;   // 다계정 차단

    const active = await this.db.selectFrom("mentor_pairs")
      .where("mentee_id", "=", menteeId).where("status", "=", "active")
      .executeTakeFirst();
    if (active) return false;                          // 중복 매칭 방지
    await this.db.insertInto("mentor_pairs").values({
      mentor_id: mentorId, mentee_id: menteeId, status: "active",
    }).execute();
    return true;
  }

  /** 함께 플레이 시간 누적(전투 종료 시 양쪽 세션 합산) */
  async addCoPlay(pairId: number, minutes: number) {
    await this.db.updateTable("mentor_pairs")
      .set(eb => ({ play_min: eb("play_min", "+", minutes) }))
      .where("id", "=", pairId).where("status", "=", "active").execute();
  }

  /** 보상 정산(멘토/멘티 구분 지급 — ledger 멱등) */
  async settleRewards(pairId: number) {
    const p = await this.db.selectFrom("mentor_pairs").where("id", "=", pairId)
      .select(["play_min", "mentor_id", "mentee_id", "status"]).executeTakeFirst();
    if (!p || p.status !== "active") return;
    const milestones = Math.floor(p.play_min / CO_REWARD_MINUTES);
    const ref = "mentor:co:" + pairId + ":" + milestones;
    await this.grantOnce(ref, p.mentor_id, REWARD_GOLD);
    await this.grantOnce("mentor:co:mate:" + ref, p.mentee_id, REWARD_GOLD * 2);
  }

  /** 졸업 판정(멘티 레벨업 훅에서 호출) */
  async checkGraduation(menteeId: number, newLevel: number) {
    if (newLevel < GRADUATE_LEVEL) return;
    const p = await this.db.selectFrom("mentor_pairs")
      .where("mentee_id", "=", menteeId).where("status", "=", "active")
      .select(["id", "mentor_id"]).executeTakeFirst();
    if (!p) return;
    await this.db.updateTable("mentor_pairs").set({ status: "graduated" })
      .where("id", "=", p.id).execute();
    await this.grantOnce("mentor:grad:" + p.id, p.mentor_id, 50000);
    await this.grantOnce("mentor:grad:me:" + p.id, menteeId, 30000);
  }

  private async grantOnce(ref: string, charId: number, gold: number) {
    const paid = await this.db.selectFrom("ledger")
      .where("ref", "=", ref).where("to_user", "=", charId)
      .select("id").executeTakeFirst();
    if (paid) return;                                  // 멱등
    await this.db.updateTable("characters").set(eb => ({ gold: eb("gold", "+", gold) }))
      .where("id", "=", charId).execute();
    await this.db.insertInto("ledger").values({
      at: new Date(), kind: "gold", from_user: null, to_user: charId,
      ref, payload: JSON.stringify({ gold }),
    }).execute();
  }
}`,
      },
    ],
    tips: [
      "보상은 ledger ref 멱등 지급이 원칙이다 — settle이 여러 번 돌아도 이중 지급이 없다.",
      "'함께 플레이' 인정 조건(양쪽 전투 참여 + 최소 지속)이 없으면 두 계정이 맵에 서 있는 것만으로 시간이 쌓인다.",
      "멘티 졸업 보상은 레벨 도달 시점 재검증(실제 플레이 지표) 후 지급해 수작업 성장 다계정을 걸러낸다.",
      "추천인 코드는 가입 완료 7일 이내에만 입력 가능하게 해 '부계정으로 코드 수확'을 제한한다.",
    ],
  },
];
