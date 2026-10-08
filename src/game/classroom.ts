/**
 * v1.4.30 (#9 클래스룸 — 교실 모드) — 학교 수행평가용 대규모 동시 접속 콘텐츠
 *
 *  [수요] "쌤들이 학교 수행평가로 게임 안에서 미션 같은 걸 한다는데
 *         10명, 20명, 50명, 100명 정도가 즐길 수 있는 미니게임 및 퀘스트"
 *  → 파티(4인 한정)·공동토벌전(파티 의존)으로는 30명+ 수업을 못 담는다.
 *
 *  [설계] 서버 불필요 — 공개 MQTT 브로커(mpMqtt와 동일 후보)의 교실 토픽 하나로
 *   수십~수백 명의 카운터를 합산한다. 각 클라이언트는 3초마다 자기 누적값만 발행
 *   (N명 = N개/3초 — 100인이어도 ~33msg/s로 공개 브로커 한도 내).
 *
 *  [채널] sertz/mp/v2/class/<코드>  (코드: 6자리 영숫자 — 선생님이 만들어 칠판에 쓰는 용도)
 *   · hi {id,name,lv}        입장 알림
 *   · st {id,name,lv,kills,dmg,ek,tm} 3초 하트비트 + 누적 카운터 (수업의 심장)
 *     ek=정예 킬(보물 사냥) · tm=팀(0 레드/1 블루 — id 해시 파생, 전 클라 동일 계산)
 *   · cfg {mode,goal,endsAt,host,q,ch} 활동 시작 (retained — 늦게 들어와도 즉시 동기화)
 *     quiz 모드는 goal=정답 번호(0~3) · q=문제 · ch=선택지 4개
 *   · ans {id,a}             퀴즈 답안 제출 (학생 → 전원 — 실시간 집계)
 *   · end {mode}             활동 종료 알림 (host)
 *   · bye {id}               퇴장
 *
 *  [활동 6종] — 10/20/50/100인 전부 동작 (규모는 참가자 수로 자동 스케일)
 *   v1.4.30 3종 (기존 — 유지):
 *   1. hunt     학급 토벌전: 전체 킬 합산 (목표 = 참가자×50 — v1.4.31 난도 상향)
 *   2. boss     공유 보스 레이드: 수업 전체가 보스 HP 풀을 같이 깐다 (8천+참가자×2.5천)
 *   3. race     사냥 경쟁전: 제한시간(5분) 내 개인 킬 랭킹
 *   v1.4.31 (#3 파티 게임 신설 — "퀘스트보다 파티 게임" 유저 지시):
 *   4. team     팀 킬전 레드vs블루: id 해시로 자동 팀편성, 팀 킬 합산 대결 (목표 = 참가자×40)
 *   5. treasure 보물 사냥: 정예(엘리트) 몬스터 킬만 카운트 — 희귀 사냥 경쟁 (참가자×8)
 *   6. quiz     퀴즈쇼: 선생님이 출제(게임 지식 뱅크) → 학생 전원 패널에서 답 투표,
 *               실시간 집계 바 + 정답 공개 — 오답 없이도 전원 참여형 수업용
 *
 *  [보상] 성공 시 각 클라이언트가 EventBus "class:reward"를 받아 스스로 지급
 *   (서버 검증 없는 협동 콘텐츠 — 수업용이므로 허용 범위)
 */
import mqtt from "mqtt";

const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://mqtt.eclipseprojects.io:443/mqtt"];
const ROOT = "sertz/mp/v2/class/";
const ST_MS = 3000;          // 자기 카운터 발행 주기
const PEER_TTL_MS = 12000;   // 무신호 참가자 제거
const RACE_MS = 5 * 60_000;  // 경쟁전 제한시간

