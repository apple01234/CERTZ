/**
 * v1.4.0 (Task 3-2 — 유저 지시 #20) — 이스터에그 + ARG 시스템 "비밀수첩"
 *  - 총 100종: 숨겨진 포탈·은신처 20 / NPC 히든 대화 15 / 입력 시크릿 5 / 시간·날짜 8 /
 *    히든 퀘스트 체인 10 / ARG 외부 연계 15 / 아이템 패러디 10 / 사운드 7 / 컬렉션 숨김 10
 *  - 발견 시 localStorage "sertz.eggs"에 기록, 구간 보상(10/25/50/100)
 *  - ARG는 외부 힌트(공개 웹페이지 암호문)를 게임 내 비밀수첩에 입력하는 방식 — 메인 진행 비의존
 *  - 엔진: WorldScene 600ms 틱(stage/time/pos) + 키 시퀀스 버퍼 + 수첩 입력 코드
 */
import { ITEMS, CHAPTERS, STAGE_SHORT, type StageKey, type ItemKey } from "./data";

export type EggCat =
  | "portal" | "npc" | "input" | "time" | "quest" | "arg" | "item" | "sound" | "collection";

export type EggCond =
  | { t: "spot"; stage: StageKey; x: number; y: number; r: number } // 숨은 장소 접근
  | { t: "item"; key: ItemKey }                                     // 아이템 보유 상태로 NPC 접촉 등
  | { t: "konami"; seq: string }                                    // 입력 시퀀스 (버퍼 매칭)
  | { t: "clock"; hour: number; dow?: number }                      // 시간·요일
  | { t: "visits"; stage: StageKey; n: number }                     // 방문 횟수
  | { t: "kills"; n: number; stage?: StageKey }                     // 누적 처치
  | { t: "code"; word: string }                                     // 비밀수첩 입력 코드 (ARG)
  | { t: "count"; key: EggCounterKey; n: number }                   // 행동 카운터 (포탈/크리/레벨업/펫/치장/스타/환생/골드/보스/마을)
  | { t: "idle"; n: number }                                        // 월드 무사냥 경과초
  | { t: "chapters"; n: number };                                   // 방문한 서로 다른 챕터 수

export type EggDef = {
  id: string;
  cat: EggCat;
  name: string;
  hint: string;
  cond: EggCond;
  reward: { gold?: number; emerald?: number; label: string };
};

const G = (gold: number, label: string) => ({ gold, label });
const GE = (gold: number, emerald: number, label: string) => ({ gold, emerald, label });

/* 카테고리별 100종 생성 — 규칙적 데이터는 헬퍼로 압축 */

// ① 숨겨진 포탈·은신처 20종 — 각 챕터 구역 모서리/장애물 뒤 좌표 (deterministic 배치)
const SPOT_STAGES: StageKey[] = [
  "forest3", "forest7", "forest10", "kingdom2", "kingdom6", "kingdom9",
  "mountain4", "mountain8", "volcano3", "volcano7", "icefield2", "icefield6",
  "swamp5", "desert4", "desert9", "niflheim3", "muspelheim5", "helheim7",
  "abyss4", "abyss8",
];
const SPOT_NAMES = [
  "나뭇가지 사이의 오솔길", "바위 그늘의 굴", "버려진 등대 기지", "선적창고 뒷골목", "늪 속 섬",
  "언 덩굴 성벽 틈", "절벽 위 동굴", "용암 지대 안개 틈", "고요한 얼음 정원", "설산 뒤 편의점(?)",
  "수몰된 신전 입구", "모래 폭풍 속 오아시스", "무너진 피라미드 내실", "혹한의 숨은 캠프", "영구 동토의 난로방",
  "잿불 계곡 은신처", "죽은 자의 숨숨집", "심연 균열 틈새", "별이 떨어진 구덩이", "세계수 뿌리 굴곡",
];
const EGGS: EggDef[] = SPOT_STAGES.map((stage, i) => ({
  id: `portal_${String(i + 1).padStart(2, "0")}`,
  cat: "portal" as EggCat,
  name: SPOT_NAMES[i],
  hint: `${STAGE_SHORT[stage] ?? stage} 구석 어딘가 — 다른 사람이 안 갈 곳`,
  cond: { t: "spot", stage, x: 120 + ((i * 317) % 900), y: 90 + ((i * 211) % 420), r: 56 },
  reward: i % 5 === 4 ? GE(2200, 1, "은신처 발견!") : G(1500 + i * 120, "은신처 발견!"),
}));

