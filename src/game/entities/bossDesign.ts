/**
 * 정본 보스 설계 — 스토리 기획서(evernote-approved 1~8)에서 뽑은 전투 근거.
 *
 * [이 파일이 왜 있나]
 *  vc288 까지 보스 패턴(`BossAttackKind`)은 게임 장르 관습으로만 배치돼 있었다.
 *  즉 "슬램/차지/볼리" 같은 일반 패턴을 보스별로 나눠 끼워 넣은 수준이었다.
 *  유저 요구: "모든 주요 보스는 단순 체력 많은 몬스터가 되어서는 안 된다."
 *  그러려면 **각 보스가 왜 그 패턴을 쓰는지**가 정본에 있어야 한다.
 *
 * [정본 근거 — docs/handoff/evernote-approved]
 *  · 해롤드 5.txt:100  "과거 바다의 저주를 받아 쫓겨난 괴물 해롤드"
 *  · 해롤드 5.txt:169  "거대한 해적선이 나타났다 … 바다의 군단장 해롤드"
 *  · 해롤드 5.txt:173  "카르텔이 … 해롤드를 도발하자 저주받은 바다의 힘 즉 크라켄으로 변하면서"
 *  · 해롤드 5.txt:174  "삼지창이 던져질 때마다 더욱더 날뛰었고 먹물과 고대의 힘으로 모든 것을 파괴"
 *  · 페르온 5.txt:101  "어둠의 다크엑스칼리버와 보석의 힘을 가지고 있는 페르온"
 *  · 페르온 5.txt:306  "무의식적으로 드래곤을 죽였다 … 엑스칼리버를 뽑자 … 다크엑스칼리버로 바뀌면서
 *                      검은 드래곤의 영혼을 그 보석 안에 집어 넣었다"
 *  · 페르온 5.txt:317  "'솔라플레임이그니션소드'는 '다크엑스칼리버'에 점차 밀리기 시작하였다"
 *  · 스칼렛 5.txt:451  "라이트와 다크니스보석이 형체화된 빛의 아이온과 어둠의 알다바오트가 그들을 위협했다"
 *  · 스칼렛 5.txt:461  "스칼렛은 카타나에 피와 어둠의 마법을 걸고는 피와 어둠의 의식을 하고 있었다"
 *  · 스칼렛 5.txt:470  "인피니트보석의 힘을 흡수한 것 뿐만 아니라 피의 힘과 진정한 어둠의 힘"
 *  · 스칼렛 5.txt:476  "자신의 창조물의 힘과 저주표식이 있는 … 힘까지 손에 넣으니"
 *  · 스칼렛 5.txt:488  "몬스터 생성을 아예 멈추고 몬스터를 흡수하고 있는 것이다"
 *  · 스칼렛 5.txt:492  "도사가 스칼렛을 움직이지 못하게 만든 뒤"
 *  · 스칼렛 5.txt:494  "바인드를 끊고 피해서"
 *
 * [이 파일의 계약]
 *  · Phaser / DOM / Math.random 의존 없음. 순수 데이터 + 조회 함수.
 *  · Boss.ts 는 이 표를 참조한다. 표를 고치면 전투가 같이 움직인다.
 *  · 정본에 없는 보스는 `null` — 억지로 만들지 않는다.
 */

/** 정본에서 전투 근거를 확인한 보스. */
export type CanonBossKey = "harold" | "feron" | "scarlet";

export type BossPhaseDesign = {
  /** HP 비율 상한(이 값 이하로 떨어지면 이 페이즈) */
  readonly at: number;
  /** 정본상 이 페이즈의 형태 */
  readonly form: string;
  /** 이 페이즈에서 쓰는 패턴 (BossAttackKind 또는 vx 이름) */
  readonly patterns: readonly string[];
  /** 정본 근거 위치 `"N.txt:줄"` 또는 `"N.txt:시작-끝"`. 실제 파일·줄과 대조한다. */
  readonly canon: string;
  /** 그 대목이 말하는 것 (사람이 읽는 요약) */
  readonly note: string;
};

export type BossDesign = {
  readonly name: string;
  /** 정본상 이 보스가 싸우는 이유 — 대사/배너에 쓴다 */
  readonly motive: string;
  /** 정본상 무기·힘 */
  readonly power: string;
  readonly phases: readonly BossPhaseDesign[];
};