export type ClassMode = "idle" | "hunt" | "boss" | "race" | "team" | "treasure" | "quiz";
export type ClassPeer = { id: string; name: string; lv: number; kills: number; dmg: number; ek: number; tm: number; ans: number; t: number };
export type ClassSnapshot = {
  code: string;
  host: boolean;
  id: string;
  myName: string;
  connected: boolean;
  peers: ClassPeer[];
  mode: ClassMode;
  goal: number;          // hunt/treasure/team: 목표 / boss: 보스 총 HP / quiz: 정답 번호
  endsAt: number;        // race·quiz 종료 시각(0=무제한)
  huntKills: number;     // hunt 현재 합산
  bossHp: number;        // boss 남은 HP
  bossTaken: number;     // boss 누적 딜
  eliteKills: number;    // treasure 현재 합산 (정예 킬)
  myTeam: number;        // team 내 팀 (0=레드 1=블루)
  teamKills: [number, number]; // team 레드/블루 합산 킬
  quizQ: string;         // quiz 문제 (비어있으면 퀴즈 아님)
  quizCh: string[];      // quiz 선택지
  quizTally: [number, number, number, number]; // quiz 답 분포
  myAns: number;         // quiz 내 답 (-1 미제출)
  done: boolean;         // 이번 활동 성공/종료 보상 수령 여부
  rank: number;          // race 내 내 순위
};
type Cfg = { mode: ClassMode; goal: number; endsAt: number; host: string; q: string; ch: string[] };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const clean = (s: unknown, max: number) =>
  String(s ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "").trim().slice(0, max);

let client: mqtt.MqttClient | null = null;
let connecting = false;
let joined: { code: string; host: boolean } | null = null;
let me: { id: string; name: string; lv: number } = { id: "", name: "", lv: 1 };
let myKills = 0;
let myDmg = 0;
let myElite = 0;
let myAns = -1;
let peers = new Map<string, ClassPeer>();
let lastSent = { kills: 0, dmg: 0, ek: 0 };
let cfg: Cfg = { mode: "idle", goal: 0, endsAt: 0, host: "", q: "", ch: [] };
let bossTaken = 0;
let rewarded = false;
let timer: ReturnType<typeof setInterval> | null = null;
let rosterTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(s: ClassSnapshot) => void>();

/** v1.4.31 — 팀 자동 편성: id 문자열 해시 → 0(레드)/1(블루). 모든 클라가 같은 값을 계산한다 */
export function teamOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2;
}

/** UI 진입점 — GameRoot가 구독해 ClassroomPanel에 스냅샷 전파 */
export function onClassUpdate(cb: (s: ClassSnapshot) => void): () => void {
  listeners.add(cb);
  cb(snapshot());
  return () => { listeners.delete(cb); };
}

export function classJoinedCode(): string { return joined?.code ?? ""; }

export function snapshot(): ClassSnapshot {
  const list = [...peers.values()].filter((p) => Date.now() - p.t < PEER_TTL_MS);
  const huntKills = cfg.mode === "hunt" ? list.reduce((a, p) => a + p.kills, 0) : 0;
  const eliteKills = cfg.mode === "treasure" ? list.reduce((a, p) => a + p.ek, 0) : 0;
  const raceList = cfg.mode === "race" ? [...list].sort((a, b) => b.kills - a.kills) : [];
  /* v1.4.31 — 팀 킬 합산: 나 자신도 peers에 포함(st 자기수신)되므로 리스트 합이 곧 팀 합.
   *   단 하트비트 지연 분을 메우기 위해 내 카운터는 실시간 값으로 재계산 */
  const myTm = teamOf(me.id);
  const teamKills: [number, number] = [0, 0];
  if (cfg.mode === "team") {
    for (const p of list) {
      const k = p.id === me.id ? myKills : p.kills;
      teamKills[teamOf(p.id)] += k;
    }
  }
  const tally: [number, number, number, number] = [0, 0, 0, 0];
  if (cfg.mode === "quiz") {
    for (const p of list) {
      const a = p.id === me.id ? (myAns >= 0 ? myAns : p.ans) : p.ans;
      if (a >= 0 && a <= 3) tally[a]++;
    }
  }
  return {
    code: joined?.code ?? "",
    host: joined?.host ?? false,
    id: me.id,
    myName: me.name,
    connected: !!client?.connected,
    peers: list,
    mode: cfg.mode,
    goal: cfg.goal,
    endsAt: cfg.endsAt,
    huntKills,
    bossTaken,
    bossHp: cfg.mode === "boss" ? Math.max(0, cfg.goal - bossTaken) : 0,
    eliteKills,
    myTeam: myTm,
    teamKills,
    quizQ: cfg.q,
    quizCh: cfg.ch,
    quizTally: tally,
    myAns,
    done: rewarded,
    rank: cfg.mode === "race" ? Math.max(1, raceList.findIndex((p) => p.id === me.id) + 1) : 0,
  };
}