// ② NPC 히든 대화 15종 — 특정 아이템 보유 시 NPC에게 보이는 숨은 선택지(자동 발견 훅)
const NPC_ITEM_EGGS: [string, ItemKey, string][] = [
  ["이그니", "potion_hp", "물약을 권하는 정령"],
  ["카이엔", "weapon_2", "강철 검을 흘끗 보는 검사"],
  ["라고스", "cos_gold", "비싼 걸 아는 상인"],
  ["루미", "weapon_1", "동전 갖고 노는 아이"],
  ["헤르모드", "scroll_return", "귀환서를 읽는 관리인"],
  ["실리아", "potion_elixir", "엘릭서 향을 맡는 약초꾼"],
  ["도르간", "weapon_4", "심연의 대검을 건드리는 대장장이"],
  ["베타", "potion_mp2", "마나 물약으로 찻잔을 채우는 정령"],
  ["프레이", "acc_crown", "왕관을 만져보는 궁정인"],
  ["노아", "scroll_warp", "부적 접기가 특기인 소년"],
  ["유이", "armor_3", "상자 키를 목걸이처럼 건 소녀"],
  ["할버드", "bd_guardian", "수호자 트로피를 자랑하는 병사"],
  ["밀라", "bd_fenrir", "늑대 이야기만 하는 광산 인부"],
  ["세레나", "bd_skoll", "쌍랑의 전설을 노래하는 음유시인"],
  ["오타", "bd_gram", "전설의 검을 그리는 화가"],
];
for (const [npc, item, name] of NPC_ITEM_EGGS) {
  EGGS.push({
    id: `npc_${npc}`,
    cat: "npc",
    name,
    hint: `${npc}에게 ${ITEMS[item]?.name ?? item}을 들고 가보자`,
    cond: { t: "item", key: item },
    reward: G(1200, `${npc}의 숨은 대화`),
  });
}

// ③ 입력 시크릿 5종 — 키 시퀀스 (월드에서 입력)
const INPUT_SEQS: [string, string, string][] = [
  ["konami", "UUDDLRLRBA", "코나미 커맨드 — 옛 게이머의 혼"],
  ["sertz", "SERTZ", "게임 이름을 직접 타이핑?"],
  ["maple", "MAPLE", "어디서 많이 본 나무"],
  ["gg", "GG", "잘 쳤다"],
  ["meogeo", "MEOW", "고양이가 키보드를 밟았다"],
];
for (const [id, seq, name] of INPUT_SEQS) {
  EGGS.push({
    id: `input_${id}`,
    cat: "input",
    name,
    hint: `월드에서 자판으로 "${seq}"를 입력해보자`,
    cond: { t: "konami", seq },
    reward: id === "konami" ? GE(3000, 2, "전설의 커맨드!") : G(1800, "시크릿 입력!"),
  });
}

// ④ 시간·날짜 8종
const TIME_EGGS: [string, number, number | undefined, string][] = [
  ["dawn3", 3, undefined, "새벽 3시의 수군거림"],
  ["noon12", 12, undefined, "정오의 세계수"],
  ["midnight0", 0, undefined, "자정의 종소리"],
  ["friday13", 13, 5, "13일 금요일"],
  ["friday", 0, 5, "불금의 사냥"],
  ["sunday", 0, 0, "일요일 산책"],
  ["saturday", 0, 6, "토요일 대청소"],
  ["monday", 0, 1, "월요병 치료제"],
];
for (const [id, hour, dow, name] of TIME_EGGS) {
  EGGS.push({
    id: `time_${id}`,
    cat: "time",
    name,
    hint: hour > 0 ? `${hour}시에 접속해 보자` : (dow !== undefined ? `요일 ${dow}에 접속 — 어떤 요일일까?` : "특별한 시각에 접속"),
    cond: { t: "clock", hour, dow },
    reward: G(1500, "시간의 조각"),
  });
}

// ⑤ 히든 퀘스트 체인 10종 — 반복 의뢰/토벌 누적으로 발견
const QUEST_EGGS: [string, number, string][] = [
  ["wolf100", 100, "늑대 인간의 가호"],
  ["slayer500", 500, "500 토벌의 증표"],
  ["slayer1000", 1000, "천인 참수"],
  ["slayer2000", 2000, "전장의 악몽"],
  ["slayer3000", 3000, "살육의 여왕(?)"],
  ["slayer5000", 5000, "전설의 사냥꾼"],
  ["visitor10", 10, "단골손님"],
  ["boss5", 5, "보스 사냥꾼"],
  ["elite10", 10, "정예 사냥꾼"],
  ["nightowl", 60, "올빼미 사냥꾼"],
];
for (const [id, n, name] of QUEST_EGGS) {
  EGGS.push({
    id: `quest_${id}`,
    cat: "quest",
    name,
    hint: id.startsWith("slayer") ? `누적 ${n}마리 사냥` : id === "visitor10" ? "같은 구역을 10번 방문" : "꾸준히 사냥하다 보면",
    cond: { t: "kills", n },
    reward: GE(2500, id.includes("5000") ? 3 : 1, `${n} 마리의 여정`),
  });
}

