/**
 * vc178 (지시 #1·#2) — 레벨 기반 콘텐츠 개방 + 기능별 튜토리얼.
 *
 * 설계:
 *  · UNLOCKS — "레벨 L에 기능 F가 열린다"를 데이터로 선언. UI(버튼 잠금)와
 *    개방 연출(배너+튜토리얼)이 같은 표를 본다(이중 관리 금지).
 *  · 각 기능에는 TUTORIAL_SCRIPTS[feature] 3~4장 스크립트가 붙는다.
 *    처음 개방될 때 자동 재생되고, 설정 → 튜토리얼 다시보기에서 언제든 재생 가능.
 *  · 개방 판정은 순수 함수(isUnlocked) — 세이브 없이도 계산 가능해야 테스트가 쉽다.
 */

export type FeatureKey =
  | "bag"        // 가방/인벤토리
  | "skill"      // 스킬 슬롯
  | "quest"      // 퀘스트 로그
  | "shop"       // 상점
  | "warp"       // 지역 이동
  | "stat"       // 스탯/AP
  | "boss"       // 보스 재도전
  | "content"    // 무한 콘텐츠 허브
  | "union"      // 유니온
  | "rank"       // 랭킹
  | "trade"      // 거래소
  | "bmshop"     // 캐시 상점
  | "pass"       // 시즌 패스
  | "isekai"     // 바르가 원정대
  | "home";      // 집 꾸미기

export type UnlockDef = {
  key: FeatureKey;
  /** 개방 레벨 */
  lv: number;
  name: string;
  /** 잠금 상태에서 보여줄 한 줄 */
  lockedHint: string;
  /** 개방 배너 문구 */
  openText: string;
};

/* vc178 — 개방 순서는 "플레이 리듬" 기준으로 잡았다.
 *  Lv1~3: 기본 조작만 (가방은 바로, 스킬은 튜토리얼 ⑤와 맞물려 Lv2)
 *  Lv5 상점 / Lv7 퀘스트 / Lv10 스탯 / Lv12 이동 / Lv18 보스 재도전
 *  Lv20 무한 콘텐츠 / Lv25 거래소 / Lv30 캐시상점(첫 과금 노출은 늦게) / Lv35 랭킹
 *  Lv40 유니온 / Lv45 시즌패스 / Lv50 바르가 원정대 / Lv1 집(마을 내 집은 처음부터) */
export const UNLOCKS: UnlockDef[] = [
  { key: "bag", lv: 1, name: "가방", lockedHint: "Lv1부터 사용할 수 있어요", openText: "가방이 열렸다! 장비를 확인하고 착용해 보자" },
  { key: "home", lv: 1, name: "집 꾸미기", lockedHint: "Lv1부터 사용할 수 있어요", openText: "내 집이 열렸다! 마을 우측 하단에서 꾸밀 수 있어" },
  { key: "skill", lv: 2, name: "스킬", lockedHint: "Lv2에 열려요", openText: "스킬이 열렸다! Z키(모바일 버튼)로 첫 스킬을 써 보자" },
  { key: "shop", lv: 5, name: "상점", lockedHint: "Lv5에 열려요", openText: "상점이 열렸다! 물약과 장비를 살 수 있어" },
  { key: "quest", lv: 7, name: "퀘스트", lockedHint: "Lv7에 열려요", openText: "퀘스트 로그가 열렸다! J키로 진행 상황을 확인하자" },
  { key: "stat", lv: 10, name: "스탯", lockedHint: "Lv10에 열려요", openText: "스탯 창이 열렸다! 레벨업으로 받은 AP를 분배하자" },
  { key: "warp", lv: 12, name: "지역 이동", lockedHint: "Lv12에 열려요", openText: "지역 이동이 열렸다! 방문한 구역으로 되돌아갈 수 있어" },
  { key: "boss", lv: 18, name: "보스 재도전", lockedHint: "Lv18에 열려요", openText: "보스 재도전이 열렸다! 지난 보스와 다시 싸워 보자" },
  { key: "content", lv: 20, name: "무한 콘텐츠", lockedHint: "Lv20에 열려요", openText: "무한 콘텐츠가 열렸다! 심연의 탑·시련에 도전하자" },
  { key: "trade", lv: 25, name: "거래소", lockedHint: "Lv25에 열려요", openText: "거래소가 열렸다! 다른 모험가와 물건을 사고팔 수 있어" },
  { key: "bmshop", lv: 30, name: "캐시 상점", lockedHint: "Lv30에 열려요", openText: "캐시 상점이 열렸다! 에메랄드로 특별한 아이템을 살 수 있어" },
  { key: "rank", lv: 35, name: "랭킹", lockedHint: "Lv35에 열려요", openText: "랭킹이 열렸다! 다른 모험가와 실력을 겨뤄 보자" },
  { key: "union", lv: 40, name: "유니온", lockedHint: "Lv40에 열려요", openText: "유니온이 열렸다! 캐릭터를 배치해 계정 전체를 강화하자" },
  { key: "pass", lv: 45, name: "시즌 패스", lockedHint: "Lv45에 열려요", openText: "시즌 패스가 열렸다! 미션을 채워 보상을 받자" },
  { key: "isekai", lv: 50, name: "바르가 원정대", lockedHint: "Lv50에 열려요", openText: "바르가 원정대가 열렸다! 피규어·룬·성좌를 모아 보자" },
];