/**
 * 정본 보스 3종.
 *
 * 해롤드 — 1페이즈는 삼지창을 던지는 인간형, 2페이즈에 크라켄으로 변신한다.
 *  정본 5.txt:173 이 변신을 명시한다("저주받은 바다의 힘 즉 크라켄으로 변하면서").
 *  그래서 telegraph 가 긴 대신 판정이 넓은 해양 패턴(조류/먹물)을 2페이즈에 몰아준다.
 *
 * 페르온 — 다크엑스칼리버를 든 검사. 2페이즈에 검은 드래곤의 영혼이 깨어난다.
 *  정본 5.txt:306-308 이 "검은 드래곤의 영혼을 보석 안에 집어 넣었다"고 못박는다.
 *  검 패턴(베기/돌진)은 1페이즈에, 브레스/급강하는 2페이즈에 둔다.
 *
 * 스칼렛 — 정본의 최종전은 3단 구조다.
 *  ① 빛의 아이온과 어둠의 알다바오트(보석이 형체화된 존재)가 먼저 나선다 — 5.txt:451
 *  ② 스칼렛 본체: 카타나 + 피와 어둠의 의식 — 5.txt:461
 *  ③ 창조물·저주표식 흡수 후 최종 형태 — 5.txt:476
 *  그래서 스칼렛만 페이즈가 3개다.
 */
export const CANON_BOSS_DESIGN: Record<CanonBossKey, BossDesign> = {
  harold: {
    name: "해롤드",
    motive: "과거 바다의 저주를 받아 쫓겨난 괴물. 저주가 곧 그의 힘이자 형벌이다.",
    power: "삼지창 · 저주받은 바다(크라켄)",
    phases: [
      {
        at: 1.0,
        form: "인간형",
        patterns: ["charge", "volley", "summon"],
        canon: "5.txt:169-172",
        note: "거대한 해적선, 삼지창으로 전장을 휘젓는다",
      },
      {
        at: 0.5,
        form: "크라켄",
        patterns: ["ring", "beam", "zones", "slam"],
        canon: "5.txt:173-174",
        note: "크라켄으로 변하면서 삼지창이 던져질 때마다 더 날뛴다",
      },
    ],
  },
  feron: {
    name: "페르온",
    motive: "다크니스 보석의 힘에 취해 스칼렛의 군단장이 된 자. 검은 드래곤의 영혼을 품었다.",
    power: "다크엑스칼리버 · 검은 드래곤의 영혼",
    phases: [
      {
        at: 1.0,
        form: "검사",
        patterns: ["charge", "blink", "volley"],
        canon: "5.txt:317",
        note: "솔라플레임이그니션소드를 압도하는 다크엑스칼리버",
      },
      {
        at: 0.5,
        form: "검은 드래곤",
        patterns: ["beam", "slam", "zones", "summon"],
        canon: "5.txt:306-308",
        note: "검은 드래곤의 영혼이 보석 안에서 깨어난다",
      },
    ],
  },
  scarlet: {
    name: "스칼렛",
    motive: "인피니트보석의 반쪽(다크니스)을 삼킨 어둠의 군주. 처음엔 힘이 아니라 '길을 바꾸는 것'을 원했다.",
    power: "카타나 · 피와 어둠의 의식 · 창조물 흡수",
    phases: [
      {
        at: 1.0,
        form: "어둠의 군주",
        patterns: ["blink", "volley", "zones"],
        canon: "5.txt:461",
        note: "카타나에 피와 어둠의 마법을 걸고 의식을 치른다",
      },
      {
        at: 0.66,
        form: "아이온 · 알다바오트",
        patterns: ["ring", "spiral", "thunderfall", "summon"],
        canon: "5.txt:451",
        note: "라이트와 다크니스 보석이 형체화된 빛의 아이온과 어둠의 알다바오트",
      },
      {
        at: 0.33,
        form: "흡수된 자",
        patterns: ["beam", "magicburst", "frostnova", "firepillars", "portalteleport"],
        canon: "5.txt:476",
        note: "창조물의 힘과 저주표식이 있는 자들의 힘까지 손에 넣는다",
      },
    ],
  },
};

/** 이 보스가 정본 설계를 갖고 있는가. */
export function canonBossOf(key: string): BossDesign | null {
  return (CANON_BOSS_DESIGN as Record<string, BossDesign>)[key] ?? null;
}

/** 해당 HP 비율(0~1)에서의 페이즈 인덱스(0부터). 정본 설계가 없으면 -1. */
export function canonPhaseIndex(key: string, hp01: number): number {
  const d = canonBossOf(key);
  if (!d) return -1;
  const r = Number.isFinite(hp01) ? hp01 : 0;
  /* phases 는 at 이 내림차순(1.0 → 0.5 → 0.33)이다. HP 가 그 값 이하로 떨어질 때마다
   * 한 단계씩 내려가므로, "r <= at" 인 것 중 **가장 뒤**가 현재 페이즈다. */
  let idx = 0;
  for (let i = 0; i < d.phases.length; i++) {
    if (r <= d.phases[i].at) idx = i;
  }
  return idx;
}

/** 해당 HP 비율에서 실제로 뽑히는 패턴 목록 (이전 페이즈 것을 **유지**한다). */
export function canonPatternsAt(key: string, hp01: number): string[] {
  const d = canonBossOf(key);
  if (!d) return [];
  const idx = canonPhaseIndex(key, hp01);
  const out: string[] = [];
  for (let i = 0; i <= idx; i++) for (const p of d.phases[i].patterns) if (!out.includes(p)) out.push(p);
  return out;
}