// ⑥ ARG 외부 연계 15종 — v1.4.7: /secret 정적 페이지 철거(유저 지시). 힌트는 외부 공식 지원센터
//    웹페이지(오타쿠 감성 고객 문의 페이지)에 숨기고, 정답 코드는 이 수첩에 입력하는 이원화 구조
const ARG_CODES: [string, string, string, string][] = [
  ["arg01", "URIEL", "극락의 문지기", "지원센터 페이지 어딘가 숨은 말 — 여섯 글자의 천사"],
  ["arg02", "YGGRASIL", "세계수의 이름", "README의 첫 글자들을 세로로 읽어라"],
  ["arg03", "8426", "숫자 네 개", "guide 페이지 소스의 주석"],
  ["arg04", "PHASER4", "엔진의 이름", "이 게임을 만든 프레임워크는?"],
  ["arg05", "MAPLESTORY", "섬의 나라", "버전 히스토리에서 두 번 언급된 게임"],
  ["arg06", "GALMURI", "픽셀 글꼴", "화면의 숫자를 만든 글꼴"],
  ["arg07", "SEONG", "개발자 서명", "크레딧에 숨은 이름"],
  ["arg08", "VALKYRIE", "발키리", "v1.3.1에 추가된 코스튬 중 하나"],
  ["arg09", "NIFLHEIM", "얼음의 나라", "9챕터 중 가장 추운 곳"],
  ["arg10", "MUSPELHEIM", "불의 나라", "그리고 가장 뜨거운 곳"],
  ["arg11", "EMERALD", "초록 보석", "르쯔의 영어 이름"],
  ["arg12", "STARFORCE", "별의 힘", "장비를 강화하는 시스템"],
  ["arg13", "UNION", "결합", "캐릭터를 배치해 계정을 강화하는 것"],
  ["arg14", "REBIRTH", "다시 태어남", "200레벨부터 가능한 것"],
  ["arg15", "SECRET100", "백 개의 비밀", "이 수첩의 목표 숫자"],
];
for (const [id, code, name, hint] of ARG_CODES) {
  EGGS.push({
    id: `arg_${id}`,
    cat: "arg",
    name,
    hint,
    cond: { t: "code", word: code },
    reward: id === "arg15" ? GE(5000, 3, "ARG 완결!") : GE(2000, 1, "암호 해독"),
  });
}

// ⑦ 아이템·장비 패러디 10종 — 희귀 아이템 보유 + 조합 조건(단순화: 보유 시 발견 훅)
const ITEM_PARODY: [ItemKey, string, string][] = [
  ["weapon_4", "심연이 아니라 허리가 아픈 대검", "심연의 대검을 들어본 자"],
  ["potion_elixir", "맛은 라즈베리", "엘릭서 소유자"],
  ["acc_crown", "머리 아픈 왕관", "황금 왕관 보유"],
  ["scroll_star", "별을 따다 주는 주문서", "강화 주문서 10장 시대의 유산"],
  ["weapon_3", "종이 한 장의 권능", "기사단 대검 보유"],
  ["armor_2", "열쇠는 항상 갑옷 옆에", "강철 갑옷 보유"],
  ["potion_hp3", "초절정 HP물약(아님)", "최고급 물약 보유"],
  ["scroll_warp", "택시 기사를 대신하는 부적", "지역 이동 부적 보유"],
  ["ring_ancient", "반지의 제왕(2권은 없음)", "고대왕의 반지 보유"],
  ["bd_abysslord", "심연 주인의 사인", "심연 군주 트로피 보유"],
];
for (const [key, name, hint] of ITEM_PARODY) {
  EGGS.push({
    id: `item_${key}`,
    cat: "item",
    name,
    hint,
    cond: { t: "item", key },
    reward: G(1600, "수집가의 미소"),
  });
}

