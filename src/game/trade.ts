/**
 * vc142 (#3) — 1:1 플레이어 거래 상태 머신
 *
 * 유저 지시: "유저끼리 1대1 거래 가능하게 만들기 (아이템, 골드, 에메랄드 전부가능하게)"
 *
 * 구조:
 *  · 전송: MQTT 개인 토픽(mpMqtt.tradeSend) — treq→tacc→toff(오버 동기화)→tlock(확정)
 *  · 검증: 각 클라이언트가 자기 세이브 기준으로 로컬 검증 (공개 브로커 신뢰 없음)
 *    - tradeLock/gmOnly 아이템 제외, 미보유/장착 중 제외, 골드·에메랄드 잔액 검증
 *  · 확정: 양쪽 모두 tlock을 받으면 각자 로컬에서 동일 순서로 적용(제거→수령) — 결과 동일 보장
 *  · 세션 타임아웃: 요청 30초 / 거래창 180초 — 무응답 자동 취소
 */
import { EventBus } from "../components/game/EventBus";
import { ITEMS, type ItemKey } from "./data";
import { mpActive, mpConnect } from "./mpMqtt";

export type TradeOffer = { items: string[]; gold: number; emerald: number };
export type TradePhase = "idle" | "outgoing" | "incoming" | "open" | "done";

export type TradeSnapshot = {
  phase: TradePhase;
  partnerId: string;
  partnerName: string;
  mine: TradeOffer;
  theirs: TradeOffer;
  meLocked: boolean;
  theyLocked: boolean;
  note: string;
};

export type TradeBackend = {
  myName(): string;
  /** 제안 가능 여부 — 보유 + tradeLock/gmOnly/장착중 제외 */
  canOffer(key: string): { ok: boolean; why: string };
  countOwned(key: string): number;
  gold(): number;
  emerald(): number;
  /** 최종 적용 (양쪽 잠금 직후 — 내가 걸은 것 제거 + 상대가 걸은 것 수령) */
  apply(mine: TradeOffer, theirs: TradeOffer): void;
  notify(text: string): void;
};

const REQ_TIMEOUT = 30000;
const OPEN_TIMEOUT = 180000;

const emptyOffer = (): TradeOffer => ({ items: [], gold: 0, emerald: 0 });

class TradeSession {
  phase: TradePhase = "idle";
  partnerId = "";
  partnerName = "";
  mine = emptyOffer();
  theirs = emptyOffer();
  meLocked = false;
  theyLocked = false;
  note = "";
  private timeout: ReturnType<typeof setTimeout> | null = null;

  snapshot(): TradeSnapshot {
    return {
      phase: this.phase,
      partnerId: this.partnerId,
      partnerName: this.partnerName,
      mine: { ...this.mine, items: [...this.mine.items] },
      theirs: { ...this.theirs, items: [...this.theirs.items] },
      meLocked: this.meLocked,
      theyLocked: this.theyLocked,
      note: this.note,
    };
  }

  reset(note = "") {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    this.phase = "idle";
    this.partnerId = "";
    this.partnerName = "";
    this.mine = emptyOffer();
    this.theirs = emptyOffer();
    this.meLocked = false;
    this.theyLocked = false;
    this.note = note;
  }

  setNote(note: string) {
    this.note = note;
  }

  armTimeout(ms: number, onExpire: () => void) {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(onExpire, ms);
  }
}

const S = new TradeSession();
let backend: TradeBackend | null = null;
let wired = false;

function publish(): void {
  EventBus.emit("trade:state", S.snapshot());
}

function send(k: string, offer?: TradeOffer): void {
  const bus = mpActive() ? mpConnect() : null;
  if (!bus || !S.partnerId) return;
  const body: Record<string, unknown> = { k, name: backend?.myName() ?? "" };
  if (offer) {
    body.items = offer.items;
    body.gold = offer.gold;
    body.emerald = offer.emerald;
  }
  (bus as unknown as { tradeSend: (to: string, msg: Record<string, unknown>) => void }).tradeSend(S.partnerId, body);
}

/** MQTT "trade" 이벤트 수신 연결 (최초 1회) */
function wire(): void {
  if (wired) return;
  wired = true;
  const bus = mpConnect();
  if (!bus) return;
  bus.on("trade", (...args: unknown[]) => {
    const m = args[0] as { k: string; from: string; name?: string; offer?: TradeOffer };
    try { onTradeMsg(m); } catch (e) {
      console.warn("[SERTZ] 거래 메시지 처리 오류", e);
    }
  });
}