let lastSnapJson = "";

function notify() {
  const s = snapshot();
  /* v1.4.30 — 스냅샷 내용이 같으면 재전파하지 않는다: 3초 하트비트마다 새 객체로
   *  setSnap을 때리면 패널 DOM이 계속 재생성되어 클릭 레이스(모바일 오터치)가 생긴다. */
  const j = JSON.stringify(s);
  if (j === lastSnapJson) return;
  lastSnapJson = j;
  for (const cb of listeners) { try { cb(s); } catch { /* UI 오류 무시 */ }
  }
}

function topic(code: string) { return ROOT + clean(code, 8).toUpperCase(); }

function send(msg: Record<string, unknown>, retain = false) {
  if (!client || !joined) return;
  try {
    client.publish(topic(joined.code), JSON.stringify(msg), { qos: 0, retain }, (err) => {
      if (err) console.warn("[SERTZ-cls] publish 실패:", err.message);
    });
  } catch (e) { console.warn("[SERTZ-cls] publish 예외:", String(e).slice(0, 80)); }
}

function handle(raw: string) {
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
  const kind = clean(m.k, 4);
  const id = clean(m.id, 40);
  /* v1.4.30 — cfg(활동 설정)는 id가 없는 브로드캐스트라 id 가드에서 전부 drop되어
   *  학생 화면이 활동 시작을 못 받는 버그 수정 (교실 E2E 실측 발견).
   *  id 필수는 참가자 식별 메시지(hi/st/bye)에만 적용한다. */
  if (!id && (kind === "hi" || kind === "st" || kind === "bye")) return;
  if (kind === "st") {
    const kills = clamp(Number(m.kills), 0, 999_999);
    const dmg = clamp(Number(m.dmg), 0, 9_999_999);
    const ek = clamp(Number(m.ek), 0, 99_999);
    const prev = peers.get(id);
    const p: ClassPeer = {
      id, name: clean(m.name, 12) || "모험가", lv: clamp(Number(m.lv), 1, 999),
      kills: Math.max(prev?.kills ?? 0, kills), dmg: Math.max(prev?.dmg ?? 0, dmg),
      ek: Math.max(prev?.ek ?? 0, ek), tm: teamOf(id), ans: prev?.ans ?? -1, t: Date.now(),
    };
    peers.set(id, p);
    /* 공유 보스 — 상대 딜 델타를 합산 (모든 클라가 같은 순서로 더해 근사 동기화) */
    if (cfg.mode === "boss" && id !== me.id) {
      const last = lastPeerDmg.get(id) ?? 0;
      const delta = dmg - last;
      if (delta > 0 && dmg > last) bossTaken += delta;
    }
    lastPeerDmg.set(id, dmg);
  } else if (kind === "hi") {
    const prev = peers.get(id);
    peers.set(id, { id, name: clean(m.name, 12) || "모험가", lv: clamp(Number(m.lv), 1, 999), kills: prev?.kills ?? 0, dmg: prev?.dmg ?? 0, ek: prev?.ek ?? 0, tm: teamOf(id), ans: prev?.ans ?? -1, t: Date.now() });
  } else if (kind === "cfg") {
    const c = m as unknown as Cfg & { q?: unknown; ch?: unknown };
    const mode = clean(c.mode, 8) as ClassMode;
    const valid: ClassMode[] = ["idle", "hunt", "boss", "race", "team", "treasure", "quiz"];
    if (valid.includes(mode)) {
      /* 활동이 바뀌면 진행 상태 리셋 (델타 추적도 초기화 — 새 활동 기준) */
      if (cfg.mode !== mode || cfg.goal !== clamp(Number(c.goal), 0, 9_999_999)) {
        bossTaken = 0;
        rewarded = false;
        myAns = -1;
      }
      /* v1.4.31 — 퀴즈 문제/선택지 (새 활동에만 첨부) */
      const q = clean(c.q, 90);
      const chRaw = Array.isArray(c.ch) ? c.ch : [];
      const ch = chRaw.slice(0, 4).map((x) => clean(x, 28));
      cfg = { mode, goal: clamp(Number(c.goal), 0, 9_999_999), endsAt: clamp(Number(c.endsAt), 0, 4_102_444_800_000), host: clean(c.host, 40), q, ch };
    }
  } else if (kind === "ans") {
    /* v1.4.31 — 퀴즈 답안 (1인 1회 — 이후 답은 무시) */
    const prev = peers.get(id);
    if (prev && prev.ans < 0) {
      const a = clamp(Number(m.a), 0, 3);
      if (m.a !== undefined && Number.isFinite(Number(m.a))) prev.ans = a;
      prev.t = Date.now();
    }
  } else if (kind === "end") {
    cfg = { mode: "idle", goal: 0, endsAt: 0, host: "", q: "", ch: [] };
    bossTaken = 0;
  } else if (kind === "bye") {
    peers.delete(id);
  }
  checkCompletion();
  notify();
}

