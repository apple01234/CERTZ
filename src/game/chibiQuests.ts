/**
 * 씹덕 NPC 미니 퀘스트 라인 — vc204 (지시서 #7)
 *
 * 유저 지적: "씹덕 캐릭터들 대사만 있고 퀘스트나 상호작용 안됨"
 *
 * 종전 상태
 *   `WorldScene.CHIBI_LINES` 에 **한 줄 대사**뿐이었다. `kind: "chibi"` 로
 *   interactables 에 등록돼 E키 대화는 되지만, 대화가 끝나면 아무 일도 없었다.
 *   미니맵 NPC 점 대상에서도 빠져 있었다.
 *
 * 이 모듈이 하는 일
 *   6명 각각에 **3단계 미니 퀘스트 라인**(수주 → 진행 → 보상)을 정의한다.
 *   유형은 기존 시스템이 지원하는 `hunt / collect / talk / reach` 만 쓴다(새 UI 없음).
 *   보상은 지역 레벨대에 맞춰 골드/에메랄드/소모품으로 준다.
 *
 * 진행도 저장
 *   스테이지 퀘스트(`questIdx`)와 **분리**된 `SaveData.chibiQuests` 를 쓴다.
 *   마을당 1명 배치 규칙(vc178) 때문에 NPC가 매 마을 달라도, 각자의 라인은
 *   독립적으로 진행되며 어느 마을에서 만나든 이어서 진행된다.
 *
 * 세계관 연결
 *   6명의 라인은 "세계수의 뿌리가 흔들린다"는 하나의 줄기를 각자 다른 각도에서
 *   본다(안내원=소문, 학자=기록, 마법사=실험, 상인=물건, 마녀=저주, 요정=빛).
 *   마지막 단계 보상 대사가 서로를 언급해 "같은 이야기"라는 느낌을 만든다.
 */
import type { QuestDef } from "./stages";

/** 퀘스트 한 단계 — 기존 QuestDef 를 그대로 쓴다 */
export type ChibiStep = QuestDef & {
  /** 이 단계를 수락할 때 나오는 대사 (기존 대화 시스템 재사용) */
  intro: string[];
  /** 완료 보고 대사 */
  done: string[];
};

export type ChibiQuestLine = {
  /** NPC 텍스처 키 (npc_guide_lily 등) */
  key: string;
  /** 표시 이름 */
  name: string;
  /** 성격 한 줄 — 대사 톤의 근거 */
  persona: string;
  /** 3단계 */
  steps: ChibiStep[];
};

/* 보상 기준: 마을/초반 지역 레벨대(Lv 1~20) 기준.
 *  expReward 는 QUEST_EXP_MUL(×12) 이 지급 시점에 곱해진다. */