const BY_KEY = new Map<FeatureKey, UnlockDef>(UNLOCKS.map((u) => [u.key, u]));

export function unlockDef(key: FeatureKey): UnlockDef | undefined {
  return BY_KEY.get(key);
}

/** 기능 해금 레벨 (정의 없으면 0 = 항상 열림) */
export function unlockLevel(key: FeatureKey): number {
  return BY_KEY.get(key)?.lv ?? 0;
}

/** 해당 레벨에서 열리는 기능들 */
export function featuresAtLevel(lv: number): UnlockDef[] {
  return UNLOCKS.filter((u) => u.lv === lv);
}

/** 열려 있는지 — 순수 판정 */
export function isUnlocked(key: FeatureKey, lv: number, override?: FeatureKey[]): boolean {
  if (override?.includes(key)) return true; // GM/디버그
  return lv >= unlockLevel(key);
}

/** 아직 안 열린 기능 목록 (HUD 잠금 힌트용) */
export function lockedFeatures(lv: number): UnlockDef[] {
  return UNLOCKS.filter((u) => lv < u.lv);
}

/** 다음에 열릴 기능 (가장 가까운 레벨) */
export function nextUnlock(lv: number): UnlockDef | null {
  const rest = UNLOCKS.filter((u) => u.lv > lv).sort((a, b) => a.lv - b.lv);
  return rest[0] ?? null;
}

/* =====================================================================
 * 기능별 튜토리얼 스크립트 — "처음 열릴 때 1회 자동" + "설정에서 다시보기"
 *  각 장은 짧은 제목/본문/강조 위치를 가진다. UI는 기존 배너·패널 체계를 쓴다.
 *
 *  vc179 (지시 #2 — "글로만 알려주지 말고 실제로 그 기능을 쓰게 시켜"):
 *   각 장에 `do`(할 일)를 붙였다. do 가 있으면 오버레이가 "해 보세요" 상태로 떠 있고,
 *   플레이어가 실제로 그 행동(패널 열기/스킬 사용/공격)을 하면 자동으로 다음 장으로
 *   넘어간다. 글 읽고 닫는 것만으로는 기능이 손에 익지 않는다는 지적의 수리.
 * ===================================================================== */
export type TutDo =
  | { kind: "panel"; panel: string }   // 해당 패널을 직접 열어 보게
  | { kind: "skill" }                  // Z 스킬 사용
  | { kind: "attack" }                 // 기본공격
  | { kind: "move" };                  // 이동

export type TutPage = {
  title: string;
  body: string;
  /** 화면에서 가리킬 위치 (모바일/PC 공통 안내 문구) */
  where?: string;
  /** vc179 — 이 장에서 실제로 해 볼 행동 (있으면 완료 전까지 다음으로 안 넘어감) */
  do?: TutDo;
};