// ⑧ 사운드·행동 이스터에그 7종 — 실측 가능한 행동 카운터 조건 (WorldScene 훅)
const SOUND_EGGS: [string, string, string, EggCond][] = [
  ["bgm_village3", "마을 음악 3곡 풀청취", "마을에 자주 들러 쉬어가자", { t: "count", key: "villageVisits", n: 3 }],
  ["bgm_boss", "보스전 BGM 끝까지", "도망치지 않는 용기 — 보스를 쓰러뜨리자", { t: "count", key: "bossKills", n: 1 }],
  ["sfx_portal10", "포탈 10회 탑승", "차원문 통근자 — 포탈을 10번 타자", { t: "count", key: "portals", n: 10 }],
  ["sfx_coin999", "금고지기", "소지금 10만 골드 모으기", { t: "count", key: "gold", n: 100000 }],
  ["sfx_crit50", "크리티컬 50회", "손목 주의 — 크리티컬 50번", { t: "count", key: "crits", n: 50 }],
  ["sfx_levelup10", "레벨업 팡파레 10회", "성장의 반복", { t: "count", key: "levelups", n: 10 }],
  ["bgm_title", "시작 화면의 감상가", "월드에 들어와 사냥 안 하고 1분 여유", { t: "idle", n: 60 }],
];
for (const [id, name, hint, cond] of SOUND_EGGS) {
  EGGS.push({
    id: `sound_${id}`,
    cat: "sound",
    name,
    hint,
    cond,
    reward: G(1400, "청각의 계시"),
  });
}

// ⑨ 도감·컬렉션 숨김 항목 10종 — 실측 가능한 컬렉션/누적 조건
const COLLECTION_EGGS: [string, string, string, EggCond][] = [
  ["col_wolfset", "숲의 단골손", "제1장 최심부에 5번 들러", { t: "visits", stage: "forest10", n: 5 }],
  ["col_golemset", "산의 정복자", "산악 5구역에 5번 들러", { t: "visits", stage: "mountain5", n: 5 }],
  ["col_zombieset", "왕국의 그림자", "왕국 9구역에 5번 들러", { t: "visits", stage: "kingdom9", n: 5 }],
  ["col_orcset", "사막의 이야꾽", "사막 5구역에 5번 들러", { t: "visits", stage: "desert5", n: 5 }],
  ["col_allchapter", "9챕터 전 지역 방문", "여행 작가 — 전 챕터를 한 번씩", { t: "chapters", n: 9 }],
  ["col_allboss", "스토리 보스 전원 격파", "보스 컬렉터 — 누적 6,000마리", { t: "kills", n: 6000 }],
  ["col_petall", "동물원 사장", "펫 5종 보유", { t: "count", key: "pets", n: 5 }],
  ["col_costume5", "패션리더", "치장 5종 보유", { t: "count", key: "costumes", n: 5 }],
  ["col_star10", "별을 쫓는 자", "스타포스 10성 장비", { t: "count", key: "starMax", n: 10 }],
  ["col_rebirth1", "다시 태어난 모험가", "환생 1회 달성", { t: "count", key: "rebirths", n: 1 }],
];
for (const [id, name, hint, cond] of COLLECTION_EGGS) {
  EGGS.push({
    id: `col_${id}`,
    cat: "collection",
    name,
    hint,
    cond,
    reward: GE(1800, 1, "컬렉션의 비밀"),
  });
}

export const EASTER_EGGS = EGGS;
export const EGG_TOTAL = EGGS.length;

/* ================= 엔진 ================= */

const KEY = "sertz.eggs";
const MILESTONES = [10, 25, 50, 100];
const MILESTONE_REWARD: Record<number, { gold: number; emerald: number }> = {
  10: { gold: 10000, emerald: 2 },
  25: { gold: 30000, emerald: 5 },
  50: { gold: 80000, emerald: 10 },
  100: { gold: 200000, emerald: 30 },
};

let discovered: string[] = [];
let milestonesClaimed: number[] = [];
let loaded = false;
let inputBuf = "";

function ensureLoad() {
  if (loaded) return;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    discovered = Array.isArray(raw.list) ? raw.list : [];
    milestonesClaimed = Array.isArray(raw.milestones) ? raw.milestones : [];
  } catch { discovered = []; milestonesClaimed = []; }
  loaded = true;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ list: discovered, milestones: milestonesClaimed }));
  } catch { /* 무시 */ }
}

export function eggDiscovered(id: string): boolean {
  ensureLoad();
  return discovered.includes(id);
}

export function eggCount(): number {
  ensureLoad();
  return discovered.length;
}

export function eggMilestonePending(): number | null {
  ensureLoad();
  for (const m of MILESTONES) {
    if (eggCount() >= m && !milestonesClaimed.includes(m)) return m;
  }
  return null;
}