const lastPeerDmg = new Map<string, number>();

function checkCompletion() {
  if (rewarded || cfg.mode === "idle") return;
  const s = snapshot();
  let done = false; // 활동 완료 (team/quiz는 지어도 완료 — 참가 보상)
  let win = false;
  let label = "";
  const mode = cfg.mode;
  if (cfg.mode === "hunt" && s.huntKills >= cfg.goal) { done = win = true; label = `학급 토벌전 성공! 전체 ${s.huntKills}마리 토벌`; }
  if (cfg.mode === "boss" && s.bossHp <= 0) { done = win = true; label = "공유 보스 레이드 성공! 수업 전원 토벌!"; }
  if (cfg.mode === "race" && cfg.endsAt > 0 && Date.now() >= cfg.endsAt) {
    done = win = true;
    label = s.rank === 1 ? "사냥 경쟁전 우승!" : `사냥 경쟁전 종료 — 내 순위 ${s.rank}위`;
  }
  /* v1.4.31 (#3) — 신설 파티 게임 3종 판정 */
  if (cfg.mode === "team" && cfg.goal > 0 && Math.max(s.teamKills[0], s.teamKills[1]) >= cfg.goal) {
    done = true;
    win = s.teamKills[s.myTeam] >= cfg.goal;
    label = win
      ? `팀 킬전 승리! ${s.myTeam === 0 ? "레드" : "블루"}팀 ${s.teamKills[s.myTeam]}킬`
      : `팀 킬전 종료 — ${s.teamKills[s.myTeam]} vs ${s.teamKills[1 - s.myTeam]} 아쉽지만 좋은 싸움이었어요!`;
  }
  if (cfg.mode === "treasure" && cfg.goal > 0 && s.eliteKills >= cfg.goal) {
    done = win = true;
    label = `보물 사냥 성공! 전체 정예 ${s.eliteKills}마리 토벌`;
  }
  if (cfg.mode === "quiz" && cfg.q && cfg.endsAt > 0 && Date.now() >= cfg.endsAt) {
    done = true;
    win = s.myAns >= 0 && s.myAns === cfg.goal;
    label = win ? "퀴즈 정답! +보상" : `퀴즈 종료 — 정답은 ${cfg.goal + 1}번!`;
  }
  if (!done) return;
  rewarded = true;
  try { window.dispatchEvent(new CustomEvent("sertz:class-reward", { detail: { label, mode, rank: s.rank, win } })); } catch { /* 무시 */ }
}

function tick() {
  if (!client || !joined) return;
  /* 누적 카운터 발행 (변화가 없어도 프레즌스 겸 12초마다 1회) */
  if (myKills !== lastSent.kills || myDmg !== lastSent.dmg || myElite !== lastSent.ek || Date.now() - lastBeat > 12000) {
    lastBeat = Date.now();
    lastSent = { kills: myKills, dmg: myDmg, ek: myElite };
    send({ k: "st", id: me.id, name: me.name, lv: me.lv, kills: myKills, dmg: myDmg, ek: myElite, tm: teamOf(me.id) });
  }
  /* v1.4.30 — 활동 설정(cfg) 주기 재발행: host는 활동 중 5초마다 cfg를 재송신해
   *  단일 publish 유실·재접속 지연·늦게 참여한 학생 모두를 커버한다 (retain과 이중화). */
  if (joined.host && cfg.mode !== "idle" && Date.now() - lastCfgBeat > 5000) {
    lastCfgBeat = Date.now();
    send({ k: "cfg", mode: cfg.mode, goal: cfg.goal, endsAt: cfg.endsAt, host: cfg.host, q: cfg.q, ch: cfg.ch }, true);
  }
  /* 만료 피어 정리 + 성공 판정 재확인 */
  let changed = false;
  for (const [id, p] of peers) if (Date.now() - p.t > PEER_TTL_MS) { peers.delete(id); changed = true; }
  checkCompletion();
  notify();
  void changed;
}
let lastBeat = 0;
let lastCfgBeat = 0;

