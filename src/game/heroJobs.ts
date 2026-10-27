/**
 * heroJobs.ts — 기획서 주요 인물의 "직업" 정의 (vc192)
 *
 * 사용자 지시: "앞으로 대규모 업데이트를 할 때 기획서의 스토리의 주요 인물을 직업으로 낼 거야
 *              (모험가와 별개의 직업)"
 *
 * ── 설계 ──
 *  · 모험가(Adventurer) 트리와 **완전히 분리된** 별도 직업 계통이다.
 *  · 전직(승격)이 아니라 **각성**으로 해금된다 — 기획서 인물은 계보가 아니라 서사로 강해진다.
 *  · 단계는 기획서의 힘 등급 그대로: 순력 → 혼력 → 초력.
 *  · 무기·원소·능력명은 기획서 원문을 그대로 쓴다(임의 창작 금지).
 *
 * ── 슬롯 분리 ──
 *  Player.cls(모험가) 와 Player.heroClass(인물) 는 **동시에 보유**되며, 활성 쪽만 스탯·스킬에 반영된다.
 *  (합산하면 밸런스가 무너지므로 "대체" 방식)
 */
import type { ElementKey } from "./lore";
import type { MasterGrade } from "./lore";
import type { Skill1Kind, Skill2Kind, Skill3Kind, Skill4Kind } from "./classes";

/** 인물 직업 키 */
export type HeroKey =
  /* 1기 — 라일락 */
  | "scarlet" | "ari" | "lucy" | "zer" | "riel" | "velika" | "ran" | "lilac" | "yunji"
  /* 2·3기 — 추후 확장(데이터만 등록, 잠금) */
  | "feron" | "veronica" | "dean" | "harold" | "jade" | "yume" | "sinif" | "eric";

/** 인물 직업의 스킬 3단 (원소 → 영역 → 초월) */
export interface HeroSkills {
  /** 원소 어빌리티 — 기본기 */
  elem: { name: string; desc: string };
  /** 영역 어빌리티 — 주위에 원소 영역 전개 */
  field: { name: string; desc: string };
  /** 초월 어빌리티 — 인물 고유의 최종기 */
  master: { name: string; desc: string };
}

export interface HeroJobDef {
  key: HeroKey;
  /** 직업명 (예: "검의 초월자") */
  name: string;
  /** 기획서 인물명 */
  character: string;
  /** 기획서 원문의 개명 전 이름 (있으면 병기) */
  former?: string;
  /** 기획서에 명시된 전용 무기 */
  weapon: string;
  element: ElementKey;
  /** 능력 등급 — 순력/혼력/초력 */
  grade: MasterGrade;
  /** 소속 가문 key (lore.FAMILIES) */
  family?: string;
  /** 해금 조건 */
  unlock: {
    /** 필요 챕터(스테이지 키) */
    chapter?: string;
    /** 필요 레벨 */
    lv: number;
    /** 필요 재료 아이템 키 */
    item?: string;
    /** 필요 퀘스트/시련 키 */
    trial?: string;
  };
  /** 인물 직업 보너스 (모험가 보너스 대신 적용) */
  bonus: { hpAdd: number; mpAdd: number; atkAdd: number; spdMul: number };
  skills: HeroSkills;
  /** 초상화 파일 (public/assets/portrait/...) */
  portrait?: string;
  /** 한 줄 소개 (각성 UI) */
  blurb: string;
}

/**
 * 1기 인물 8종 — 전부 플레이 가능.
 *  무기·원소·능력명은 기획서 「웨폰마스터 능력 정리본」에서 그대로 옮겼다.
 */