export function claimEggMilestone(): { gold: number; emerald: number } | null {
  const m = eggMilestonePending();
  if (!m) return null;
  ensureLoad();
  milestonesClaimed.push(m);
  persist();
  return MILESTONE_REWARD[m];
}

/** 발견 처리 — true면 이번에 새로 발견(배너/보상 훅 필요) */
export function discoverEgg(id: string): boolean {
  ensureLoad();
  if (discovered.includes(id)) return false;
  discovered.push(id);
  persist();
  return true;
}

/** 발견 목록(수첩 UI용) — always 조건 제거로 discoverDirect는 입력코드 테스트 용도로만 유지 */
export function eggList(): { def: EggDef; found: boolean }[] {
  ensureLoad();
  return EASTER_EGGS.map((def) => ({ def, found: discovered.includes(def.id) }));
}

/** 키 입력 버퍼 평가 — WorldScene keydown 훅에서 매 키 호출 (화살표는 U/D/L/R로 정규화) */
export function feedKey(k: string): EggDef | null {
  if (!k || k.length > 1 && !k.startsWith("Arrow")) return null;
  const norm = k.startsWith("Arrow")
    ? { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" }[k] ?? ""
    : k.toUpperCase();
  if (!norm) return null;
  inputBuf = (inputBuf + norm).slice(-12);
  ensureLoad();
  for (const e of EASTER_EGGS) {
    if (e.cond.t === "konami" && !discovered.includes(e.id) && inputBuf.endsWith(e.cond.seq)) {
      discovered.push(e.id);
      persist();
      return e;
    }
  }
  return null;
}

/** 비밀수첩 코드 입력 (ARG) */
export function feedCode(word: string): EggDef | null {
  const w = word.trim().toUpperCase();
  ensureLoad();
  for (const e of EASTER_EGGS) {
    if (e.cond.t === "code" && !discovered.includes(e.id) && e.cond.word === w) {
      discovered.push(e.id);
      persist();
      return e;
    }
  }
  return null;
}

/** 조건형 이스터에그 진행 콘텍스트 — WorldScene 틱이 채워 넣는다 */
export type EggCounterKey =
  | "portals" | "levelups" | "crits" | "bossKills" | "villageVisits"
  | "gold" | "starMax" | "rebirths" | "pets" | "costumes";

export type EggCtx = {
  stage: StageKey;
  px: number;
  py: number;
  lv: number;
  items: Set<string>;
  visitCounts: Partial<Record<StageKey, number>>;
  totalKills: number;
  stageKills: number;
  counters: Partial<Record<EggCounterKey, number>>;
  idleSec: number;
};

/** 600ms 틱 평가 — 새로 발견한 이스터에그 배열 반환 (최대 1회 1개) */
export function tickEggs(ctx: EggCtx): EggDef[] {
  ensureLoad();
  const now = new Date();
  const found: EggDef[] = [];
  for (const e of EASTER_EGGS) {
    if (discovered.includes(e.id)) continue;
    const c = e.cond;
    let hit = false;
    if (c.t === "spot" && c.stage === ctx.stage) {
      hit = Math.hypot(ctx.px - c.x, ctx.py - c.y) <= c.r;
    } else if (c.t === "clock") {
      hit = now.getHours() === c.hour && (c.dow === undefined || now.getDay() === c.dow);
    } else if (c.t === "item") {
      hit = ctx.items.has(c.key);
    } else if (c.t === "visits") {
      hit = (ctx.visitCounts[c.stage] ?? 0) >= c.n;
    } else if (c.t === "kills") {
      hit = ctx.totalKills >= c.n;
    } else if (c.t === "count") {
      hit = (ctx.counters[c.key] ?? 0) >= c.n;
    } else if (c.t === "idle") {
      hit = ctx.idleSec >= c.n;
    } else if (c.t === "chapters") {
      const chs = new Set(
        Object.keys(ctx.visitCounts)
          .filter((k) => k !== "village")
          .map((k) => k.replace(/\d+$/, "")),
      );
      hit = chs.size >= c.n;
    }
    if (hit) {
      discovered.push(e.id);
      found.push(e);
      if (found.length >= 2) break; // 틱당 최대 2개
    }
  }
  if (found.length) persist();
  return found;
}

/** 항상-조건(사운드/컬렉션) 훅용 직접 발견 */
export function discoverDirect(id: string): EggDef | null {
  ensureLoad();
  const e = EASTER_EGGS.find((x) => x.id === id);
  if (!e || discovered.includes(e.id)) return null;
  discovered.push(e.id);
  persist();
  return e;
}

/** CHAPTERS 재수출 방지용 더미 (타입 트리 셰이킹 회피) */
void CHAPTERS;