/** 교실 입장 — 브로커 연결(필요 시) + 구독 + hi 발행 */
export function classJoin(code: string, profile: { name: string; lv: number }, host: boolean): boolean {
  const c = clean(code, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length < 4) return false;
  me = { id: `cl${Math.random().toString(36).slice(2, 10)}`, name: clean(profile.name, 12) || "모험가", lv: clamp(profile.lv, 1, 999) };
  joined = { code: c, host };
  myKills = 0; myDmg = 0; myElite = 0; myAns = -1; lastSent = { kills: 0, dmg: 0, ek: 0 };
  peers = new Map(); lastPeerDmg.clear();
  cfg = { mode: "idle", goal: 0, endsAt: 0, host: "", q: "", ch: [] };
  bossTaken = 0; rewarded = false; lastBeat = 0;
  ensureClient();
  if (timer) clearInterval(timer);
  timer = setInterval(tick, ST_MS);
  if (rosterTimer) clearInterval(rosterTimer);
  /* 늦게 참여한 사람도 즉시 명단을 보내도록 짧은 재발행 (retained cfg는 브로커가 전달) */
  rosterTimer = setInterval(() => { if (joined) send({ k: "hi", id: me.id, name: me.name, lv: me.lv }); }, 8000);
  send({ k: "hi", id: me.id, name: me.name, lv: me.lv });
  notify();
  return true;
}

export function classLeave() {
  if (joined) send({ k: "bye", id: me.id });
  joined = null;
  if (timer) { clearInterval(timer); timer = null; }
  if (rosterTimer) { clearInterval(rosterTimer); rosterTimer = null; }
  try { client?.unsubscribe(topics); } catch { /* 무시 */ }
  notify();
}

let topics: string[] = [];

function ensureClient() {
  if (client && client.connected) { subscribeNow(); return; }
  if (connecting) return;
  connecting = true;
  let attempt = 0;
  const tryConnect = () => {
    if (attempt >= BROKERS.length) { connecting = false; notify(); return; }
    const url = BROKERS[attempt++];
    try {
      const c = mqtt.connect(url, { clientId: `szcls_${me.id}_${Math.random().toString(36).slice(2, 6)}`, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000 });
      client = c;
      c.on("connect", () => { connecting = false; subscribeNow(); notify(); });
      c.on("message", (_t: string, payload: Uint8Array) => { try { handle(new TextDecoder().decode(payload)); } catch { /* 무시 */ } });
      c.on("error", () => { /* 폴백은 reconnect에서 */ });
      c.on("close", () => notify());
    } catch {
      tryConnect();
    }
  };
  tryConnect();
}

function subscribeNow() {
  if (!client || !joined) return;
  const t = topic(joined.code);
  topics = [t];
  try {
    client.subscribe(t, { qos: 0 });
    /* host는 활동 설정을 retained로 유지 — 재구독 시 자동 복원 */
  } catch { /* 무시 */ }
}

/* ---------------- 호스트(선생님) 전용 ---------------- */

/** 참가자 수 기반 규모 산정 — 10/20/50/100인 규모에 맞춘 목표값
 *  v1.4.31 (#3) — "너무 쉽고 지루" 지시: 기존 목표 대폭 상향 + 신설 3종 목표 */
export function scaleGoal(mode: Exclude<ClassMode, "idle">, participants: number): number {
  const n = Math.max(1, participants);
  if (mode === "hunt") return n * 50;             // 1인당 50마리 (20→50 상향) — 50인이면 2,500마리
  if (mode === "boss") return 8000 + n * 2500;    // (3천+900 → 8천+2.5천 상향) — 50인이면 133,000
  if (mode === "team") return n * 40;             // 팀당 목표 — 30인이면 팀당 1,200킬 (레드vs블루)
  if (mode === "treasure") return n * 8;          // 정예 킬 — 희귀 사냥이라 1인당 8마리
  return 0;
}