export const HERO_JOBS: Record<HeroKey, HeroJobDef> = {
  /* ── 스칼렛 — 어둠의 군주 (1기 최종 보스였으나 각성 해금으로 플레이 가능) ── */
  scarlet: {
    key: "scarlet",
    name: "어둠의 군주",
    character: "스칼렛 에델리오나",
    former: "정륜",
    weapon: "카타나",   /* 기획서 47행: 신정륜(어둠마녀) — 카타나, 어둠 */
    element: "dark",
    grade: "choryeok",
    family: "edeliona_f",
    unlock: { chapter: "abyss", lv: 120, item: "orb_dark", trial: "trial_scarlet" },
    bonus: { hpAdd: 320, mpAdd: 140, atkAdd: 46, spdMul: 1.04 },
    skills: {
      /* 기획서 47행 능력 순서: 세뇌 · 핏빛세례 · 진정한 어둠의 군주 */
      elem: { name: "세뇌", desc: "적 하나를 잠시 아군으로 되돌려 함께 싸우게 한다." },
      field: { name: "핏빛 세례", desc: "전방에 어둠의 파도를 내보내 다수를 베고 출혈을 남긴다." },
      master: { name: "진정한 어둠의 군주", desc: "주위를 어둠으로 덮어 적의 시야와 이동을 묶는다." },
    },
    portrait: "portrait/p_늪지_어부_팰.webp",   /* NPC 늪지_어부_팰 — 덮수룩·신비로운 방랑자 → 어둠의 군주 */
    blurb: "무한의 탑에서 다크니스 보석을 얻고 스스로 어둠의 군주를 칭한 자.",
  },

  /* ── 아리 — 검의 초월자 ── */
  ari: {
    key: "ari",
    name: "검의 초월자",
    character: "아리스텔라 데스티니",
    former: "유진",
    weapon: "솔라플레임이그니션소드",
    element: "fire",
    grade: "choryeok",
    family: "destiny_f",
    unlock: { chapter: "hel", lv: 100, item: "orb_fire", trial: "trial_ari" },
    bonus: { hpAdd: 260, mpAdd: 110, atkAdd: 52, spdMul: 1.08 },
    skills: {
      /* 기획서 53행: 정유진 — 솔라플레임이그니션소드, 불, 태양의불꽃, 검의 수호자 */
      elem: { name: "태양의 불꽃", desc: "검에 태양의 불꽃을 둘러 전방을 크게 벤다. 화상이 남는다." },
      field: { name: "검의 수호자", desc: "검의 영역을 펼쳐 들어오는 적을 자동으로 베어낸다." },
      master: { name: "솔라플레임 이그니션", desc: "검 하나로 하늘을 태워 거대한 불기둥을 세운다." },
    },
    portrait: "portrait/p_요정_사절_리안.webp",   /* NPC 요정_사절_리안 — 여전사·기사 인상 → 검의 초월자 */
    blurb: "에벤트 왕국의 근위대장. 리안의 곁에서 검을 익혀 초월의 경지에 이른 자.",
  },

  /* ── 루시 — 생명의 초월자 ── */
  lucy: {
    key: "lucy",
    name: "생명의 초월자",
    character: "루시페르 에크레디트",
    former: "선우",
    weapon: "무기 없음",
    element: "nature",
    grade: "choryeok",
    family: "ecredit_f",
    unlock: { chapter: "hel", lv: 100, item: "orb_nature", trial: "trial_lucy" },
    bonus: { hpAdd: 300, mpAdd: 180, atkAdd: 34, spdMul: 1.02 },
    skills: {
      /* 기획서 51행: 생명의초월자 — 무기없음, 자연과생명, 치유, 제작 */
      elem: { name: "치유", desc: "자신과 주변 아군을 회복하고 상태이상을 정화한다." },
      field: { name: "생명이 피어나는 연못", desc: "발밑에 생명의 연못을 만들어 지속 회복과 적 둔화를 동시에 건다." },
      master: { name: "제작", desc: "생명을 빚어내 아군 전원을 완전 회복시키고 적을 속박한다." },
    },
    portrait: "portrait/p_세계수_이그드라실.webp",   /* NPC 세계수_이그드라실 — 생명·성숙한 인상 → 생명의 초월자 */
    blurb: "페르디트 후손 자연 가문 출신. 현 시대 최강의 자연계 웨폰마스터.",
  },

  /* ── 제르 — 마법의 초월자 ── */
  zer: {
    key: "zer",
    name: "마법의 초월자",
    character: "제르이안 오르페우스",
    former: "준석",
    weapon: "마도서",   /* 기획서 2641행: 제르이안 오르페우스 — 마도서, 지배와 제작 */
    element: "light",
    grade: "choryeok",
    family: "orpheus_f",
    unlock: { chapter: "niflheim", lv: 95, item: "orb_magic", trial: "trial_zer" },
    bonus: { hpAdd: 210, mpAdd: 260, atkAdd: 44, spdMul: 1.0 },
    skills: {
      elem: { name: "주문 폭발", desc: "지팡이 끝에서 주문이 연쇄 폭발한다. 적을 밀어낸다." },
      field: { name: "뇌운", desc: "하늘에 뇌운을 띄워 범위 안의 적에게 반복 낙뢰를 내린다." },
      master: { name: "페우스", desc: "생명이 변하는 영역을 열어 적의 생명을 역류시킨다." },
    },
    portrait: "portrait/p_마법사_흐레스.webp",   /* NPC 마법사_흐레스 — 마법사 인상 → 마법의 초월자 */
    blurb: "에벤트 왕국의 총리이자 마법의 초월자. 오르페우스 가문의 후계.",
  },

  /* ── 리엘 — 도사 ── */
  riel: {
    key: "riel",
    name: "도사",
    character: "리엘",
    former: "정현",
    weapon: "도(刀) · 술법",
    element: "wind",
    grade: "sullyeok",
    family: undefined,
    unlock: { chapter: "kingdom", lv: 60, item: "orb_wind", trial: "trial_riel" },
    bonus: { hpAdd: 200, mpAdd: 130, atkAdd: 40, spdMul: 1.14 },
    skills: {
      elem: { name: "발도", desc: "발도술 — 전방으로 즉발 참격. 모션 없이 나간다." },
      field: { name: "영역 어빌리티", desc: "자신 주위에 원소 영역을 펼쳐 힘을 강화하고 공격한다." },
      master: { name: "도의 극", desc: "도를 완전히 뽑아 공간을 베어낸다. 회피 불가." },
    },
    portrait: "portrait/p_쿠소디아_기사단장.webp",   /* NPC 쿠소디아_기사단장 — 동양풍 검사·땋은머리 → 도사 */
    blurb: "칼리야 왕국의 도사이자 수호자. 하루에게 발도와 영역 어빌리티를 가르친 스승.",
  },

  /* ── 벨리카 — 번개의 초월자 ── */
  velika: {
    key: "velika",
    name: "번개의 초월자",
    character: "벨리카",
    weapon: "활",
    element: "electric",
    grade: "sullyeok",
    family: "everforce_f",
    unlock: { chapter: "muspelheim", lv: 80, item: "orb_electric", trial: "trial_velika" },
    bonus: { hpAdd: 190, mpAdd: 120, atkAdd: 42, spdMul: 1.16 },
    skills: {
      /* 기획서 59행: 벨리카 — 활, 전기, 대전화살, 벽력일섬 */
      elem: { name: "대전화살", desc: "전기를 담은 화살을 연사한다. 감전이 연쇄된다." },
      field: { name: "벽력일섬", desc: "번개로 변해 순간이동하며 지나간 자리를 태운다." },
      master: { name: "대전화살 · 벽력일섬", desc: "화살비가 쏟아진 뒤 번개가 연쇄한다." },
    },
    portrait: "portrait/p_룬_정령_이그니.webp",   /* NPC 룬_정령_이그니 — 궁수·여전사 인상 → 번개의 초월자 */
    blurb: "에버포스 가문의 번개 웨폰마스터. 대공립천문대에서 하루와 함께 훈련했다.",
  },

  /* ── 란 — 아트메이커 ── */
  ran: {
    key: "ran",
    name: "아트메이커",
    character: "아리아노 란",
    former: "성화",
    weapon: "마법붓",
    element: "water",
    grade: "sullyeok",
    family: "ariano_f",
    unlock: { chapter: "cave", lv: 70, item: "orb_water", trial: "trial_ran" },
    bonus: { hpAdd: 180, mpAdd: 200, atkAdd: 36, spdMul: 1.05 },
    skills: {
      /* 기획서 57행: 반성화 — 마법붓, 물, 아트메이크, 아트힐링 */
      elem: { name: "아트메이크", desc: "붓으로 그린 그림이 실체가 되어 적을 덮친다." },
      field: { name: "아트힐링", desc: "그린 그림에서 물이 솟아 아군을 회복시키고 적을 밀어낸다." },
      master: { name: "아트메이크 · 아트힐링", desc: "그림과 치유가 겹쳐 전장을 다시 그린다." },
    },
    portrait: "portrait/p_허브_채집가_베르.webp",   /* NPC 허브_채집가_베르 — 온화한 마법 견습 → 아트메이커 */
    blurb: "아리아노 가문의 아트메이커. 칼리야 왕국 협상조로 활약했다.",
  },

  /* ── 라일락 — 별빛의 계승자 ── */
  lilac: {
    key: "lilac",
    name: "별빛의 계승자",
    character: "라일락 데스티니",
    weapon: "펜던트",
    element: "light",
    grade: "sullyeok",
    family: "destiny_f",
    unlock: { chapter: "forest", lv: 40, item: "orb_light", trial: "trial_lilac" },
    bonus: { hpAdd: 220, mpAdd: 150, atkAdd: 38, spdMul: 1.10 },
    skills: {
      elem: { name: "별빛 검기", desc: "펜던트에서 흘러나온 빛이 검기가 되어 날아간다." },
      field: { name: "펜던트 공명", desc: "펜던트가 공명해 주변 적의 어둠 속성을 약화시킨다." },
      master: { name: "검의 인도", desc: "검의 주인을 인도해 잠시 무적으로 만든다." },
    },
    portrait: "portrait/p_신전_관리인_노아.webp",   /* NPC 신전_관리인_노아 — 빛·온화한 성녀 인상 → 별빛의 계승자 */
    blurb: "하루를 절벽에서 구하고 펜던트를 맡긴 자. 데스티니 가문의 별빛.",
  },

  /* ── 윤지왕자 — 바람의 초월자 (기획서 55행: 차크람, 바람, 꽃의축제, 스핀차크람) ── */
  yunji: {
    key: "yunji",
    name: "바람의 초월자",
    character: "에벤트이안 그래스트",
    former: "윤지",
    /* 기획서 55행 원문: 윤지왕자 — 차크람, 바람, 꽃의축제, 스핀차크람 */
    weapon: "차크람",
    element: "wind",
    grade: "choryeok",
    family: "grast_f",
    unlock: { chapter: "kingdom", lv: 85, item: "orb_wind", trial: "trial_yunji" },
    bonus: { hpAdd: 230, mpAdd: 170, atkAdd: 45, spdMul: 1.12 },
    skills: {
      elem: { name: "스핀차크람", desc: "차크람을 회전시켜 던져 적들을 베고 되돌아온다." },
      field: { name: "꽃의 축제", desc: "바람에 꽃잎이 흩날리며 주변 적을 속박하고 아군을 강화한다." },
      master: { name: "꽃의 축제 · 스핀차크람", desc: "꽃잎 회오리 속에서 수십 개의 차크람이 사방으로 튄다." },
    },
    portrait: "portrait/p_성전_견습_기사.webp",   /* NPC 성전_견습_기사 — 젊은 왕자 인상 → 바람의 초월자 */
    blurb: "에벤트 왕국의 왕자. 선발대 5인 중 한 명으로 라일락 월드에 왔다.",
  },

  /* ══════ 2·3기 — 데이터만 등록 (잠금 상태로 노출) ══════ */
  feron: {
    key: "feron",
    name: "암흑의 그림자",
    character: "페르슈타인 카르리온",
    former: "담현",
    weapon: "대형 낫",
    element: "dark",
    grade: "choryeok",
    family: "carion_f",
    unlock: { chapter: "abyss", lv: 150, item: "orb_dark", trial: "trial_feron" },
    bonus: { hpAdd: 340, mpAdd: 120, atkAdd: 58, spdMul: 1.02 },
    skills: {
      elem: { name: "그림자 베기", desc: "그림자에서 낫이 튀어나와 후방의 적을 벤다." },
      field: { name: "암흑 강림", desc: "주변을 완전한 어둠으로 덮어 적의 공격을 무력화한다." },
      master: { name: "카르리온의 낫", desc: "몰락한 가문의 저주를 실어 영혼을 거둔다." },
    },
    blurb: "몰락한 카르리온 가문의 후예. 스칼렛 군단의 암흑의 그림자.",
  },
  veronica: {
    key: "veronica", name: "어둠의 주술사", character: "베로니카", former: "원정",
    weapon: "주술구", element: "dark", grade: "choryeok",
    unlock: { chapter: "abyss", lv: 150, item: "orb_dark", trial: "trial_veronica" },
    bonus: { hpAdd: 240, mpAdd: 220, atkAdd: 48, spdMul: 1.03 },
    skills: {
      elem: { name: "저주", desc: "적에게 저주를 걸어 지속 피해를 준다." },
      field: { name: "주술진", desc: "바닥에 주술진을 그려 범위 내 적을 약화시킨다." },
      master: { name: "원혼 소환", desc: "죽은 자의 원혼을 불러 전장을 휩쓴다." },
    },
    blurb: "스칼렛의 군단장. 주술로 어둠을 부리는 자.",
  },
  dean: {
    key: "dean", name: "흑마법사", character: "딘", former: "기범",
    weapon: "마도서", element: "dark", grade: "choryeok",
    unlock: { chapter: "abyss", lv: 150, item: "orb_dark", trial: "trial_dean" },
    bonus: { hpAdd: 230, mpAdd: 240, atkAdd: 50, spdMul: 1.0 },
    skills: {
      elem: { name: "흑염", desc: "꺼지지 않는 검은 불꽃을 던진다." },
      field: { name: "마도서 펼침", desc: "마도서가 펼쳐지며 주변에 흑마법이 쏟아진다." },
      master: { name: "금단의 주문", desc: "금기의 주문으로 대가를 치르고 강력한 일격을 낸다." },
    },
    blurb: "스칼렛의 군단장. 금단의 흑마법을 다루는 자.",
  },
  harold: {
    key: "harold", name: "저주받은 괴물", character: "해롤드", former: "수경",
    weapon: "(변신)", element: "water", grade: "choryeok",
    unlock: { chapter: "kingdom", lv: 150, item: "orb_water", trial: "trial_harold" },
    bonus: { hpAdd: 420, mpAdd: 90, atkAdd: 54, spdMul: 0.96 },
    skills: {
      elem: { name: "촉수 강타", desc: "바다의 촉수로 전방을 후려친다." },
      field: { name: "심해의 압력", desc: "주변 수압을 높여 적의 이동을 늦춘다." },
      master: { name: "크라켄", desc: "크라켄으로 변신해 거대한 소용돌이를 일으킨다." },
    },
    blurb: "과거 바다의 저주를 받아 쫓겨난 괴물. 스칼렛의 군단장.",
  },
  jade: {
    key: "jade", name: "마법공학자", character: "제이드",
    weapon: "망치", element: "earth", grade: "choryeok",
    unlock: { chapter: "nidavellir", lv: 75, item: "orb_earth", trial: "trial_jade" },
    bonus: { hpAdd: 300, mpAdd: 140, atkAdd: 52, spdMul: 1.0 },
    skills: {
      /* 기획서 61행: 제이드 — 망치, 마법공학, 공학망치, 분신소환 */
      elem: { name: "공학망치", desc: "마법 기계를 실은 망치를 내려친다." },
      field: { name: "공방 전개", desc: "주변에 마법 기계를 전개해 자동 포격한다." },
      master: { name: "분신소환", desc: "자신의 분신을 소환해 동시에 공격한다." },
    },
    blurb: "그랜드 플래닛의 마법공학자. 망치 하나로 기계를 만든다.",
  },
  yume: {
    key: "yume", name: "꿈의 지배자", character: "유메",
    weapon: "(꿈)", element: "dark", grade: "choryeok",
    unlock: { chapter: "abyss", lv: 160, item: "orb_dark", trial: "trial_yume" },
    bonus: { hpAdd: 260, mpAdd: 260, atkAdd: 46, spdMul: 1.04 },
    skills: {
      elem: { name: "꿈의 파편", desc: "꿈의 파편을 흩뿌려 적을 혼미하게 만든다." },
      field: { name: "오션 코멘", desc: "꿈속 세계로 끌어들여 적의 인식을 왜곡한다." },
      master: { name: "몽중몽", desc: "꿈과 현실의 경계를 무너뜨려 전장을 뒤집는다." },
    },
    blurb: "오션 코멘의 꿈을 다스리는 자.",
  },
  sinif: {
    key: "sinif", name: "복제의 인물", character: "시니프",
    weapon: "(복제)", element: "none", grade: "choryeok",
    unlock: { chapter: "abyss", lv: 160, trial: "trial_sinif" },
    bonus: { hpAdd: 250, mpAdd: 200, atkAdd: 44, spdMul: 1.05 },
    skills: {
      elem: { name: "복제 타격", desc: "상대의 기술을 복제해 되돌려준다." },
      field: { name: "동조", desc: "주변 적의 강화 효과를 훔쳐 자신에게 붙인다." },
      master: { name: "완전 복제", desc: "대상 하나를 완전히 복제해 함께 싸운다." },
    },
    blurb: "그랜드 플래닛의 복제 능력자.",
  },
  eric: {
    key: "eric", name: "해커", character: "애릭",
    weapon: "(데이터)", element: "electric", grade: "choryeok",
    unlock: { chapter: "abyss", lv: 160, item: "orb_electric", trial: "trial_eric" },
    bonus: { hpAdd: 220, mpAdd: 230, atkAdd: 48, spdMul: 1.08 },
    skills: {
      elem: { name: "데이터 침식", desc: "적의 데이터를 침식해 방어를 무시한다." },
      field: { name: "해킹 필드", desc: "범위 내 적의 능력치를 강제로 낮춘다." },
      master: { name: "시스템 다운", desc: "전장의 시스템을 내려 적 전체를 정지시킨다." },
    },
    blurb: "그랜드 플래닛의 해커.",
  },
};