export const CHIBI_LINES: ChibiQuestLine[] = [
  {
    key: "npc_guide_lily",
    name: "안내원 리리",
    persona: "밝고 말이 많다. 마을 소문을 다 알고 있다.",
    steps: [
      {
        id: "chibi_lily_1", type: "talk", title: "리리의 첫 심부름",
        desc: "마을 사람들에게 세계수의 뿌리 이야기를 물어보자.",
        need: 3, targetLabel: "마을 NPC와 대화",
        reward: 120, expReward: 90,
        intro: [
          "『여기가 시작 마을이야! 길 잃으면 나한테 물어봐.』",
          "『…근데 요즘 이상한 소문이 돌아. 세계수의 뿌리가 흔들린대.』",
          "『내가 직접 확인하러 가면 좋겠지만, 안내소를 비울 수가 없어.』",
          "『대신 마을 사람들한테 물어봐 줄래? 세 명만. 나 대신!』",
        ],
        done: [
          "『다들 같은 얘기를 했지? 뿌리가 흔들린다는 거.』",
          "『역시 소문만은 아니었어… 고마워, 이건 내 성의야.』",
        ],
      },
      {
        id: "chibi_lily_2", type: "hunt", title: "길을 막는 것들",
        desc: "마을 밖 얕은 숲에서 몬스터를 정리해 길을 확보하자.",
        need: 8, targetLabel: "숲 몬스터 처치",
        reward: 260, expReward: 150,
        intro: [
          "『소문 확인했으니 이제 사람들이 나가볼 수 있게 해야지!』",
          "『숲 입구에 요즘 것들이 자주 내려와. 길이 막혔어.』",
          "『여덟 마리만 정리해줘. 그러면 장사꾼들도 움직일 거야.』",
        ],
        done: [
          "『길이 뚫렸어! 이제 미오 언니도 유적 조사하러 갈 수 있겠다.』",
        ],
      },
      {
        id: "chibi_lily_3", type: "reach", title: "뿌리 끝까지",
        desc: "숲 깊은 곳까지 걸어가 뿌리의 흔들림을 직접 확인하자.",
        need: 1, targetLabel: "숲 깊은 곳 도달",
        reward: 480, expReward: 240,
        intro: [
          "『마지막으로 하나만. 내가 못 가는 곳을 대신 봐줘.』",
          "『숲 제일 깊은 데. 거기서 뿌리가 보인대.』",
          "『무리하지 말고, 보이면 돌아와. 약속해.』",
        ],
        done: [
          "『…정말 흔들리고 있었구나. 학자 미오가 이 기록을 좋아할 거야.』",
          "『고마워. 이제 나도 사람들한테 당당히 말할 수 있어.』",
        ],
      },
    ],
  },
  {
    key: "npc_scholar_mio",
    name: "학자 미오",
    persona: "차분하고 기록을 신뢰한다. 감정 표현이 적다.",
    steps: [
      {
        id: "chibi_mio_1", type: "collect", title: "미오의 표본",
        desc: "흔들리는 뿌리에서 떨어진 파편을 모아 오자.",
        need: 5, targetLabel: "파편 수집",
        reward: 130, expReward: 100,
        intro: [
          "『기록에 따르면 이 아래에 고대 유적이 있었어. …지금은 없지만.』",
          "『유적은 없어도 파편은 남아. 기록과 현재를 대조할 수 있지.』",
          "『다섯 조각만. 형태가 서로 다르면 더 좋아.』",
        ],
        done: [
          "『…이건 기록에 없는 형태야. 기존 연대기가 틀렸어.』",
          "『새로 써야겠어. 고마워, 좋은 표본이었어.』",
        ],
      },
      {
        id: "chibi_mio_2", type: "talk", title: "증언 수집",
        desc: "마을 사람들의 기억을 기록으로 남기자.",
        need: 4, targetLabel: "증언 청취",
        reward: 240, expReward: 160,
        intro: [
          "『문서만으로는 부족해. 사람이 기억하는 것을 들어야 해.』",
          "『네 명. 네가 직접 물어봐 줘. 나는 낯가림이 심해서.』",
        ],
        done: [
          "『증언이 문서와 어긋나는 지점이 셋. 이게 핵심이야.』",
        ],
      },
      {
        id: "chibi_mio_3", type: "hunt", title: "기록을 지키는 자",
        desc: "유적을 지키는 존재를 물리쳐 기록을 확보하자.",
        need: 12, targetLabel: "유적 수호자 처치",
        reward: 520, expReward: 260,
        intro: [
          "『유적엔 아직 수호자가 있어. 기록을 지키는 거지.』",
          "『안타깝지만 싸워야 해. 열둘. …미안, 내가 약해서.』",
        ],
        done: [
          "『확보했어. 이 기록엔 뿌리의 진짜 이름이 적혀 있어.』",
          "『마법사 린에게 보여줘야겠어. 그녀가 읽을 수 있을 거야.』",
        ],
      },
    ],
  },
  {
    key: "npc_mage_rin",
    name: "마법사 린",
    persona: "실험이 우선. 사과를 잘 못 한다.",
    steps: [
      {
        id: "chibi_rin_1", type: "collect", title: "린의 재료",
        desc: "실험에 쓸 결정 조각을 모아 오자.",
        need: 6, targetLabel: "결정 조각 수집",
        reward: 140, expReward: 110,
        intro: [
          "『실험 중이니까 조심해. 방금도 눈썹이 조금 탔어.』",
          "『…뭐, 마침 잘 왔어. 재료가 부족했거든.』",
          "『여섯 개. 결정 조각. 밝은 게 좋아.』",
        ],
        done: [
          "『좋아, 이 정도면 돌아가. …고마워. 방금 거, 일부러 그런 거 아니야.』",
        ],
      },
      {
        id: "chibi_rin_2", type: "hunt", title: "폭주 진정",
        desc: "실험체가 폭주했다. 진정시켜야 한다.",
        need: 10, targetLabel: "폭주 실험체 진정",
        reward: 280, expReward: 170,
        intro: [
          "『…실수했어. 실험체가 폭주했어.』",
          "『내가 처리하려 했는데, 손이 부족해. 열 마리.』",
          "『부탁해. 이번엔 진짜로.』",
        ],
        done: [
          "『됐어. …네가 없었으면 마을 절반이 날아갔을 거야.』",
          "『이건 실패가 아니야. 데이터야. 데이터.』",
        ],
      },
      {
        id: "chibi_rin_3", type: "reach", title: "뿌리의 좌표",
        desc: "미오의 기록이 가리키는 좌표로 가서 뿌리를 관측하자.",
        need: 1, targetLabel: "관측 지점 도달",
        reward: 560, expReward: 280,
        intro: [
          "『미오가 준 기록, 해독했어. 좌표가 나왔어.』",
          "『내가 가면 또 뭔가 터질 테니까, 네가 가줘.』",
          "『도착하면 뿌리가 보일 거야. …조심해. 진짜로.』",
        ],
        done: [
          "『관측 데이터 받았어. 이건… 마법진이 아니야. 구조물이야.』",
          "『마녀 닉스가 알지도 몰라. 그쪽 계열은 나도 잘 몰라.』",
        ],
      },
    ],
  },
  {
    key: "npc_merchant_nyan",
    name: "상인 냥",
    persona: "값을 먼저 생각한다. 정은 있다.",
    steps: [
      {
        id: "chibi_nyan_1", type: "collect", title: "냥의 장사밑천",
        desc: "팔 물건을 모아 오자.",
        need: 8, targetLabel: "잡화 수집",
        reward: 150, expReward: 80,
        intro: [
          "『좋은 물건 있어! …값은 물어보고 결정해.』",
          "『근데 요즘 물건이 안 들어와. 길이 막혀서.』",
          "『여덟 개만 모아줘. 값은 쳐줄게.』",
        ],
        done: [
          "『이거면 한동안은 팔 수 있겠어. …수고비야. 안 깎아.』",
        ],
      },
      {
        id: "chibi_nyan_2", type: "talk", title: "단골 소문",
        desc: "단골들의 이야기를 들으면 물건이 들어온다.",
        need: 3, targetLabel: "단골 소문 청취",
        reward: 260, expReward: 130,
        intro: [
          "『장사는 정보야. 정보가 곧 물건이지.』",
          "『세 명만. 단골들한테 어디서 물건 들어오는지 물어봐.』",
        ],
        done: [
          "『남쪽 항구?! 그럼 오늘 밤에 들어오겠네.』",
          "『너 장사 감각 있어. …진짜야.』",
        ],
      },
      {
        id: "chibi_nyan_3", type: "hunt", title: "짐을 지키는 일",
        desc: "물건을 실은 길이 습격당했다. 지켜야 한다.",
        need: 14, targetLabel: "습격자 격퇴",
        reward: 540, expReward: 250,
        intro: [
          "『큰일이야. 물건 실은 길이 습격당했어.』",
          "『이건 내 전 재산이야. 열넷만. 제발.』",
        ],
        done: [
          "『살았다… 정말 살았어.』",
          "『이건 값이 아니야. 빚이야. 언젠가 갚을게.』",
        ],
      },
    ],
  },
  {
    key: "npc_witch_nyx",
    name: "마녀 닉스",
    persona: "퉁명스럽다. 저주는 안 한다.",
    steps: [
      {
        id: "chibi_nyx_1", type: "collect", title: "닉스의 재료",
        desc: "저주가 아니라 약에 쓸 재료를 모아 오자.",
        need: 7, targetLabel: "약초 수집",
        reward: 140, expReward: 100,
        intro: [
          "『저주? 아니야. 그냥 내 성격이 그래.』",
          "『…약 만드는데 재료가 없어. 일곱 개.』",
          "『고맙다는 말은 안 해. 대신 값을 쳐.』",
        ],
        done: [
          "『…이 정도면 되겠어. 받아. 두 번 말하게 하지 마.』",
        ],
      },
      {
        id: "chibi_nyx_2", type: "hunt", title: "치료할 것들",
        desc: "약이 필요한 이들을 공격하는 것들을 쫓아내자.",
        need: 11, targetLabel: "습격자 격퇴",
        reward: 300, expReward: 180,
        intro: [
          "『숲에 아픈 것들한테 달려드는 게 있어.』",
          "『내가 나가면 다들 도망가니까, 네가 가.』",
          "『열하나. 세지 마. 그냥 해.』",
        ],
        done: [
          "『됐어. 이제 약을 줄 수 있어. …네 덕이야.』",
        ],
      },
      {
        id: "chibi_nyx_3", type: "reach", title: "저주받은 자리",
        desc: "아무도 가지 않는 자리에 가서 확인하자.",
        need: 1, targetLabel: "저주받은 자리 도달",
        reward: 580, expReward: 290,
        intro: [
          "『아무도 안 가는 데가 있어. 나도 안 갔어.』",
          "『요정 아리아가 자꾸 거기서 빛이 보인대.』",
          "『가서 봐줘. 내가 겁이 많은 건 비밀이야.』",
        ],
        done: [
          "『…그래. 진짜였어. 저건 저주가 아니야. 문이야.』",
          "『아리아한테 말해. 조용히.』",
        ],
      },
    ],
  },
  {
    key: "npc_fairy_aria",
    name: "요정 아리아",
    persona: "호기심이 많다. 위험을 모른다.",
    steps: [
      {
        id: "chibi_aria_1", type: "collect", title: "반짝이는 것들",
        desc: "아리아가 좋아하는 반짝이는 조각을 모으자.",
        need: 6, targetLabel: "빛나는 조각 수집",
        reward: 130, expReward: 100,
        intro: [
          "『반짝이는 거 보여? 이게 진짜 빛이야.』",
          "『더 모아줄래? 여섯 개! 나는 못 만져.』",
          "『요정은 반짝임을 만지면 사라져. 진짜야.』",
        ],
        done: [
          "『와아, 진짜 예뻐! 너 최고야!』",
        ],
      },
      {
        id: "chibi_aria_2", type: "talk", title: "빛이 들려주는 말",
        desc: "빛에 대해 아는 이들을 만나보자.",
        need: 3, targetLabel: "빛에 대한 이야기 청취",
        reward: 250, expReward: 140,
        intro: [
          "『빛이 말을 해. 나만 들려.』",
          "『근데 내 말을 아무도 안 믿어.』",
          "『세 명만 만나봐. 그럼 네가 들어줄 수 있지?』",
        ],
        done: [
          "『들었지? 다들 조금씩은 느끼고 있었어!』",
        ],
      },
      {
        id: "chibi_aria_3", type: "boss", title: "빛의 문을 지키는 것",
        desc: "문 앞을 막은 존재를 물리쳐야 빛이 돌아온다.",
        need: 1, targetLabel: "문지기 격파",
        reward: 620, expReward: 320,
        intro: [
          "『문 앞에 무서운 게 있어. 빛이 거기서 막혀.』",
          "『나 혼자는 무서워. 같이 가줄래?』",
          "『…아니, 네가 가. 나는 여기서 기다릴게. 응원할게!』",
        ],
        done: [
          "『빛이 돌아왔어! 이제 마녀 닉스도, 학자 미오도 볼 수 있겠다!』",
          "『고마워. 네가 없었으면 빛은 계속 갇혀 있었을 거야.』",
        ],
      },
    ],
  },
];

/** 텍스처 키로 라인 찾기 */
export function lineByKey(key: string): ChibiQuestLine | undefined {
  return CHIBI_LINES.find((l) => l.key === key);
}

/** 전체 퀘스트 id → 단계 메타 (진행 판정용) */
export const CHIBI_BY_ID: Record<string, { line: ChibiQuestLine; stepIdx: number; step: ChibiStep }> =
  (() => {
    const m: Record<string, { line: ChibiQuestLine; stepIdx: number; step: ChibiStep }> = {};
    for (const line of CHIBI_LINES) {
      line.steps.forEach((step, i) => {
        m[step.id] = { line, stepIdx: i, step };
      });
    }
    return m;
  })();

/** 저장 구조 — NPC 키별로 { 완료 단계 수, 현재 단계 진행도, 수주한 단계 id } */
export type ChibiSave = Record<string, { done: number; prog: number; active: string | null }>;