export function classStart(mode: Exclude<ClassMode, "idle">, goal: number, extra?: { q?: string; ch?: string[] }) {
  if (!joined?.host) return;
  const endsAt = mode === "race" ? Date.now() + RACE_MS
    : mode === "quiz" ? Date.now() + QUIZ_MS : 0;
  bossTaken = 0; rewarded = false; myAns = -1;
  cfg = { mode, goal: clamp(goal, 0, 9_999_999), endsAt, host: me.id, q: clean(extra?.q ?? "", 90), ch: (extra?.ch ?? []).slice(0, 4).map((x) => clean(x, 28)) };
  lastCfgBeat = Date.now();
  send({ k: "cfg", mode, goal: cfg.goal, endsAt, host: me.id, q: cfg.q, ch: cfg.ch }, true); // retained
  notify();
}

export function classEnd() {
  if (!joined?.host) return;
  cfg = { mode: "idle", goal: 0, endsAt: 0, host: "", q: "", ch: [] };
  send({ k: "end" }, true); // retained 해제 아님 — 새 참여자에게 "종료됨"이 보이도록
  notify();
}

/* ---------------- 게임 훅 (WorldScene/Enemy에서 호출 — 교실 밖이면 no-op) ---------------- */

/** v1.4.31 — kind="elite"는 보물 사냥 카운터(정예 킬만). 기본 킬은 전 활동 공용 */
export function trackKill(kind?: "elite") {
  if (!joined) return;
  myKills++;
  if (kind === "elite") myElite++;
}

export function trackDamage(dealt: number) {
  if (!joined || cfg.mode !== "boss") return;
  if (dealt > 0) myDmg += Math.min(dealt, 9_999);
}

/** v1.4.31 — 퀴즈 답안 제출 (학생 패널 → 브로커). 1인 1회 */
export function classAnswer(choice: number) {
  if (!joined || cfg.mode !== "quiz" || myAns >= 0) return;
  if (choice < 0 || choice > 3) return;
  myAns = choice;
  send({ k: "ans", id: me.id, a: choice });
  notify();
}

/* ---------------- v1.4.31 퀴즈 뱅크 (수업용 게임 지식 — host 패널에서 선택) ---------------- */
export type ClassQuiz = { q: string; ch: [string, string, string, string]; a: number };
export const QUIZ_BANK: ClassQuiz[] = [
  { q: "게임의 첫 시작 마을 이름은?", ch: ["미드가르드 마을", "알프헤임", "니다벨리르", "발할라"], a: 0 },
  { q: "알프헤임 챕터(4장)의 보스는?", ch: ["수르트", "니드호그", "펜리르", "가름"], a: 1 },
  { q: "공동 토벌전은 하루 몇 번 입장할 수 있을까?", ch: ["무제한", "3번", "1번", "5번"], a: 2 },
  { q: "에메랄드(💎)로 살 수 있는 것은?", ch: ["강화 주문서", "체력 물약", "일반 무기", "포션 재료"], a: 0 },
  { q: "니플헤임의 분위기는?", ch: ["용암이 흐르는 화산", "눈보라치는 얼음 땅", "무성한 초원", "사막"], a: 1 },
  { q: "스콜 보스의 특징은?", ch: ["혼자 나온다", "쌍둥이(하티)가 나온다", "날지 못한다", "물속에 산다"], a: 1 },
  { q: "장비 강화의 최고 등급 색은?", ch: ["초록", "파랑", "보라", "빨강"], a: 2 },
  { q: "파티 시너지 '일심동체'의 조건은?", ch: ["같은 직업군 2명", "파티장만", "레벨 100", "길드 가입"], a: 0 },
  { q: "재림(RB) 스테이지는 몇 개까지?", ch: ["5개", "10개", "15개", "20개"], a: 2 },
  { q: "보스 반격(카운터) 창에서 해야 할 일은?", ch: ["도망간다", "창이 닫히기 전에 때린다", "물약 마신다", "가만히 있는다"], a: 1 },
  { q: "무스펠헤임의 지형 특징은?", ch: ["눈과 얼음", "용암과 화산", "숲과 호수", "황무지"], a: 1 },
  { q: "채팅 기록은 최근 몇 개까지 볼 수 있을까?", ch: ["10개", "30개", "50개", "100개"], a: 2 },
];
const QUIZ_MS = 30_000; // 퀴즈 제한시간 30초