/** 인물 직업 목록 (각성 UI 노출 순서 — 1기 먼저) */
export const HERO_ORDER: HeroKey[] = [
  "lilac", "riel", "velika", "ran", "ari", "lucy", "zer", "yunji", "scarlet",
  "feron", "veronica", "dean", "harold", "jade", "yume", "sinif", "eric",
];

/** 1기에서 실제 해금 가능한 인물 (2·3기는 조건 미구현 → 잠금) */
export const HERO_PLAYABLE_ACT1: HeroKey[] = ["lilac", "riel", "velika", "ran", "ari", "lucy", "zer", "yunji", "scarlet", "jade"];

/** 등급 한글명 */
export const HERO_GRADE_KO: Record<MasterGrade, string> = {
  honlyeok: "혼력",
  sullyeok: "순력",
  choryeok: "초력",
};

/* ══════════════════════════════════════════════════════════════════════════
 * vc192 — 인물 스킬을 **기존 스킬 구현**에 연결한다.
 *
 * 원칙: 새 연출·새 메커니즘을 발명하지 않는다. classes.ts 에 이미 있는
 *       Skill1Kind/Skill2Kind/Skill3Kind/Skill4Kind 중에서 기획서 스킬의
 *       성격과 가장 맞는 것을 고른다. (검증된 코드를 재사용해야 튜닝·밸런스가 산다)
 *
 * 매핑 근거는 각 항목 주석에 적었다 — 기획서 문장 ↔ 기존 스킬 메커니즘.
 * ══════════════════════════════════════════════════════════════════════════ */
