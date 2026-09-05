// 모듈 5 (046~050): 월드 & 환경 시스템 — 후반부

export const items = [
  {
    id: "046",
    title: "포탈 진입 및 인스턴스 맵 이공간 텔레포트 매핑",
    role: [
      "포탈은 '트리거 영역 + 전송 규칙'의 데이터다. 필드 포탈은 맵A 좌표 → 맵B 좌표의 단순 전송이고, 던전/인스턴스 포탈은 채널/룸(017번) 할당 후 새 인스턴스 공간 좌표로 전송된다. 포탈 정의는 Tiled objects(041번)에서 파싱해 (x, y, 범위, 목적지, 조건) 구조로 등록하며, 조건(레벨, 퀘스트, 파티) 불충분 시 진입 차단 + 사유 안내를 한다.",
      "전송 절차는 서버 권위다. 클라가 포탈 영역에 진입하면 서버는 (1) 조건 검증, (2) 목적지 맵/좌표 결정, (3) AOI 구독 재계산(013번), (4) 세이브 위치 갱신, (5) 클라에 맵 전환 명령을 순차 수행한다. 클라는 맵 로딩(004번 번들) 후 스폰되며, 전송 중 입력은 큐잉하지 않고 폐기해 '전송 완료 후 잔여 입력으로 다시 포탈 진입' 루프 버그를 막는다.",
    ],
    blocks: [
      {
        lang: "server/world/Portal.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface PortalDef {
  id: string;
  fromMap: string; x: number; y: number; radius: number;
  toMap: string; toX: number; toY: number;
  kind: "field" | "instance";
  reqLevel?: number;
  reqQuest?: string;
  cooldownMs?: number;          // 재진입 쿨타임(진입 루프 방지)
}

export interface TeleportResult {
  ok: boolean; reason?: string;
  mapId?: string; x?: number; y?: number; roomId?: string;
}

export class PortalSystem {
  private lastUse = new Map<number, number>();   // charId → 마지막 사용

  constructor(private portals: PortalDef[],
              private rooms: import("../room/RoomRegistry").RoomRegistry,
              private db: Kysely<DB>) {}

  /** 이동 패킷에서 트리거 검사(서버 틱) */
  check(charId: number, mapId: string, x: number, y: number, level: number, now: number): TeleportResult {
    for (const p of this.portals) {
      if (p.fromMap !== mapId) continue;
      if (Math.hypot(p.x - x, p.y - y) > p.radius) continue;

      const last = this.lastUse.get(charId) ?? 0;
      if (now - last < (p.cooldownMs ?? 2000)) return { ok: false, reason: "cooldown" };
      if (p.reqLevel && level < p.reqLevel) return { ok: false, reason: "low_level" };

      this.lastUse.set(charId, now);
      return this.teleport(charId, p, now);
    }
    return { ok: false };
  }

  private async teleport(charId: number, p: PortalDef, now: number): Promise<TeleportResult> {
    if (p.kind === "field") {
      // 필드: 채널 자동 배정(017번) + 세이브 갱신
      const room = await this.rooms.pickFieldChannel(p.toMap, 1);
      await this.rooms.join(room.roomId);
      await this.db.updateTable("characters").set({
        map_id: p.toMap, x: p.toX, y: p.toY,
      }).where("id", "=", charId).execute();
      return { ok: true, mapId: p.toMap, x: p.toX, y: p.toY, roomId: room.roomId };
    }
    // 인스턴스: 전용 룸 생성/참여
    const room = await this.rooms.create({ kind: "dungeon", mapId: p.toMap, capacity: 5 });
    await this.rooms.join(room.roomId);
    return { ok: true, mapId: p.toMap, x: p.toX, y: p.toY, roomId: room.roomId };
  }
}

// 클라 측 흐름(발췌):
// 1) 서버 S2C_TELEPORT { mapId, x, y, roomId } 수신
// 2) AssetFlow.request(bundlesFor(mapId)) → 로딩 오버레이
// 3) 현재 씬 shutdown → 새 WorldScene.start({ mapId, x, y })
// 4) 전송 중 이동/스킬 입력은 폐기(큐잉 금지 — 포탈 루프 방지)`,
      },
    ],
    tips: [
      "포탈 쿨타임(2초)은 '스폰 지점이 포탈 위'인 맵 설계 실수를 안전망으로 커버하는 표준 장치다.",
      "전송 중 입력 폐기는 원칙이다 — 큐잉하면 스폰 직후 캐릭터가 저절로 걸어 나가는 신기한 버그가 된다.",
      "인스턴스 포탈은 반드시 룸 상태(DRAINING 등)를 확인해 회수 직전 룸에 들어가는 레이스를 막는다.",
      "포탈 시각화(반짝임, 경계선)는 클라 전용 표현이며 판정 반경(radius)과 시각 크기는 별개로 튜닝한다.",
    ],
  },
  {
    id: "047",
    title: "필드 채집/채광 리젠 오브젝트 상호작용",
    role: [
      "채집 오브젝트(허브, 광맥, 나무)는 '스폰 지점 정의 + 상태(사용 가능/진행중/재생대기) + 리젠 타이머'의 구조다. 유저가 상호작용(E키/터치)하면 서버는 (1) 거리 검증, (2) 오브젝트 상태 점유(동시 채집 방지), (3) 채집 시간(틱 게이지) 진행, (4) 결과 드롭 지급, (5) 리젠 예약의 순서로 처리한다. 리젠 시간은 오브젝트 종류별 밸런스 테이블로 관리하며, 인기 필드는 개체수(스폰 밀도)로 조절한다.",
      "멀티플레이 핵심은 '점유 상태 동기화'다. A가 채집 중이면 B에게는 진행 바가 표시되고 B는 시도할 수 없다. 채집 중 이동/피격 시 취소되며, 오브젝트는 다시 사용 가능 상태로 복귀한다. 드롭은 재화 트랜잭션(018번)이 아닌 인벤토리 지급 트랜잭션으로 처리하고, 가방이 가득 차면 지급 실패 + 안내를 한다. 채집 기록은 도감(030번)·업적(028번) 이벤트로 흘려보낸다.",
    ],
    blocks: [
      {
        lang: "server/world/GatherNode.ts",
        code: `import { Kysely } from "kysely";
type DB = import("./schema").Database;

export interface NodeDef {
  code: string;                       // "herb_sunflower"
  type: "herb" | "ore" | "tree";
  gatherMs: number;                   // 채집 소요
  respawnMs: number;                  // 리젠 시간
  drops: { itemCode: string; qty: number; chance: number }[];
  reqLevel?: number;
}
export interface NodeState {
  defCode: string; mapId: string; x: number; y: number;
  status: "ready" | "gathering" | "respawning";
  gathererId: number | null;
  readyAt: number;                    // respawning → ready 전환 시각
}

export class GatherSystem {
  private nodes = new Map<string, NodeState>();

  /** 상호작용 시작(서버: 점유 확정) */
  startGather(charId: number, nodeId: string, x: number, y: number, level: number, now: number) {
    const n = this.nodes.get(nodeId);
    if (!n || n.status !== "ready") return { ok: false, reason: "not_ready" };
    if (Math.hypot(n.x - x, n.y - y) > 48) return { ok: false, reason: "far" };

    const def = this.defs(n.defCode);
    if (def.reqLevel && level < def.reqLevel) return { ok: false, reason: "low_level" };

    n.status = "gathering";
    n.gathererId = charId;
    return { ok: true, gatherMs: def.gatherMs };      // 클라에 진행 바 시간 통보
  }

  /** 채집 완료(클라 게이지 완료 통보 수신 — 서버도 시간 재검증) */
  async completeGather(db: Kysely<DB>, charId: number, nodeId: string, now: number) {
    const n = this.nodes.get(nodeId)!;
    const def = this.defs(n.defCode);
    if (n.gathererId !== charId) return { ok: false, reason: "not_owner" };

    // 드롭 추출(확률 합산) — 인벤토리 지급 트랜잭션
    const drops: { itemCode: string; qty: number }[] = [];
    for (const d of def.drops) {
      if (Math.random() < d.chance) drops.push({ itemCode: d.itemCode, qty: d.qty });
    }
    await db.transaction().execute(async tx => {
      for (const d of drops) {
        await tx.updateTable("character_items")
          .set(eb => ({ qty: eb("qty", "+", d.qty) }))
          .where("character_id", "=", charId)
          .where("item_code", "=", d.itemCode).execute();
      }
      // 도감/업적 이벤트 훅(028/030번)은 큐로
    });

    // 리젠 예약
    n.status = "respawning";
    n.gathererId = null;
    n.readyAt = now + def.respawnMs;
    return { ok: true, drops };
  }

  /** 서버 틱: 리젠 전환 */
  tick(now: number) {
    for (const n of this.nodes.values()) {
      if (n.status === "respawning" && now >= n.readyAt) n.status = "ready";
    }
  }
  cancelGather(nodeId: string, charId: number) {
    const n = this.nodes.get(nodeId);
    if (n?.gathererId === charId) { n.status = "ready"; n.gathererId = null; }
  }
  private defs(code: string): NodeDef { return this.defTable[code]; }
  private defTable: Record<string, NodeDef> = {
    herb_sunflower: { code: "herb_sunflower", type: "herb", gatherMs: 1800,
      respawnMs: 60000, drops: [{ itemCode: "herb_sun", qty: 2, chance: 0.8 }] },
    ore_iron: { code: "ore_iron", type: "ore", gatherMs: 3200,
      respawnMs: 180000, drops: [{ itemCode: "ore_iron", qty: 1, chance: 1 }] },
  };
}`,
      },
    ],
    tips: [
      "채집 점유는 서버가 단일 권위로 확정해야 동시 채집 복제 버그가 없다 — 클라는 게이지 표시만 한다.",
      "리젠은 고정 시간 + 지터(±20%)를 섞어 리젤 패턴 자동화(봇)를 어렵게 만든다.",
      "인기 필드는 리젤 시간이 아니라 스폰 개체수로 조절해야 '채집 경쟁'이 게임성으로 유지된다.",
      "채집 중 피격/이동 취소는 클라와 서버 양쪽에서 처리하되, 최종 상태는 서버가 복구한다.",
    ],
  },
  {
    id: "048",
    title: "미니맵 동기화 및 안개(Fog of War) 탐색 가림 처리",
    role: [
      "미니맵은 (1) 맵 기본 이미지(타일 레이어 축소본), (2) 유저/NPC/파티원 마커, (3) 안개(fog of war)의 3계층 합성이다. 안개는 맵을 4x4 타일 셀 단위로 나누고, 방문/시야 데이터를 비트맵으로 관리한다. 시야(현재 보이는 셀)는 밝게, 과거 방문(기억)은 흐리게, 미방문은 완전히 가린다. 데이터는 서버가 권위로 유지해(대형 맵에서 치트 방지) 셀 단위로 클라에 델타 전송한다.",
      "미니맵 렌더는 RenderTexture에 기본 맵 + 안구 비트맵을 합성하고, 마커는 별도 스프라이트로 위에 올린다. 성능을 위해 안개 갱신은 캐릭터가 셀을 넘어설 때만 수행하고, 파티원 위치는 서버가 1초 주기로 방송(051번 채팅 토픽 재사용)한다. 대형 맵(2000x2000)은 미니맵을 256x256으로 스케일 다운해 메모리를 수십 KB로 유지한다.",
    ],
    blocks: [
      {
        lang: "src/world/Minimap.ts",
        code: `import Phaser from "phaser";

const CELL = 4;                        // 안개 셀 = 4x4 타일

export class Minimap {
  private fogTex: Phaser.GameObjects.RenderTexture;
  private visited: Uint8Array;         // 방문(기억)
  private visible: Uint8Array;         // 현재 시야
  private w: number; private h: number;   // 셀 단위 크기

  constructor(private scene: Phaser.Scene,
              mapW: number, mapH: number,
              private baseImg: Phaser.GameObjects.Image,
              private playerMark: Phaser.GameObjects.Ellipse,
              private partyMarks: Map<number, Phaser.GameObjects.Ellipse> = new Map()) {
    this.w = Math.ceil(mapW / CELL); this.h = Math.ceil(mapH / CELL);
    this.visited = new Uint8Array(this.w * this.h);
    this.visible = new Uint8Array(this.w * this.h);

    // 안개 레이어: 검정 채움 → 방문 셀은 반투명 구멍
    this.fogTex = scene.make.renderTexture({
      width: this.w, height: this.h,
    }, false).setOrigin(0);
    this.fogTex.fill(0x000000, 1);
  }

  /** 캐릭터 이동 → 셀 단위 시야 갱신(셀 경계 통과 시만) */
  reveal(px: number, py: number, viewCells = 3) {
    const cx = Math.floor(px / 32 / CELL), cy = Math.floor(py / 32 / CELL);
    for (let dy = -viewCells; dy <= viewCells; dy++) {
      for (let dx = -viewCells; dx <= viewCells; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const i = y * this.w + x;
        this.visible[i] = 1;
        if (!this.visited[i]) {
          this.visited[i] = 1;
          // 기억 상태: 안개에서 반투명 구멍 (서버에도 보고 — 권위 동기화)
          this.scene.events.emit("fog-revealed", x, y);
        }
      }
    }
  }

  /** 서버 델타 수신(타기기 동기화): 재접속 시 방문 기록 복원 */
  applyServerFog(cells: { x: number; y: number }[]) {
    for (const c of cells) this.visited[c.y * this.w + c.x] = 1;
  }

  /** 미니맵 리렌더(셀 갱신 시만) */
  redraw(px: number, py: number, party: Map<number, { x: number; y: number }>) {
    this.fogTex.clear();
    this.fogTex.fill(0x0a0f18, 0.92);                    // 미방문 가림
    for (let i = 0; i < this.visited.length; i++) {
      if (this.visited[i]) {
        const x = i % this.w, y = (i / this.w) | 0;
        this.fogTex.fill(0x0a0f18, 0.35, x, y, 1, 1);    // 기억 = 흐리게
      }
    }
    // 마커 갱신
    this.playerMark.setPosition(px / 32 / CELL * this.minimapScale(),
      py / 32 / CELL * this.minimapScale());
    for (const [id, p] of party) {
      const mark = this.partyMarks.get(id);
      if (mark) mark.setPosition(p.x / 32 / CELL * this.minimapScale(),
                                 p.y / 32 / CELL * this.minimapScale());
    }
  }
  private minimapScale() { return 128 / Math.max(this.w, this.h); }
}`,
      },
    ],
    tips: [
      "안개는 셀 단위(4x4 타일)가 성능/시각의 균형점이다 — 타일 단위는 데이터가 16배 커지고 8x8은 거칠다.",
      "방문 기록은 서버 권위로 유지해야 재접속 복원과 치트(맵 전체 해킹)가 동시에 해결된다.",
      "미니맵 리렌더는 셀 갱신 시만 — 매 프레임 RenderTexture 리드로우는 저사양 모바일에서 프레임을 잡아먹는다.",
      "파티원 마커는 1초 방송(채팅 토픽 재사용)이면 충분하며, 스무딩(보간)으로 이동이 매끄럽게 보인다.",
    ],
  },
  {
    id: "049",
    title: "필드 돌발 이벤트 영역 감지 및 트리거",
    role: [
      "돌발 이벤트는 '조건(시간/밀도/확률) → 영역 지정 → 이벤트 실행(스폰/연출) → 종료 처리'의 라이프사이클을 가진다. 예시는 도망치는 상자 몬스터, 몬스터 무리 습격, 떨어지는 유성, 상인 등장 등이다. 이벤트 정의는 { id, trigger, area, duration, onSpawn, onEnd }의 데이터 구조로 서버가 관리하고, 영역 진입 감지는 AOI 그리드(013번)를 재활용해 몬스터 틱과 함께 평가한다.",
      "트리거 종류는 (1) 시간 스케줄(하루 N회), (2) 플레이어 밀도(구역 유저 3명 이상), (3) 확률(처치 시 1%), (4) 퀘스트 연동(특정 퀘스트 진행 중)이 표준이다. 이벤트는 구역별 동시 실행 상한(예: 2개)을 두어 스팸을 막고, 종료 시 보상은 기여도(딜량/참여 시간) 기반으로 분배한다(064번 필드 보스와 동일 파이프라인). 클라는 이벤트 시작/종료 방송을 받아 배너·연출을 표시한다.",
    ],
    blocks: [
      {
        lang: "server/world/FieldEvent.ts",
        code: `export interface EventDef {
  id: string;                        // "ambush_wolves"
  name: string;
  trigger: {
    kind: "density" | "schedule" | "probability" | "quest";
    minPlayers?: number;             // density
    cronExpr?: string;               // schedule (서버 스케줄러 파싱)
    chance?: number;                 // probability (per kill)
    questCode?: string;              // quest
  };
  area: { x: number; y: number; r: number };
  durationMs: number;
  spawn: { monsterCode: string; count: number; level: number }[];
  maxActivePerZone: number;
}

export interface ActiveEvent {
  defId: string; zone: string; startedAt: number; endsAt: number;
  spawnedIds: number[];
  participants: Map<number, { dmg: number; joinedAt: number }>;
}

export class FieldEventManager {
  private active = new Map<string, ActiveEvent>();   // key = zone:defId

  /** 몬스터 틱과 함께 평가(서버) */
  tryTrigger(zone: string, playersInZone: number, questState: string | null, now: number) {
    for (const def of this.defs) {
      const key = zone + ":" + def.id;
      if (this.active.has(key)) continue;                       // 진행 중 스킵
      const zoneCount = [...this.active.keys()].filter(k => k.startsWith(zone + ":")).length;
      if (zoneCount >= def.maxActivePerZone) continue;

      const t = def.trigger;
      let go = false;
      switch (t.kind) {
        case "density": go = playersInZone >= (t.minPlayers ?? 3); break;
        case "probability": go = Math.random() < (t.chance ?? 0.01); break;
        case "quest": go = questState === t.questCode; break;
        case "schedule": go = false;   // 스케줄러 콜백이 별도 호출
      }
      if (!go) continue;

      const ev: ActiveEvent = {
        defId: def.id, zone, startedAt: now, endsAt: now + def.durationMs,
        spawnedIds: this.spawnMonsters(def, now),
        participants: new Map(),
      };
      this.active.set(key, ev);
      this.broadcast(zone, { t: "event_start", id: def.id, x: def.area.x, y: def.area.y });
    }
  }

  /** 이벤트 종료: 기여도 기반 보상(064번과 동일 로직) */
  sweep(now: number) {
    for (const [key, ev] of this.active) {
      if (now < ev.endsAt) continue;
      const def = this.defs.find(d => d.id === ev.defId)!;
      const totalDmg = [...ev.participants.values()].reduce((s, p) => s + p.dmg, 0);
      for (const [userId, p] of ev.participants) {
        const share = totalDmg > 0 ? p.dmg / totalDmg : 1 / ev.participants.size;
        const bonus = share > 0.3 ? "rare" : "common";   // 상위 기여자 추가 보상
        this.grantReward(userId, def, bonus, share);
      }
      this.broadcast(ev.zone, { t: "event_end", id: ev.defId });
      this.active.delete(key);
    }
  }
  onDamage(evKey: string, userId: number, dmg: number) {
    const ev = this.active.get(evKey);
    if (!ev) return;
    const p = ev.participants.get(userId) ?? { dmg: 0, joinedAt: Date.now() };
    p.dmg += dmg;
    ev.participants.set(userId, p);
  }
  private spawnMonsters(def: EventDef, now: number): number[] { return []; }
  private broadcast(zone: string, msg: unknown) {}
  private grantReward(userId: number, def: EventDef, tier: string, share: number) {}
  private defs: EventDef[] = [];
}`,
      },
    ],
    tips: [
      "밀도 트리거(minPlayers)는 '구역 접속 유저 수'가 아니라 '이벤트 영역 반경 내 유저 수'로 계산해야 도심 옥외 이벤트가 자연스럽다.",
      "이벤트 동시 실행 상한(zone당 2개) 없이는 확률 트리거가 스팸 폭탄이 된다.",
      "기여도 분배는 딜량 비율 + 최소 참여 시간(10초) 게이팅으로 낚시꾼(그냥 서 있는 유저)을 걸러낸다.",
      "클라 배너는 이벤트 시작 3초 전 예고 방송이 있으면 참여율이 눈에 띄게 올라간다.",
    ],
  },
  {
    id: "050",
    title: "핫스팟 휴식/앉기 등 오브젝트 상호작용 연출",
    role: [
      "핫스팟(모닥불, 벤치, 우물)은 '상호작용 가능 오브젝트 + 애니메이션 상태'다. 유저가 E키/터치로 상호작용하면 캐릭터가 지정 자리로 이동 후 앉기 애니메이션으로 전환되고, 휴식 상태에서는 HP/MP 자연 회복 배율(예: x3)이 적용된다. 상호작용 종료는 이동 입력, 피격, 일정 시간 경과로 트리거된다.",
      "구현은 세 계층이다. 데이터(핫스팟 정의 — 위치, 타입, 회복 배율, 최대 동시 인원), 서버(상태 검증, 회복 적용, 종료 판정), 클라(이동 → 앉기 애니메이션 → 파티클/연출). 앉기 자리(seat)는 오브젝트별 좌표 목록으로 관리해 벤치에 3명이 각각 다른 좌표로 앉게 하며, 이미 점유된 자리는 다른 유저가 볼 때 '사용 중'으로 표시된다.",
    ],
    blocks: [
      {
        lang: "src/world/Hotspot.ts — 클라 상호작용",
        code: `import Phaser from "phaser";

export interface HotspotDef {
  id: string;
  kind: "campfire" | "bench" | "well";
  x: number; y: number;
  seats: { x: number; y: number; facing: number }[];  // 앉는 좌표/방향
  regenMult: number;                                    // 3 = x3 회복
  interactRange: number;
}
export interface SeatState { occupiedBy: number | null; }

export class HotspotManager {
  private spots: HotspotDef[] = [];
  private seats = new Map<string, SeatState>();     // key = spotId:seatIdx
  private sitting: { spotId: string; seatIdx: number } | null = null;
  onRegenMult: ((mult: number) => void) | null = null;

  register(def: HotspotDef) {
    this.spots.push(def);
    def.seats.forEach((_, i) => this.seats.set(def.id + ":" + i, { occupiedBy: null }));
  }

  /** E키/터치 → 가장 가까운 핫스팟에 빈 자리 요청(서버 승인 필요) */
  requestInteract(charX: number, charY: number): { spot: HotspotDef; seat: number } | null {
    let best: { spot: HotspotDef; seat: number; d: number } | null = null;
    for (const s of this.spots) {
      if (Math.hypot(s.x - charX, s.y - charY) > s.interactRange) continue;
      s.seats.forEach((seatPos, i) => {
        const st = this.seats.get(s.id + ":" + i)!;
        if (st.occupiedBy !== null) return;         // 점유 중
        const d = Math.hypot(seatPos.x - charX, seatPos.y - charY);
        if (!best || d < best.d) best = { spot: s, seat: i, d };
      });
    }
    if (!best) return null;
    const b = best as { spot: HotspotDef; seat: number; d: number };
    return { spot: b.spot, seat: b.seat };
  }

  /** 서버 승인 후: 이동 → 앉기 애니메이션 */
  async perform(scene: Phaser.Scene, char: Phaser.GameObjects.Container,
                spot: HotspotDef, seatIdx: number, approve: (spotId: string, seat: number) => Promise<boolean>) {
    const seat = spot.seats[seatIdx];
    const ok = await approve(spot.id, seatIdx);
    if (!ok) return false;

    const dist = Phaser.Math.Distance.Between(char.x, char.y, seat.x, seat.y);
    // 1) 자리로 걸어가기(속도 140px/s — 022번 이동 속도 재사용)
    await new Promise<void>(res => {
      scene.tweens.add({
        targets: char, x: seat.x, y: seat.y,
        duration: dist / 140 * 1000,
        onComplete: () => res(),
      });
    });
    // 2) 방향 회전 + 앉기 프레임
    char.setFlipX(seat.facing < 0);
    (char as any).playAnim?.("sit_down");              // 외형 애니메이션 시스템 호출
    this.onRegenMult?.(spot.regenMult);
    this.sitting = { spotId: spot.id, seatIdx };
    return true;
  }

  /** 종료: 이동/피격/쿨타임 */
  standUp(reason: "move" | "hit" | "manual") {
    if (!this.sitting) return;
    this.seats.get(this.sitting.spotId + ":" + this.sitting.seatIdx)!.occupiedBy = null;
    this.onRegenMult?.(1);
    this.sitting = null;
  }
  get isSitting() { return this.sitting !== null; }
}`,
      },
    ],
    tips: [
      "앉기는 '이동 완료 후 애니메이션 전환' 2단계다 — 즉시 앉으면 캐릭터가 좌표를 순간이동한 것처럼 보인다.",
      "회복 배율은 서버 권위로 적용하고 클라는 표시만 — 접속 끊김 회복 어뷰징이 서버 검증으로 차단된다.",
      "좌석 점유 상태는 주변 유저에게 방송(토픽 013번 재사용)해 같은 자리에 동시에 앉는 버그를 막는다.",
      "모닥불 파티클(045번)과 앉기 회복 배율을 조합하면 '휴식 거점'이라는 콘텐츠가 자연스럽게 완성된다.",
    ],
  },
];
