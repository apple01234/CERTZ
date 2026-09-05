// 모듈 6 (051~055): 소셜 및 커뮤니티 시스템 — 전반부
// 스택: uWebSockets.js(Pub/Sub Topics), Kysely, Redis, TypeScript

export const items = [
  {
    id: "051",
    title: "uWebSockets.js 토픽 기반 다중 채널(전체, 필드, 파티, 길드, 귓속말) 채팅 시스템",
    role: [
      "채팅 채널은 uWebSockets.js의 pub/sub 토픽과 1:1로 매핑된다. 전체 채널은 맵 단위 토픽(chat:map:world), 필드 채널은 AOI 토픽(013번 재사용), 파티는 chat:party:<id>, 길드는 chat:guild:<id>, 귓속말은 쌍방 유저 정렬 키(chat:dm:<lowId>:<highId>)로 구성한다. 이 매핑 덕분에 채널 가입/탈퇴가 subscribe/unsubscribe로 끝나고, 발송은 publish로 O(수신자) 처리가 네이티브 코어에서 일어난다.",
      "채팅은 스팸·욕설·어뷰징의 1차 진입점이므로 서버가 반드시 중간 검증을 수행한다. 스로틀(초당 3개), 길이 상한(200자), 차단 목록(054번) 확인, 금칙어 필터, 이후 Mute(099번) 검사를 순차 적용하고, 검증 통과 시에만 토픽에 발행한다. 채팅 로그는 감사(관리자 094번)를 위해 만료 TTL 캐시에 보관한다.",
    ],
    blocks: [
      {
        lang: "server/chat/ChatChannels.ts",
        code: `import uWS from "uWebSockets.js";

export type ChannelKind = "map" | "field" | "party" | "guild" | "dm" | "system";

export function channelTopic(kind: ChannelKind, a: string | number, b?: string | number): string {
  switch (kind) {
    case "map":   return "chat:map:" + a;
    case "field": return "chat:field:" + a;
    case "party": return "chat:party:" + a;
    case "guild": return "chat:guild:" + a;
    case "dm": {
      const [lo, hi] = [Number(a), Number(b)].sort((x, y) => x - y);
      return "chat:dm:" + lo + ":" + hi;
    }
    default: return "chat:system";
  }
}

export interface ChatMessage {
  ch: ChannelKind; target: string;          // 토픽 파라미터
  fromId: number; fromName: string;
  text: string;
}

const MAX_LEN = 200;
const RATE_MS = 350;                        // 최소 전송 간격

export class ChatService {
  private lastSent = new Map<uWS.WebSocket, number>();
  constructor(private blockList: (a: number, b: number) => Promise<boolean>,
              private muted: (id: number) => boolean,
              private badWords: (s: string) => string) {}

  /** 클라 C2S_CHAT 수신 처리 */
  async handle(ws: uWS.WebSocket, userId: number, name: string, msg: ChatMessage) {
    // 1) 스로틀
    const now = Date.now();
    if (now - (this.lastSent.get(ws) ?? 0) < RATE_MS) return;
    this.lastSent.set(ws, now);

    // 2) 제재/차단/길이/금칙어
    if (this.muted(userId)) { this.whisper(ws, "채팅 금지 상태입니다."); return; }
    if (msg.ch === "dm" && await this.blockList(userId, Number(msg.target))) return;
    if (msg.text.length > MAX_LEN) msg.text = msg.text.slice(0, MAX_LEN);
    msg.text = this.badWords(msg.text);
    if (!msg.text.trim()) return;

    // 3) 발행(자기 자신 포함 — 내 채팅도 내 화면에 떠야 함)
    const topic = channelTopic(msg.ch, msg.target, msg.ch === "dm" ? userId : undefined);
    const payload = JSON.stringify({
      ch: msg.ch, from: name, id: userId, text: msg.text, at: now,
    });
    ws.publish(topic, payload, true);
    if (msg.ch === "dm") {                    // 귓속말은 발신자 토픽에도 에코
      ws.publish(channelTopic("dm", userId, Number(msg.target)), payload, false);
    }
  }

  /** 채널 가입/탈퇴(파티 가입, 길드 가입, 맵 이동 시 호출) */
  join(ws: uWS.WebSocket, kind: ChannelKind, a: string | number, b?: string | number) {
    ws.subscribe(channelTopic(kind, a, b));
  }
  leave(ws: uWS.WebSocket, kind: ChannelKind, a: string | number, b?: string | number) {
    ws.unsubscribe(channelTopic(kind, a, b));
  }

  private whisper(ws: uWS.WebSocket, text: string) {
    ws.send(JSON.stringify({ ch: "system", text }), false, true);
  }
}`,
      },
    ],
    tips: [
      "토픽 문자열 규약(chat:kind:id)은 클라/서버/운영 툴이 공유하므로 한 곳(이 파일)에서만 생성한다.",
      "귓속말 토픽은 유저 id 오름차순 정렬 키로 단일화해야 발신/수신이 같은 토픽을 보게 된다.",
      "스로틀은 유저별이 아니라 커넥션별로 두는 게 정확하다 — 계정 다중 접속 어뷰징은 별도 카운터로.",
      "금칙어 필터는 서버에서 최종 적용하되, 클라 프리뷰(입력 중 실시간 마스킹)도 같은 사전을 공유하면 UX가 일치한다.",
    ],
  },
  {
    id: "052",
    title: "길드 창고, 출석, 기술 연구, 권한 관리 데이터 구조 및 DDL",
    role: [
      "길드 데이터는 4축으로 나뉜다. 구성원(권한 레벨), 창고(공용 아이템 저장), 출석/기여도(일일 출석 포인트), 기술 연구(길드 단계적 효과 — 공격력 % 등)다. 권한은 master/officer/member/newbie 4단계 + 기능별 세부 권한 비트(창고 입출, 창고 보기, 멤버 초대, 해체 등)로 이중 관리한다. 권한 비트는 기능별로 검증 미들웨어를 통과시켜 UI와 API가 같은 규칙을 쓰게 한다.",
      "창고는 아이템 소유 주체가 길드라는 점만 다른 024번 인벤토리와 동일 구조다. 출석은 하루 1회 체크인 API로 길드 포인트를 적립하고, 기술 연구는 포인트 소모 + 연구 시간(실시간 타이머) 후 효과 개방이다. 모든 길드 자산 변경은 트랜잭션 + ledger 기록(018번)으로 감사 가능하게 만든다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL",
        code: `CREATE TABLE guilds (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(20) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  guild_point INT NOT NULL DEFAULT 0,
  level       SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE guild_members (
  guild_id    BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
  character_id BIGINT REFERENCES characters(id) ON DELETE CASCADE,
  role        VARCHAR(12) NOT NULL DEFAULT 'member',  -- master|officer|member|newbie
  perms       INT NOT NULL DEFAULT 0,                 -- 세부 권한 비트
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attend DATE,
  attend_streak INT NOT NULL DEFAULT 0,
  contribution INT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, character_id)
);

-- 세부 권한 비트 상수
-- 1 창고 보기, 2 창고 입고, 4 창고 출고, 8 초대, 16 강퇴, 32 공지,
-- 64 연구 시작, 128 권한 관리
CREATE TABLE guild_warehouse (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  item_code   VARCHAR(40) NOT NULL,
  qty         INT NOT NULL CHECK (qty >= 0),
  deposited_by BIGINT,                                -- 감사 추적
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guild_tech (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  tech_code   VARCHAR(30) NOT NULL,       -- "atk_up" | "hp_up" | "warehouse_plus"
  level       SMALLINT NOT NULL DEFAULT 0,
  researching BOOLEAN NOT NULL DEFAULT FALSE,
  complete_at TIMESTAMPTZ,
  UNIQUE (guild_id, tech_code)
);`,
      },
      {
        lang: "server/guild/GuildOps.ts — 권한 검증 + 창고 입출고",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export const PERM = {
  WAREHOUSE_VIEW: 1, WAREHOUSE_DEPOSIT: 2, WAREHOUSE_WITHDRAW: 4,
  INVITE: 8, KICK: 16, NOTICE: 32, TECH: 64, MANAGE_PERMS: 128,
} as const;
const ROLE_MIN_PERMS: Record<string, number> = {
  master: 255, officer: 2 | 4 | 8 | 16 | 32 | 64 | 1,
  member: 2 | 1, newbie: 1,
};

export class GuildError extends Error {
  constructor(code: "NO_PERM" | "NOT_MEMBER" | "NO_ITEM" | "LOCK") { super(code); }
}

export async function requirePerm(db: Kysely<DB>, guildId: number, charId: number, bit: number) {
  const m = await db.selectFrom("guild_members")
    .where("guild_id", "=", guildId).where("character_id", "=", charId)
    .select(["role", "perms"]).executeTakeFirst();
  if (!m) throw new GuildError("NOT_MEMBER");
  const effective = m.perms | (ROLE_MIN_PERMS[m.role] ?? 0);
  if ((effective & bit) === 0) throw new GuildError("NO_PERM");
  return m;
}

/** 창고 출고: 권한 검증 + 원자적 차감 + 인벤토리 지급 */
export async function withdrawItem(
  db: Kysely<DB>, guildId: number, charId: number, itemId: number, qty: number,
) {
  await requirePerm(db, guildId, charId, PERM.WAREHOUSE_WITHDRAW);
  return db.transaction().execute(async tx => {
    const row = await tx.selectFrom("guild_warehouse").where("id", "=", itemId)
      .where("guild_id", "=", guildId).forUpdate().executeTakeFirst();
    if (!row || row.qty < qty) throw new GuildError("NO_ITEM");
    const left = row.qty - qty;
    if (left === 0) await tx.deleteFrom("guild_warehouse").where("id", "=", itemId).execute();
    else await tx.updateTable("guild_warehouse").set({ qty: left }).where("id", "=", itemId).execute();
    // 인벤토리 지급(024번 시스템 호출로 위임 — 여기서는 원리만 표현)
    await tx.insertInto("ledger").values({
      at: new Date(), kind: "item", from_user: null, to_user: charId,
      ref: "guild_wh:" + guildId, payload: JSON.stringify({ itemId, qty }),
    }).execute();
    return { itemCode: row.item_code, qty };
  });
}

/** 일일 출석: 연속 출석 보너스 + 길드 포인트 적립 */
export async function attend(db: Kysely<DB>, guildId: number, charId: number) {
  return db.transaction().execute(async tx => {
    const today = new Date().toISOString().slice(0, 10);
    const m = await tx.selectFrom("guild_members")
      .where("guild_id", "=", guildId).where("character_id", "=", charId)
      .forUpdate().select(["last_attend", "attend_streak", "contribution"]).executeTakeFirstOrThrow();
    if (m.last_attend && m.last_attend.toISOString().slice(0, 10) === today) return false;
    const streak = m.attend_streak + 1;
    const gain = 10 + Math.min(20, streak);       // 연속 출석 보너스
    await tx.updateTable("guild_members").set({
      last_attend: new Date(), attend_streak: streak, contribution: m.contribution + gain,
    }).where("guild_id", "=", guildId).where("character_id", "=", charId).execute();
    await tx.updateTable("guilds").set(eb => ({ guild_point: eb("guild_point", "+", gain) }))
      .where("id", "=", guildId).execute();
    return true;
  });
}`,
      },
    ],
    tips: [
      "권한은 role(간단 배정) + perms 비트(세부 오버라이드)의 OR로 계산한다 — role만으로는 '창고 보기만 가능한 officer' 같은 세밀함이 안 나온다.",
      "창고 입출고는 반드시 ledger 기록 — 길드 창고 도난 사고(권한 남용)의 유일한 감사 근거다.",
      "출석 streak은 타임존(일 단위 경계)을 명시해야 — 서버 UTC 기준 또는 게임 시간 기준 중 하나로 통일한다.",
      "기술 연구 효과는 길드 접속 시 파티 버프(038번) 소스로 주입해 스탯 파이프라인을 재사용한다.",
    ],
  },
  {
    id: "053",
    title: "파티 결성, 실시간 파티원 위치 공유 및 아이템 분배(순번/균등/루팅) 로직",
    role: [
      "파티는 '리더 + 멤버(최대 8명) + 정책(드롭 분배 방식)'의 상태다. 실시간 요소는 두 가지다. 파티원 위치 공유(1초 주기 배치 방송 — 048번 미니맵 마커와 공용)와 드롭 분배(아이템 획득 시 정책에 따라 배정)다. 분배 정책은 순번(round-robin — 순서대로 배정), 균등(비귀속 재화는 골드 환산 분할), 루팅(free-for-all — 획득자 귀속)의 세 가지를 파티 생성 시 선택한다.",
      "분배 판정은 서버가 드롭 발생 시 즉시 수행한다. 순번 정책은 '가방 공간 있는 다음 순번 멤버'에게 귀속시키고, 공간 부족 시 다음 순번으로 스킵한다. 균등 정책은 골드만 적용해 소수점은 리더에게 절상한다. 루팅은 획득 행위(몬스터 근접 + 획득 입력)를 서버가 검증해 먼저 획득한 유저에게 귀속시킨다. 모든 분배는 파티 채팅(051번)으로 공지되어 투명성을 확보한다.",
    ],
    blocks: [
      {
        lang: "server/party/Party.ts",
        code: `import uWS from "uWebSockets.js";

export type LootPolicy = "round_robin" | "equal" | "fffa";
export interface PartyMember {
  charId: number; name: string; online: boolean;
  x: number; y: number; mapId: string; lastPosAt: number;
}
export interface Party {
  id: string; leaderId: number;
  members: Map<number, PartyMember>;
  lootPolicy: LootPolicy;
  rrIndex: number;                 // 순번 커서
  topic: string;                   // chat:party:<id>
}

export class PartyManager {
  private parties = new Map<string, Party>();

  create(leaderId: number, policy: LootPolicy): Party {
    const p: Party = {
      id: "pt" + Date.now().toString(36), leaderId,
      members: new Map(), lootPolicy: policy, rrIndex: 0,
      topic: "chat:party:" + Date.now().toString(36),
    };
    this.parties.set(p.id, p);
    return p;
  }

  join(p: Party, charId: number, name: string, ws: uWS.WebSocket) {
    p.members.set(charId, { charId, name, online: true,
      x: 0, y: 0, mapId: "", lastPosAt: 0 });
    ws.subscribe(p.topic);
  }

  /** 위치 공유: 1초 주기 배치(각 유저 이동 패킷에서 좌표 수집) */
  broadcastPositions(p: Party, ws: uWS.WebSocket) {
    const now = Date.now();
    const list = [...p.members.values()]
      .filter(m => m.online && now - m.lastPosAt < 5000)
      .map(m => ({ id: m.charId, x: m.x, y: m.y, map: m.mapId }));
    ws.publish(p.topic, JSON.stringify({ t: "party_pos", list }), false);
  }

  /** 드롭 분배 판정(서버 — 드롭 발생 시 호출) */
  distributeLoot(p: Party, drop: { itemCode: string; qty: number; isGold: boolean; amount?: number }) {
    const online = [...p.members.values()].filter(m => m.online);
    if (!online.length) return null;

    if (drop.isGold && p.lootPolicy === "equal") {
      // 균등: 소수점은 리더 절상
      const each = Math.floor((drop.amount ?? 0) / online.length);
      const rest = (drop.amount ?? 0) - each * online.length;
      return { kind: "equal", amounts: online.map(m => ({
        charId: m.charId, gold: each + (m.charId === p.leaderId ? rest : 0) })) };
    }
    if (p.lootPolicy === "round_robin") {
      // 순번: 가방 공간 확인은 클라 응답이 필요하므로 후보 순서만 결정
      for (let i = 0; i < online.length; i++) {
        const m = online[(p.rrIndex + i) % online.length];
        p.rrIndex = (p.rrIndex + i + 1) % online.length;
        return { kind: "rr", assigned: m.charId, itemCode: drop.itemCode, qty: drop.qty };
      }
    }
    // fffa: 획득자 귀속(획득 입력을 서버가 검증한 charId)
    return { kind: "fffa", assigned: null };     // acquire 요청에서 결정
  }

  /** 획득 검증(fffa): 드롭 지점 근접 + 가장 먼저 요청 */
  tryAcquire(p: Party, charId: number, dropX: number, dropY: number, charX: number, charY: number) {
    if (Math.hypot(dropX - charX, dropY - charY) > 48) return false;
    // 동시성: 같은 드롭 id에 대한 첫 승인만 유효(원자적 Set)
    return true;
  }
}`,
      },
    ],
    tips: [
      "위치 공유는 1초 배치 방송이면 충분하다 — 이동 패킷마다 파티 방송을 추가하면 트래픽이 2배가 된다.",
      "순번 분배의 '가방 공간 부족 스킵'은 클라 응답을 기다리지 말고 서버 인벤토리 캐시로 즉시 판정해야 전투 흐름이 끊기지 않는다.",
      "분배 공지를 파티 채팅에 자동으로 남기면 분배 불만이 크게 줄어든다 — 투명성은 분배 정책보다 강력하다.",
      "fffa는 획득 요청을 반드시 서버가 근접 + 선착순으로 검증한다 — 클라 선언만 믿으면 중복 획득 복제가 발생한다.",
    ],
  },
  {
    id: "054",
    title: "친구 목록, 실시간 접속 상태 모니터링 및 차단 시스템",
    role: [
      "친구 시스템은 (1) 목록 저장(DB), (2) 실시간 접속 상태(온라인/게임 중/오프라인), (3) 상호작용(귓속말, 파티 초대, 차단)의 3계층이다. 접속 상태는 Redis presence 해시(로그인 시 SET, 로그아웃 시 DEL + TTL 안전망)로 관리하고, 친구가 접속/종료하면 양방향 친구 관계를 따라가며 접속 알림(presence:notify:<userId> 토픽)을 발행한다. 온라인 상태는 캐시에서만 조회하므로 친구 500명을 가져도 O(1) 해시 조회로 끝난다.",
      "차단은 '내 화면에서 상대 제거 + 상대가 나를 보지 못하게' 양방향 필터다. 차단된 쌍은 귓속말/파티 초대/경매 연락이 서버에서 거부되고, 필드에서도 이름 표시가 익명화된다. 친구 요청은 수락 대기 큐(만료 7일)로 운영하며, 스팸 요청은 일일 상한(20회)으로 제한한다.",
    ],
    blocks: [
      {
        lang: "PostgreSQL DDL + server/friends/Presence.ts",
        code: `-- DDL
CREATE TABLE friendships (
  user_a      BIGINT NOT NULL REFERENCES characters(id),
  user_b      BIGINT NOT NULL REFERENCES characters(id),
  status      VARCHAR(12) NOT NULL DEFAULT 'pending',  -- pending|accepted|blocked
  requested_by BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b)
);
CREATE INDEX idx_friend_of ON friendships(user_a, status);
-- 관계는 항상 user_a < user_b 로 정규화 저장(양방향 조회 단순화)

CREATE TABLE friend_blocks (
  blocker     BIGINT NOT NULL REFERENCES characters(id),
  blocked     BIGINT NOT NULL REFERENCES characters(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked)
);`,
      },
      {
        lang: "server/friends/Presence.ts — Redis 접속 상태",
        code: `import Redis from "ioredis";

export class PresenceService {
  private readonly KEY = "presence";            // 해시: charId → 상태
  private readonly NOTIFY = "presence:notify";

  constructor(private redis: Redis, private pub: Redis) {}

  /** 로그인: 상태 등록 + 친구에게 알림 */
  async online(charId: number, friends: number[]) {
    await this.redis.hset(this.KEY, charId, "online:" + Date.now());
    await this.redis.expire(this.KEY, 60 * 60 * 26);        // 안전망 TTL
    for (const f of friends) {
      await this.pub.publish(this.NOTIFY + ":" + f,
        JSON.stringify({ id: charId, state: "online" }));
    }
  }
  async offline(charId: number, friends: number[]) {
    await this.redis.hdel(this.KEY, charId);
    for (const f of friends) {
      await this.pub.publish(this.NOTIFY + ":" + f,
        JSON.stringify({ id: charId, state: "offline" }));
    }
  }

  /** 목록 조회: 한 번의 HMGET으로 N명 상태 */
  async statuses(ids: number[]): Promise<Map<number, boolean>> {
    if (!ids.length) return new Map();
    const vals = await this.redis.hmget(this.KEY, ...ids.map(String));
    const out = new Map<number, boolean>();
    ids.forEach((id, i) => out.set(id, vals[i] != null));
    return out;
  }
}

/** 친구 목록 + 상태 합성 응답 */
import { Kysely } from "kysely";
type DB = import("./schema").Database;
export async function friendList(db: Kysely<DB>, presence: PresenceService, charId: number) {
  const rows = await db.selectFrom("friendships")
    .where(eb => eb.or([
      eb("user_a", "=", charId), eb("user_b", "=", charId),
    ]))
    .where("status", "=", "accepted")
    .select(["user_a", "user_b"]).execute();
  const ids = rows.map(r => (r.user_a === charId ? r.user_b : r.user_a));
  const states = await presence.statuses(ids);
  return ids.map(id => ({ id, online: states.get(id) ?? false }));
}

/** 차단: 양방향 거부 검증(귓속말/초대 전 확인) */
export async function isBlocked(db: Kysely<DB>, a: number, b: number) {
  const row = await db.selectFrom("friend_blocks")
    .where(eb => eb.or([
      eb.and([eb("blocker", "=", a), eb("blocked", "=", b)]),
      eb.and([eb("blocker", "=", b), eb("blocked", "=", a)]),
    ])).select("blocker").executeTakeFirst();
  return !!row;
}`,
      },
    ],
    tips: [
      "presence 해시에 TTL(26시간)을 두면 크래시로 로그아웃 처리가 누락돼도 상태가 자동 정리된다.",
      "접속 알림은 pub/sub 토픽(presence:notify:<id>)으로 — 폴링으로 상태를 확인하면 친구 500명에서 500회 쿼리가 된다.",
      "차단은 양방향으로 검증해야 '내가 차단해도 상대가 귓속말을 보낸다'는 사각지대가 없다.",
      "친구 요청 일일 상한(20회)은 신규 서버 오픈 시 스팸 요청 폭탄을 막는 필수 장치다.",
    ],
  },
  {
    id: "055",
    title: "1:1 개인 거래 시스템 (아이템/재화 상호 수락 및 Kysely DB 트랜잭션)",
    role: [
      "1:1 거래는 '양쪽이 제안물을 등록하고, 양쪽이 수락하면 동시 교환'하는 상태머신이다. 상태 흐름은 open → both_locked(양쪽 잠금) → confirmed(양쪽 최종 확인) → executed/failed다. 핵심 안전장치는 세 가지다. (1) 잠금 후에는 제안물 변경 불가 — 변경 시 잠금 해제, (2) 최종 확인 후 실행은 단일 DB 트랜잭션, (3) 실행 전 소유권 재검증(거래 중 아이템이 인벤토리에서 사라진 경우 실패 처리).",
      "구현 포인트는 거래 참여 중 다른 경로(우편, 경매, 창고)로 아이템을 옮기지 못하게 하는 '거래 잠금'이다. character_items에 trade_lock 칼럼 또는 Redis 락 키로 구현하며, 모든 자산 이동 API는 잠금 검사를 통과해야 한다. 실행 트랜잭션은 018번 transferItem/transferGold를 재사용해 소유권 이전의 안전성을 공유한다.",
    ],
    blocks: [
      {
        lang: "server/trade/Trade.ts — 거래 상태머신 + 실행 트랜잭션",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface TradeOffer {
  gold: number;
  items: { itemId: number; itemCode: string }[];
}
export type TradeState = "open" | "locked_a" | "locked_both" | "executed" | "failed";

export class TradeSession {
  state: TradeState = "open";
  offers: Record<"a" | "b", TradeOffer> = { a: { gold: 0, items: [] }, b: { gold: 0, items: [] } };
  lockA = false; lockB = false;
  confirmA = false; confirmB = false;

  constructor(readonly id: string, readonly userA: number, readonly userB: number) {}

  /** 제안 수정 — 상대가 잠금했으면 잠금 해제(사기 방지 표준 규칙) */
  update(userId: number, offer: TradeOffer): boolean {
    const side = this.sideOf(userId);
    if (!side) return false;
    this.offers[side] = offer;
    if (side === "a" && this.lockB) this.lockB = false;
    if (side === "b" && this.lockA) this.lockA = false;
    this.confirmA = this.confirmB = false;      // 수락 초기화
    this.lockA = side === "a" ? this.lockA : this.lockA;
    this.recomputeState();
    return true;
  }
  lock(userId: number) {
    const side = this.sideOf(userId);
    if (side === "a") this.lockA = true;
    if (side === "b") this.lockB = true;
    this.recomputeState();
  }
  confirm(userId: number) {
    if (this.state !== "locked_both") return false;
    if (this.sideOf(userId) === "a") this.confirmA = true; else this.confirmB = true;
    return this.confirmA && this.confirmB;      // 둘 다 true → execute
  }
  private recomputeState() {
    this.state = this.lockA && this.lockB ? "locked_both"
      : this.lockA || this.lockB ? "locked_a" : "open";
  }
  private sideOf(userId: number): "a" | "b" | null {
    return userId === this.userA ? "a" : userId === this.userB ? "b" : null;
  }
}

/** 최종 실행: 단일 트랜잭션 + 소유권 재검증 */
export async function executeTrade(db: Kysely<DB>, t: TradeSession) {
  return db.transaction().execute(async tx => {
    // 1) 소유권 재검증(거래 중 변경 감지)
    for (const side of ["a", "b"] as const) {
      for (const it of t.offers[side].items) {
        const owner = await tx.selectFrom("character_items")
          .where("id", "=", it.itemId).select("character_id").executeTakeFirst();
        const expected = side === "a" ? t.userA : t.userB;
        if (!owner || owner.character_id !== expected) throw new Error("OWNERSHIP_CHANGED");
      }
    }
    // 2) 재화 이전(018번 트랜잭션 헬퍼 재사용)
    if (t.offers.a.gold > 0) {
      await transferGoldInTx(tx, t.userA, t.userB, t.offers.a.gold, "trade:" + t.id);
    }
    if (t.offers.b.gold > 0) {
      await transferGoldInTx(tx, t.userB, t.userA, t.offers.b.gold, "trade:" + t.id);
    }
    // 3) 아이템 소유권 이전
    for (const it of t.offers.a.items) {
      await transferItemInTx(tx, it.itemId, t.userA, t.userB, "trade:" + t.id);
    }
    for (const it of t.offers.b.items) {
      await transferItemInTx(tx, it.itemId, t.userB, t.userA, "trade:" + t.id);
    }
    t.state = "executed";
    return true;
  }).catch(e => { t.state = "failed"; throw e; });
}

async function transferGoldInTx(tx: any, from: number, to: number, amount: number, ref: string) {
  const u = await tx.selectFrom("users").where("id", "=", from).select("gold").forUpdate().executeTakeFirstOrThrow();
  if (u.gold < amount) throw new Error("NO_FUNDS");
  await tx.updateTable("users").set(eb => ({ gold: eb("gold", "-", amount) })).where("id", "=", from).execute();
  await tx.updateTable("users").set(eb => ({ gold: eb("gold", "+", amount) })).where("id", "=", to).execute();
  await tx.insertInto("ledger").values({ at: new Date(), kind: "gold",
    from_user: from, to_user: to, ref, payload: JSON.stringify({ amount }) }).execute();
}
async function transferItemInTx(tx: any, itemId: number, from: number, to: number, ref: string) {
  const it = await tx.selectFrom("character_items").where("id", "=", itemId).forUpdate().executeTakeFirstOrThrow();
  if (it.character_id !== from) throw new Error("OWNERSHIP_CHANGED");
  if ((it as any).binding === "bound") throw new Error("BOUND_ITEM");
  await tx.updateTable("character_items").set({ character_id: to })
    .where("id", "=", itemId).execute();
  await tx.insertInto("ledger").values({ at: new Date(), kind: "item",
    from_user: from, to_user: to, ref, payload: JSON.stringify({ itemId }) }).execute();
}`,
      },
    ],
    tips: [
      "잠금 후 제안 변경 시 상대 잠금 해제는 1:1 거래 사기(스위치 스캠)를 막는 표준 규칙이다.",
      "실행 트랜잭션에서 소유권 재검증은 필수다 — 잠금 사이에 아이템이 우편/창고로 이동하는 레이스가 실제로 발생한다.",
      "거래 잠금(trade_lock)은 모든 자산 이동 API(우편, 경매 등록 등)가 공통으로 검사해야 완전하다.",
      "귀속(bound) 아이템은 거래 단계부터 차단해 실행 트랜잭션에서 실패하는 낭비를 없앤다.",
    ],
  },
];