export interface HeroSkillKinds {
  /** 주력기 (기존 Skill1Kind) */
  s1: Skill1Kind;
  /** 기동기 (기존 Skill2Kind) */
  s2: Skill2Kind;
  /** 3차기 (기존 Skill3Kind) */
  s3?: Skill3Kind;
  /** 4차기 (기존 Skill4Kind) */
  s4?: Skill4Kind;
}

export const HERO_SKILL_KINDS: Partial<Record<HeroKey, HeroSkillKinds>> = {
  /* 스칼렛 — 핏빛 세례(전방 어둠 파도로 다수 베기+출혈)
   *   → ragespin: 회전베기 + 명중 출혈 (다수 타격 + 출혈이 정확히 일치) */
  scarlet: { s1: "ragespin", s2: "shadowveil", s3: "shadowblad", s4: "shadowclon" },

  /* 아리 — 태양의 불꽃(검에 불꽃을 둘러 전방을 크게 벤다)
   *   → judgment: 전방 참격 + 자기 회복 (성스러운 불꽃 검격의 인상) */
  ari: { s1: "judgment", s2: "lightspeed", s3: "holynova", s4: "judgment" },

  /* 루시 — 치유의 손길(자신·아군 회복+정화) / 생명의 연못
   *   → purify: 확산 파동 + 타격당 자힐 (회복이 주 기능인 유일한 주력기) */
  lucy: { s1: "purify", s2: "cycleblink", s3: "sanctuary", s4: "eternalloop" },

  /* 제르 — 주문 폭발(연쇄 폭발+밀어내기) / 뇌운
   *   → arcbolt: 착탄 광역 폭발 대형 볼트 (폭발 연쇄) */
  zer: { s1: "arcbolt", s2: "grandblink", s3: "thunder", s4: "manaburst" },

  /* 리엘 — 발도(모션 없이 즉발 참격) / 도의 극(공간을 벤다)
   *   → snipe: 즉발 히트스캔 관통 일격 (모션 없는 즉발이 일치) */
  riel: { s1: "snipe", s2: "windslash", s3: "trueshot", s4: "bladedance" },

  /* 벨리카 — 대전화살(전기 화살 연사+감전 연쇄) / 벽력일섬
   *   → volley: 부채꼴 관통 화살 (연사) */
  velika: { s1: "volley", s2: "falconwind", s3: "thunder", s4: "godarrow" },

  /* 란 — 아트메이커(마법붓으로 그려낸 것이 실체화)
   *   → purify(물빛 파동) 대신 bolt: 대관통 마법 볼트 — 붓에서 뻗는 한 줄기 */
  ran: { s1: "bolt", s2: "blink", s3: "timewarp", s4: "manaburst" },

  /* 윤지 — 스핀차크람(회전시켜 던져 베고 되돌아옴) / 꽃의축제(꽃잎 속박)
   *   → bladestorm: 전방 다연발 투척 + 회수 (차크람의 왕복과 일치) */
  yunji: { s1: "bladestorm", s2: "windslash", s3: "cyclone", s4: "skystorm" },

  /* 스칼렛과 대비되는 lilac — 별빛의 계승자(펜던트)
   *   → purify: 별빛 파동 확산 (빛 계열 회복·정화) */
  lilac: { s1: "purify", s2: "blink", s3: "sanctuary", s4: "judgment" },
};

/** 인물 활성 시 사용할 스킬 종류 조회 */
export function heroSkillKinds(key?: HeroKey | null): HeroSkillKinds | null {
  if (!key) return null;
  return HERO_SKILL_KINDS[key] ?? null;
}