/** 거래 모듈 초기화 — WorldScene이 백엔드를 주입 */
export function initTrade(b: TradeBackend): void {
  backend = b;
  wire();
}

/** 거래 요청 보내기 (근처 플레이어 목록에서) */
export function tradeInvite(pid: string, name: string): void {
  if (!mpActive()) {
    backend?.notify("멀티플레이가 꺼져 있어 거래할 수 없어요 — 인터넷 연결 후 다시 시도");
    return;
  }
  if (S.phase !== "idle" && S.phase !== "done") {
    backend?.notify("이미 진행 중인 거래가 있어요");
    return;
  }
  S.reset();
  S.phase = "outgoing";
  S.partnerId = pid;
  S.partnerName = name;
  S.note = `${name}에게 거래 요청 대기 중…`;
  send("treq");
  publish();
  S.armTimeout(REQ_TIMEOUT, () => {
    if (S.phase === "outgoing") {
      S.reset("응답이 없어 거래 요청이 만료됐어요");
      publish();
      backend?.notify("거래 요청 응답 없음 — 만료");
    }
  });
}

/** 들어온 거래 요청 수락 */
export function tradeAccept(): void {
  if (S.phase !== "incoming") return;
  S.phase = "open";
  S.note = "아이템·골드·에메랄드를 걸고 확정을 누르세요";
  send("tacc");
  publish();
  S.armTimeout(OPEN_TIMEOUT, () => {
    if (S.phase === "open" || S.phase === "outgoing" || S.phase === "incoming") {
      S.reset("시간 초과로 거래가 종료됐어요");
      publish();
      backend?.notify("거래 시간 초과");
    }
  });
}

/** 들어온 거래 요청 거절 */
export function tradeDeny(): void {
  if (S.phase !== "incoming") return;
  send("tdeny");
  S.reset();
  publish();
}

/** 거래 취소 (양쪽 아무나) */
export function tradeCancel(silent = false): void {
  if (S.phase === "open" || S.phase === "outgoing" || S.phase === "incoming") {
    if (!silent) send("tcancel");
    backend?.notify("거래가 취소됐어요");
  }
  S.reset();
  publish();
}

/** 내 제안에 아이템 추가 */
export function tradeAddItem(key: string): void {
  if (S.phase !== "open" || S.meLocked || !backend) return;
  if (S.mine.items.length >= 12) { backend.notify("한 번에 12종까지만 걸 수 있어요"); return; }
  const chk = backend.canOffer(key);
  if (!chk.ok) { backend.notify(chk.why); return; }
  if (S.mine.items.filter((k) => k === key).length >= backend.countOwned(key)) {
    backend.notify("보유 수량을 초과했어요");
    return;
  }
  S.mine.items.push(key);
  S.meLocked = false;
  S.theyLocked = false;
  send("toff", S.mine);
  publish();
}

/** 내 제안에서 아이템 제거 */
export function tradeRemoveItem(key: string): void {
  if (S.phase !== "open" || S.meLocked) return;
  const i = S.mine.items.lastIndexOf(key);
  if (i < 0) return;
  S.mine.items.splice(i, 1);
  S.meLocked = false;
  S.theyLocked = false;
  send("toff", S.mine);
  publish();
}

/** 골드/에메랄드 제안 설정 */
export function tradeSetCurrency(gold: number, emerald: number): void {
  if (S.phase !== "open" || S.meLocked || !backend) return;
  S.mine.gold = Math.max(0, Math.min(999999999, Math.floor(gold || 0)));
  S.mine.emerald = Math.max(0, Math.min(999999, Math.floor(emerald || 0)));
  S.meLocked = false;
  S.theyLocked = false;
  send("toff", S.mine);
  publish();
}

/** 내 제안 확정 (잠금) — 양쪽 잠금 시 즉시 교환 적용 */
export function tradeLock(): void {
  if (S.phase !== "open" || S.meLocked || !backend) return;
  /* 최종 검증 — 아이템 보유 수량 + 잔액 */
  for (const k of S.mine.items) {
    const chk = backend.canOffer(k);
    if (!chk.ok) { backend.notify(`${ITEMS[k as ItemKey]?.name ?? k} — ${chk.why}`); return; }
  }
  for (const k of S.mine.items) {
    if (S.mine.items.filter((x) => x === k).length > backend.countOwned(k)) {
      backend.notify("보유 수량이 모자라 교환할 수 없어요");
      return;
    }
  }
  if (S.mine.gold > backend.gold()) { backend.notify("골드가 모자라요"); return; }
  if (S.mine.emerald > backend.emerald()) { backend.notify("에메랄드가 모자라요"); return; }
  S.meLocked = true;
  S.note = S.theyLocked ? "양쪽 모두 확정 — 교환 중…" : "확정 완료 — 상대 확정 대기 중…";
  send("tlock", S.mine);
  publish();
  if (S.theyLocked) settle();
}