export const TUTORIAL_SCRIPTS: Record<FeatureKey, TutPage[]> = {
  bag: [
    { title: "가방 열기", body: "가방에는 지금까지 모은 장비와 소모품이 전부 들어 있어. 지금 바로 열어 보자.", where: "오른쪽 위 가방 아이콘", do: { kind: "panel", panel: "inv" } },
    { title: "장비 착용", body: "장비를 누르면 바로 착용돼. 무기·방어구·장신구는 각자 슬롯이 있어.", where: "가방 → 장비 탭", do: { kind: "panel", panel: "inv" } },
    { title: "정리와 판매", body: "안 쓰는 장비는 팔면 골드가 돼. 잠금(자물쇠)을 걸면 실수로 팔지 않아.", where: "가방 → 아이템 상세" },
  ],
  home: [
    { title: "내 집", body: "마을마다 내 집이 있어. 문 앞에서 E(모바일은 버튼)를 누르면 들어가.", where: "마을 우측 — 내 집", do: { kind: "move" } },
    { title: "꾸미기", body: "집 안 우측 하단 '꾸미기'에서 가구를 배치해. 가구는 상점에서 사고, 보유 수만큼 놓을 수 있어.", where: "집 안 우측 하단" },
    { title: "배치와 회수", body: "가구를 고르고 방 칸을 누르면 배치, 놓인 가구를 누르면 회수돼. 배치는 자동 저장돼.", where: "꾸미기 패널" },
  ],
  skill: [
    { title: "스킬이란", body: "스킬은 기본공격보다 강하고 쿨타임이 있어. MP를 쓰니까 MP 바를 보면서 써.", where: "오른쪽 아래 스킬 버튼" },
    { title: "첫 스킬 — 직접 써 보자", body: "Z키(모바일은 첫 번째 스킬 버튼)를 누르면 계열 전용 스킬이 나가. 해적은 총을 쏘고, 전사는 회전베기를 해. 지금 눌러 봐.", where: "Z / 스킬 버튼", do: { kind: "skill" } },
    { title: "쿨타임 관리", body: "스킬 버튼에 남은 초가 표시돼. 쿨이 돌아오면 발밑에 빛이 나니 그때 다시 써.", where: "스킬 버튼의 숫자" },
  ],
  shop: [
    { title: "상점 열기", body: "마을 상인에게 말을 걸면 상점이 열려. 물약·장비·가구를 골드로 살 수 있어. 지금 열어 보자.", where: "마을 상인", do: { kind: "panel", panel: "shop" } },
    { title: "수량 구매", body: "물약은 수량을 직접 입력해 한 번에 살 수 있어. 10개·MAX 버튼도 있어.", where: "상점 → 수량 칸" },
    { title: "직업 전용", body: "무기 중에는 내 직업만 쓸 수 있는 게 있어. 안 맞는 무기는 진열되지 않아.", where: "상점 → 장비" },
  ],
  quest: [
    { title: "퀘스트 로그", body: "지금 해야 할 일이 여기에 정리돼. J키(모바일은 퀘스트 아이콘)로 열 수 있어. 지금 열어 보자.", where: "J / 퀘스트 아이콘", do: { kind: "panel", panel: "quest" } },
    { title: "진행과 보상", body: "목표를 채우면 자동으로 완료되고 보상이 들어와. 트래커에 진행도가 보여.", where: "화면 위쪽 트래커" },
    { title: "반복 의뢰", body: "스토리를 다 끝내면 상인에게서 반복 토벌 의뢰를 받아. 완료할 때마다 보상이 커져.", where: "상인 라고스" },
  ],
  stat: [
    { title: "스탯 창", body: "레벨업하면 AP를 받아. 스탯 창에서 원하는 능력치에 넣으면 돼. 지금 열어 보자.", where: "C / 스탯 아이콘", do: { kind: "panel", panel: "stat" } },
    { title: "무엇에 넣지", body: "내 직업 주스탯에 먼저 넣는 게 효율적이야. 자동분배 버튼도 있어.", where: "스탯 창 → 자동분배" },
    { title: "되돌리기", body: "분배한 AP는 일정 비용으로 되돌릴 수 있어. 실수해도 괜찮아.", where: "스탯 창 → 초기화" },
  ],
  warp: [
    { title: "지역 이동", body: "한 번이라도 가 본 구역은 부적으로 되돌아갈 수 있어.", where: "이동 아이콘" },
    { title: "부적", body: "이동에는 부적이 1장 필요해. 상인에게서 살 수 있어.", where: "상점 → 기타 소모품" },
    { title: "주의", body: "보스전 중에는 이동할 수 없어. 먼저 보스방을 나가자.", where: "보스 구역" },
  ],
  boss: [
    { title: "보스 재도전", body: "한 번 잡은 보스는 다시 도전할 수 있어. 난이도를 골라 도전해.", where: "보스 아이콘" },
    { title: "난이도", body: "난이도가 높을수록 보상이 커지지만 패턴이 아파져. 장비를 맞추고 가자.", where: "보스 창 → 난이도" },
    { title: "전리품", body: "보스는 전용 장비를 떨어뜨려. 거래소에서 사고팔 수도 있어.", where: "보스 처치 후" },
  ],
  content: [
    { title: "무한 콘텐츠", body: "스토리와 별개로 계속 도전할 수 있는 콘텐츠야. 심연의 탑·티어 균열·시련이 있어.", where: "더보기 → 콘텐츠" },
    { title: "심연의 탑", body: "층마다 적이 강해지고 10층마다 보스가 나와. 최고 기록에 도전해 봐.", where: "콘텐츠 → 탑" },
    { title: "보상", body: "층을 오를수록 보상이 커져. 여기서만 얻는 재료도 있어.", where: "탑 클리어 후" },
  ],
  trade: [
    { title: "거래소", body: "다른 모험가가 올린 물건을 사거나 내 물건을 팔 수 있어. 지금 열어 보자.", where: "더보기 → 거래소", do: { kind: "panel", panel: "trade" } },
    { title: "등록", body: "가방에서 아이템을 골라 가격을 정해 올려. 팔리면 골드가 들어와.", where: "거래소 → 판매" },
    { title: "주의", body: "잠근 아이템은 등록되지 않아. 실수 방지용이니까 활용하자.", where: "가방 → 자물쇠" },
  ],
  bmshop: [
    { title: "캐시 상점", body: "에메랄드로 특별한 아이템을 사는 곳이야. 게임 플레이로도 모을 수 있어.", where: "더보기 → 캐시 상점" },
    { title: "에메랄드", body: "에메랄드는 업적·보스·이벤트로 얻어. 무과금도 모을 수 있어.", where: "재화 표시" },
    { title: "구매 확인", body: "결제는 항상 확인 창을 거쳐. 실수 결제를 막기 위한 장치야.", where: "구매 버튼" },
  ],
  rank: [
    { title: "랭킹", body: "레벨·전투력·보스 기록으로 다른 모험가와 순위를 겨뤄.", where: "더보기 → 랭킹" },
    { title: "랭커 특전", body: "상위 랭커는 전용 상점을 쓸 수 있어. 매주 갱신돼.", where: "랭킹 → 특전" },
  ],
  union: [
    { title: "유니온", body: "캐릭터를 격자에 배치해 계정 전체에 능력치를 주는 시스템이야.", where: "더보기 → 유니온" },
    { title: "배치", body: "캐릭터를 끌어다 칸에 놓으면 그 위치에 따라 효과가 붙어.", where: "유니온 → 그리드" },
    { title: "등급", body: "배치를 잘하면 등급이 올라 더 좋은 효과를 받아.", where: "유니온 → 등급" },
  ],
  pass: [
    { title: "시즌 패스", body: "시즌 동안 미션을 채워 단계별 보상을 받는 시스템이야.", where: "더보기 → 시즌 패스" },
    { title: "무료/프리미엄", body: "무료 보상만으로도 충분히 받을 수 있어. 프리미엄은 추가 보상이야.", where: "패스 → 보상 줄" },
  ],
  isekai: [
    { title: "바르가 원정대", body: "피규어·배지·룬·성좌를 모아 캐릭터를 강화하는 수집 콘텐츠야.", where: "더보기 → 바르가" },
    { title: "룬과 성좌", body: "룬은 슬롯에 끼우고, 성좌는 노드를 차례로 열어. 모을수록 강해져.", where: "바르가 → 룬/성좌" },
  ],
};

/** 세이브에 기록되는 "이미 본 튜토리얼" 키 */
export function tutSeenKey(key: FeatureKey): string {
  return `feat_${key}`;
}