/** 양쪽 잠금 완료 — 교환 적용 */
function settle(): void {
  if (!backend || S.phase !== "open" || !S.meLocked || !S.theyLocked) return;
  /* 상대 제안도 최종 재검증 (세탁된 키만 허용 — data에 없는 키는 버린다) */
  const valid = S.theirs.items.filter((k) => !!ITEMS[k as ItemKey] && !(ITEMS[k as ItemKey] as { tradeLock?: boolean; gmOnly?: boolean }).tradeLock && !(ITEMS[k as ItemKey] as { tradeLock?: boolean; gmOnly?: boolean }).gmOnly);
  S.phase = "done";
  S.note = "교환 완료!";
  try {
    backend.apply({ ...S.mine, items: [...S.mine.items] }, { ...S.theirs, items: valid });
    backend.notify("거래 완료!");
  } catch (e) {
    console.error("[SERTZ] 거래 적용 오류", e);
    backend.notify("교환 적용 중 오류 — 세이브는 안전합니다");
  }
  publish();
  S.reset();
  setTimeout(() => publish(), 60);
}

/** MQTT 수신 디스패치 */
function onTradeMsg(m: { k: string; from: string; name?: string; offer?: TradeOffer }): void {
  const name = (m.name || "").slice(0, 8) || "플레이어";
  switch (m.k) {
    case "treq":
      /* 이미 거래 중이면 자동 거절 */
      if (S.phase === "open" || S.phase === "outgoing" || S.phase === "incoming") {
        const tmp = S.partnerId;
        S.partnerId = m.from;
        send("tdeny");
        S.partnerId = tmp;
        return;
      }
      S.reset();
      S.phase = "incoming";
      S.partnerId = m.from;
      S.partnerName = name;
      S.note = `${name}님이 거래를 요청했어요!`;
      backend?.notify(`${name}님의 거래 요청!`);
      EventBus.emit("ui:panel", { panel: "trade2" });
      publish();
      S.armTimeout(REQ_TIMEOUT, () => {
        if (S.phase === "incoming") {
          S.reset("거래 요청이 만료됐어요");
          publish();
        }
      });
      return;
    case "tacc":
      if (S.phase === "outgoing" && m.from === S.partnerId) {
        S.phase = "open";
        S.note = "아이템·골드·에메랄드를 걸고 확정을 누르세요";
        EventBus.emit("ui:panel", { panel: "trade2" });
        publish();
        S.armTimeout(OPEN_TIMEOUT, () => {
          if (S.phase === "open") {
            S.reset("시간 초과로 거래가 종료됐어요");
            publish();
            backend?.notify("거래 시간 초과");
          }
        });
      }
      return;
    case "tdeny":
      if ((S.phase === "outgoing" || S.phase === "open") && m.from === S.partnerId) {
        S.reset(`${name}님이 거래를 거절했어요`);
        backend?.notify("상대가 거래를 거절했어요");
        publish();
      }
      return;
    case "toff":
      if (S.phase === "open" && m.from === S.partnerId && m.offer) {
        S.theirs = {
          items: m.offer.items.slice(0, 12),
          gold: Math.max(0, Math.min(999999999, m.offer.gold | 0)),
          emerald: Math.max(0, Math.min(999999, m.offer.emerald | 0)),
        };
        /* 상대가 오버를 바꾸면 내 잠금도 함께 해제 (재확인 원칙) */
        if (S.meLocked) {
          S.meLocked = false;
          S.note = "상대가 제안을 수정했어요 — 다시 확정하세요";
        }
        S.theyLocked = false;
        publish();
      }
      return;
    case "tlock":
      if (S.phase === "open" && m.from === S.partnerId && m.offer) {
        S.theirs = {
          items: m.offer.items.slice(0, 12),
          gold: Math.max(0, Math.min(999999999, m.offer.gold | 0)),
          emerald: Math.max(0, Math.min(999999, m.offer.emerald | 0)),
        };
        S.theyLocked = true;
        S.note = "상대가 확정했어요";
        backend?.notify("상대가 확정했습니다");
        publish();
        if (S.meLocked) settle();
      }
      return;
    case "tcancel":
      if (m.from === S.partnerId && S.phase !== "idle") {
        S.reset("상대가 거래를 취소했어요");
        backend?.notify("상대가 거래를 취소했어요");
        publish();
      }
      return;
    default:
      return;
  }
}
