"use client";

import { useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { getPlayerName } from "@/game/config";
import { BOSS_DEFS } from "@/game/data";
import { BOSS_ATLAS } from "@/game/textures"; // v1.4.31 — 보스 아틀라스 초상화 분기
import * as audio from "@/game/audio"; // v1.4.8 — 대화 진행 클릭음
import portraitCrops from "../../../public/assets/npcportrait/_map.json";

/**
 * 대화창: 타이프라이터 + 스페이스/엔터·탭으로 진행, 마지막 줄 완료 시 게임 재개.
 * v2.0 (사용자 지시 #3): 스페이스바/클릭을 꾹 누르면 대화가 계속 빠르게 넘어간다.
 * v3.0.24 (#초상화): 대사창 왼쪽 끝에 화자 초상화 배치 — 흔한 RPG의 클래식한 대화 UI.
 *  게임 내 실제 스프라이트(NPC/보스/펫/주인공)를 픽셀 확대해 초상화로 사용 — 아트 스타일 일관성.
 */

/** 화자 → 초상화 스프라이트 매핑 (public/assets/<키>.webp)
 *  v4.1.8 — 무료 플레이스홀더 npc_* 초상화 → 유료 SPUM 캐릭터 전면 교체 +
 *  챕터 마을 주민 17종 초상화 신설 (게임 내 NPC와 동일한 SPUM 스프라이트) */
const NPC_PORTRAITS: Record<string, { tex: string; tone: string }> = {
  "연합 안내인": { tex: "pet_pixie", tone: "#67e8f9" }, // 시안 — 룬 정령
  "여관 주인 로안": { tex: "spum_mage", tone: "#fcd34d" },
  "마을 주민": { tex: "spum_villager_m", tone: "#fcd34d" },
  "마을 아이": { tex: "spum_villager_f", tone: "#fcd34d" },
  "호족 소녀 엘렌": { tex: "spum_villager_f", tone: "#fcd34d" },
  "상인 라고스": { tex: "npc_merchant", tone: "#fcd34d" },
  "직업 교관 카이엔": { tex: "spum_knight", tone: "#fbbf24" },
  "쿠소디아 기사단장": { tex: "spum_knight", tone: "#fbbf24" },
  "라이언 드 쿠소디아 국왕": { tex: "spum_knight", tone: "#fbbf24" },
  "알프헤임의 여왕 요정": { tex: "spum_elf", tone: "#a7f3d0" },
  "땅의 요정 여왕": { tex: "spum_elf", tone: "#a7f3d0" },
  "난쟁이 광산 조합장": { tex: "spum_miner", tone: "#fcd34d" },
  "마법사 흐레스": { tex: "npc_gm", tone: "#c4b5fd" },
  "연합 기록관": { tex: "tree", tone: "#7dd3fc" },
  // v4.1.8 — 챕터 마을 주민 (게임 내 SPUM NPC와 동일 비주얼)
  "허브 채집가 베르": { tex: "spum_forager", tone: "#b8f0a0" },
  "신전 관리인 노아": { tex: "spum_mage", tone: "#b8f0a0" },
  "선원 롤프": { tex: "spum_villager_m", tone: "#ffe9b0" },
  "늪지 어부 팰": { tex: "spum_fisher", tone: "#ffe9b0" },
  "요정 사절 리안": { tex: "spum_elf", tone: "#d8c8ff" },
  "성전 견습 기사": { tex: "spum_knight", tone: "#d8c8ff" },
  "대장장이 브라키": { tex: "spum_smith", tone: "#ffb080" },
  "용암 광부 코일": { tex: "spum_miner", tone: "#ffb080" },
  "얼음 낚시꾼 시그룬": { tex: "spum_villager_f", tone: "#a8e0ff" },
  "눈보라 정찰병": { tex: "spum_scout", tone: "#a8e0ff" },
  "수정 채굴자 그밀": { tex: "spum_mystic", tone: "#c9a0ff" },
  "어둠 요정 피난민": { tex: "spum_devil", tone: "#c9a0ff" },
  "룬 대장장이 두린": { tex: "spum_smith", tone: "#ffd76a" },
  "광산 감독관": { tex: "spum_knight", tone: "#ffd76a" },
  "전쟁 유령 아르벨": { tex: "spum_skel", tone: "#d0a8ff" },
  "저택 집사 무르": { tex: "spum_butler", tone: "#d0a8ff" },
  "폐허 학자 테일": { tex: "spum_mage", tone: "#b09aff" },
  "마지막 항해사": { tex: "spum_fisher", tone: "#b09aff" },
  "종언의 마룡 아부디토스": { tex: "boss_abudditos_idle0", tone: "#fda4af" }, // v1.4.31 — 구형 프레임 경로 유지 (아부디토스는 미아틀라스)
  "{name}": { tex: "hero_idle0", tone: "#86efac" }, // 플레이어
  // v1.0.2 (#초상화) — 매핑 누락 화자 보강 (가름은 bossPortrait 토큰 매칭으로도 자동 해결, 여기선 명시 우선)
  "헬의 문지기 가름": { tex: "boss_gram_idle0", tone: "#8affc0" }, // 구형 프레임 경로 (가름은 미아틀라스)
  "전사 계열의 시조 '강철의 마르테'": { tex: "spum_knight", tone: "#fbbf24" },
  "궁수 계열의 시조 '바람의 세이렌'": { tex: "spum_elf", tone: "#a7f3d0" },
  "마법사 계열의 시조 '만개한 세이렌'": { tex: "spum_mage", tone: "#c4b5fd" },
  "도적 계열의 시조 '그림자의 로크'": { tex: "spum_devil", tone: "#94a3b8" },
};

/** 보스 대사 — BOSS_DEFS의 보스 이름과 일치하면 해당 보스 스프라이트 사용
 *  v3.0.25 (#이미지 안불러와짐) — 보스 텍스처는 idle 프레임 분할 파일(boss_*_idle0.png)이므로
 *  기본명(boss_nidhog.png 등)은 404 → 전원 이미지가 깨졌다. 첫 idle 프레임을 초상화로 사용 */
function bossPortrait(speaker: string): { tex: string; tone: string } | null {
  /* v1.0.2 (#초상화) — 토큰 매칭 추가: "헬의 문지기 가름"처럼 수식어가 다른 화자도
   *  마지막 고유명사(가름) 일치로 보스 스프라이트 자동 매핑 (speakerId 자동 매핑)
   * v1.4.31 (#4) — bossPortraitUrl(): 아틀라스 보스는 전용 초상화(bossport_*.webp),
   *  구형은 idle0 프레임 — tex 키에 확장자/경로 없는 순수 키를 반환한다 */
  const tok = (speaker.replace(/[‘’'"』]/g, "").split(/\s+/).pop() ?? "").trim();
  for (const def of Object.values(BOSS_DEFS)) {
    if (def.name === speaker) return { tex: bossPortraitKey(def.tex), tone: "#fda4af" };
    if (tok.length >= 2 && def.name.endsWith(tok)) return { tex: bossPortraitKey(def.tex), tone: "#fda4af" };
  }
  return null;
}

/** 초상화 키 — 아틀라스 보스는 bossport_ 접두사 전용 파일, 구형은 idle0 프레임 */
function bossPortraitKey(tex: string): string {
  return BOSS_ATLAS[tex] ? `bossport_${tex}` : `${tex}_idle0`;
}

function portraitOf(speaker: string, portraitId?: string): { tex: string; tone: string } | null {
  /* v1.0.2 (#초상화) — portraitId 명시 > 화자명 직접 매핑 > 보스 토큰 자동 매칭 순 */
  if (portraitId) {
    if (NPC_PORTRAITS[portraitId]) return NPC_PORTRAITS[portraitId];
    /* [vc260] portraitId 가 `_map.json` 의 키일 수 있다(AI 생성 초상화) */
    const byId = portraitCrops[portraitId];
    if (byId?.src) return { tex: portraitId, tone: "#c9b3ff" };
    return { tex: portraitId, tone: "#e2e8f0" };
  }
  /* [vc260 — 지시 "NPC들이 너무 서양 그림체"] AI 생성 초상화를 **1순위**로 둔다.
   *  종전 순서는 NPC_PORTRAITS(하드코딩 표) → bossPortrait 였고, 표에는 spum_* 스프라이트가
   *  들어 있어 그것들이 서양풍 지적의 원인이었다. `_map.json` 은 생성 파이프라인이 자동
   *  갱신하므로 1순위로 두면 매핑 누락과 서양풍 스프라이트가 동시에 해결된다.
   *  생성 초상화가 없을 때만 표/보스로 폴백한다. */
  const gen = portraitCrops[speaker];
  if (gen?.src && String(gen.src).includes("/npc_")) return { tex: speaker, tone: "#c9b3ff" };
  if (NPC_PORTRAITS[speaker]) return NPC_PORTRAITS[speaker];
  return bossPortrait(speaker);
}

/** 현재 월드의 npcbody/SPUM 원본을 그대로 crop한 파일만 사용한다.
 * 기존 npcface 절차 생성 얼굴은 더 이상 참조하지 않는다. 라고스는 현재 외형 보존일 뿐 확정 디자인이 아니다.
 *
 * [vc260] AI 생성 초상화(`npc_*.png`)는 **이미 84×84 얼굴 크롭**이라 그대로 쓰면 된다.
 *  종전엔 이 함수가 `_map.json` 의 `src` 를 반환했지만, `portraitOf` 가 화자명을 tex 로
 *  주면서 `_map.json` 키와 일치하지 않는 경우가 있어(예: "아리" vs "npc_ari") 매칭이 깨졌다.
 *  여기서 `npc_<key>` 형태를 직접 조회해 경로를 확정한다. */
function faceFor(tex: string): string | null {
  const crops: Record<string, { src: string }> = portraitCrops;
  const direct = crops[tex]?.src;
  if (direct && String(direct).includes("/npc_")) return direct;
  /* 화자명이 그대로 키인 경우 (mapped_as 로 등록된 별칭) */
  const byAlias = crops[tex];
  return byAlias?.src ?? direct ?? null;
}

/** 기존 대사 데이터 호환 타입. 원본 crop에 없는 표정은 합성하지 않는다. */
export type FaceExpr = "neutral" | "happy" | "angry";

/** 대사 문장에서 표정을 추론한다.
 *
 *  왜 자동 추론인가: 대사 데이터(`showDialogueRaw`)가 수백 곳에 흩어져 있어
 *  전부에 `expr` 를 손으로 붙이면 누락이 생긴다. 문장 부호·어휘는 감정의
 *  강한 신호라 규칙으로 충분히 잡힌다. 명시 지정(`expr`)이 있으면 그쪽이 이긴다.
 *
 *  규칙 순서(먼저 맞는 것 채택): 화남 → 기쁨 → 중립 */
export function inferExpr(line: string, speakerLike = ""): FaceExpr {
  const t = `${speakerLike} ${line}`;
  // 화남/위협 — 느낌표 반복, 강한 부정 어휘, 전투 고지
  if (/[!！]{2,}|크윽|젠장|빌어먹|죽어|죽인|닥쳐|꺼져|분노|격노|전투|습격|배신|경고|위험|덤벼|각오/.test(t)) return "angry";
  // 기쁨/환영 — 웃음, 감사, 환영, 칭찬
  if (/[ㅎ하]{2,}|웃|반가|환영|고맙|감사|축하|좋은|멋지|훌륭|기쁘|행복|어서 오|다행|잘했|사랑/.test(t)) return "happy";
  // 물음표만 있는 경우는 중립(놀람·의문은 별도 표정이 없다)
  return "neutral";
}

export function DialogueBox({
  dialogue,
}: {
  /** vc211 (#표정연동) — `expr` 를 명시하면 그 표정을, 없으면 문장에서 추론한다.
   *  `exprByLine` 은 줄마다 다른 표정이 필요할 때 쓴다(인덱스 우선). */
  dialogue: {
    speaker: string;
    lines: string[];
    choices?: { label: string; id: string }[];
    expr?: FaceExpr;
    exprByLine?: FaceExpr[];
  } | null;
}) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState("");
  /* vc272 — 선택지 키보드 강조 인덱스 (↑/↓ 이동, Enter/Space 확정) */
  const [choiceIdx, setChoiceIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const lastAdvance = useRef(0);

  const name = getPlayerName();
  // {name} 치환 — 플레이어가 지은 이름이 대사에 반영됨
  const line = (dialogue?.lines[idx] ?? "").replaceAll("{name}", name);
  const speakerName = (dialogue?.speaker ?? "").replaceAll("{name}", name);
  const portrait = dialogue ? portraitOf(dialogue.speaker ?? "", (dialogue as { portrait?: string }).portrait) : null;
  // 원본에 없는 표정을 그려 넣지 않는다. 현재 월드와 같은 픽셀 crop만 사용한다.
  const croppedFace = portrait ? faceFor(portrait.tex) : null;
  const portraitSrc = croppedFace ?? (portrait ? `/assets/${portrait.tex}.webp` : "");
  /* v3.0.25 (#이미지 안불러와짐) — 초상화 로드 상태 추적: 404 등 실패 시 깨진 이미지 대신
   *  프레임만 표시하고, 로드 완료 시에야 이미지를 보여준다 (깜빡임·깨짐 제거) */
  const [portraitOk, setPortraitOk] = useState(true);
  useEffect(() => {
    setPortraitOk(true);
  }, [portrait?.tex]);

  useEffect(() => {
    setIdx(0);
  }, [dialogue]);

  useEffect(() => {
    if (!dialogue) return;
    setShown("");
    let i = 0;
    timer.current = window.setInterval(() => {
      i++;
      setShown(line.slice(0, i));
      if (i >= line.length && timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, 22);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [line, dialogue]);

  // 언마운트/대화 종료 시 홀드 타이머 정리
  useEffect(() => {
    return () => {
      if (holdTimer.current) window.clearInterval(holdTimer.current);
      holdTimer.current = null;
    };
  }, [dialogue]);

  const advance = () => {
    if (shown.length < line.length) {
      // 타이핑 스킵
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      setShown(line);
      return;
    }
    if (dialogue && idx < dialogue.lines.length - 1) {
      audio.sfx.uiClick(); // v1.4.8 — 줄 넘김 피드백음 (타이핑 스킵에는 무음)
      setIdx(idx + 1);
    } else {
      EventBus.emit("dialogue:done");
    }
  };

  /* ══ vc263c (버그 #7) — 상호작용 키가 대사창을 즉시 넘기던 버그 ══
   *
   * [증상] NPC/채집 키(Space)를 누르면 대사가 뜨자마자 사라지거나 첫 줄이 통째로
   *        스킵된다. 사냥 중 Space 로 NPC 말을 걸면 "대사 스킵"으로 체감된다.
   *
   * [원인] 같은 물리 키다운 한 번이 두 컴포넌트에 동시에 전달된다:
   *          ① Phaser WorldScene.update → JustDown(interact) → tryInteract() → 대사창 open
   *          ② window keydown(DialogueBox) → advance() → 타이핑 즉시 완료/다음 줄
   *        ②는 ①과 **같은 키 이벤트**인데, DialogueBox 가 그 사실을 알 방법이 없어
   *        열리자마자 입력을 소비했다. (advanceThrottled 의 130ms 스로틀은 마우스 홀드
   *        전용이라 키 경로엔 적용되지 않았고, 첫 호출은 항상 통과했다)
   *
   * [해결] 대사창이 열린 시각을 기록하고, 그로부터 OPEN_GUARD_MS 안에 들어온 키다운은
   *        "대사를 연 그 입력"으로 간주해 무시한다. 이후 입력은 정상 진행된다.
   *        (가드가 없으면 1프레임 만에 스킵되고, 있으면 사람이 인지할 수 있는 최소 시간 뒤
   *         의도적으로 넘길 수 있다. 250ms 는 오탐 없이 체감상 즉시로 느껴지는 값) */
  const OPEN_GUARD_MS = 250;
  const openedAt = useRef(0);
  useEffect(() => {
    if (dialogue) openedAt.current = performance.now();
  }, [dialogue]);

  /** 홀드 고속 진행 — 반복 키 입력/홀드 타이머가 일정 간격으로 advance 호출 */
  const advanceThrottled = () => {
    const now = performance.now();
    if (now - lastAdvance.current < 130) return;
    lastAdvance.current = now;
    advance();
  };

  /** 키/클릭 입력이 "대사를 연 그 입력"인지 판별 — 열림 직후 가드 */
  const guardedAdvance = () => {
    if (performance.now() - openedAt.current < OPEN_GUARD_MS) return;
    advanceRef.current();
  };

  /* v1.1.1 (#1 대사 홀드) — 홀드 인터벌 stale closure 수정.
   *  setInterval이 pointerdown 시점 렌더의 advance를 영구 캡처해 첫 스텝(타이핑 스킵) 후
   *  stale shown/idx로 같은 setState만 반복 → React bail-out으로 영구 정지.
   *  "꾹 누르면 빠르게"가 실제로는 한 줄에서 멈추는 버그로, 긴 마을 오프닝 대사를
   *  못 넘겨 튜토리얼 진입이 막히는 2차 피해까지 발생. 최신 advance를 ref로 우회 */
  const advanceRef = useRef<() => void>(() => {});
  useEffect(() => {
    advanceRef.current = advance;
  });

  // PC: 스페이스바/엔터로 대화 넘기기 — 꾹 누르면 계속 빠르게 (e.repeat 활용)
  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        /* vc263c (버그 #7) — 대사를 연 그 키다운은 advance 하지 않는다.
         *  (열림 직후 250ms 가드 — 위 OPEN_GUARD_MS 주석 참조) */
        guardedAdvance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 모바일: 화면 홀드 — 누르는 동안 고속 진행
  const startHold = (e: React.PointerEvent) => {
    /* vc264 (지시 #4) — 선택지가 떠 있으면 홀드 진행을 하지 않는다.
     *
     * [증상] NPC 퀘스트 선택지("[수주] …" / "나중에")를 누르면 수락이 아니라
     *        대화가 닫혀 **취소**된 것처럼 동작했다.
     * [원인] 선택지 버튼은 stopPropagation 을 하지만, 그건 **버튼 자신의
     *        onPointerDown** 이다. 홀드 핸들러는 **부모 래퍼**에 달려 있어
     *        같은 pointerdown 이 부모에도 전달되고, advance() 가 마지막 줄에서
     *        dialogue:done 을 먼저 발신해 버린다. 그러면 WorldScene 의 choice
     *        리스너가 dialogue:choice 를 받기 전에 대화가 이미 닫힌다.
     * [해결] 선택지가 보이는 상태에서는 advance 를 시작하지 않는다.
     *        (선택지는 버튼 자신의 핸들러로만 처리된다) */
    if (hasChoices) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    advanceThrottled();
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = window.setInterval(() => advanceRef.current(), 150);
  };
  const stopHold = () => {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
  };

  /* ═══════════════ vc272 — 선택지 방향키 내비게이션 ═══════════════
   *
   * [증상] 선택지가 떠도 ↑/↓ 로 고를 수 없고 마우스/터치로만 선택됐다(요구사항 6.2).
   * [원인] 선택지 버튼에 onPointerDown 만 있고 키보드 핸들러가 아예 없었다.
   * [해결] Panels.tsx 의 useListNav(169-197) 와 **같은 판정 규칙**을 쓴다:
   *   · e.code 기준 — 한글 2벌식 IME 가 켜져 있어도 물리 키로 판정 (e.key 는 "ㄷ" 이 된다)
   *   · 입력 포커스(input/textarea) 중엔 무시
   *   · preventDefault 로 스크롤/게임 입력 차단
   * 게임 이동 잠금은 **기존 `ui:panelKeys` 이벤트**를 재사용한다(새 이벤트를 만들지 않는다).
   * WorldScene 이 이미 이 이벤트로 panelNavOpen 을 세워 이동·공격키를 잠근다.
   *
   * [주의] 훅은 `if (!dialogue) return null` **위**에 있어야 한다(조건부 훅 금지).
   *  그래서 아래 choiceList/hasChoices 파생값도 여기서 먼저 계산하고, 렌더 직전에 쓴다. */
  const choiceList = dialogue?.choices ?? [];
  const hasChoices =
    choiceList.length > 0 &&
    idx >= (dialogue?.lines.length ?? 0) - 1 && shown.length >= line.length;

  const pickChoice = (c: { id: string } | undefined) => {
    if (!c) return;
    audio.sfx.uiClick();
    EventBus.emit("dialogue:choice", { id: c.id });
    EventBus.emit("dialogue:done");
  };

  /* 선택지가 새로 열리면 강조를 첫 항목으로 되돌린다 */
  useEffect(() => {
    if (hasChoices) setChoiceIdx(0);
  }, [hasChoices]);

  /* 선택지가 열린 동안 게임 이동키 잠금 — 기존 이벤트 재사용 */
  useEffect(() => {
    if (!hasChoices) return;
    EventBus.emit("ui:panelKeys", { active: true });
    return () => { EventBus.emit("ui:panelKeys", { active: false }); };
  }, [hasChoices]);

  const choiceRef = useRef<{ list: { label: string; id: string }[]; at: number }>({ list: [], at: 0 });
  useEffect(() => { choiceRef.current = { list: choiceList, at: choiceIdx }; });

  useEffect(() => {
    if (!hasChoices) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const n = choiceRef.current.list.length;
      if (n <= 0) return;
      if (e.code === "ArrowDown") {
        e.preventDefault();
        setChoiceIdx((i) => (i + 1) % n);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setChoiceIdx((i) => (i - 1 + n) % n);
      } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        /* 대사를 연 그 키다운이 선택까지 확정하지 않게 열림 직후는 무시 (advance 와 같은 가드) */
        if (performance.now() - openedAt.current < OPEN_GUARD_MS) return;
        e.preventDefault();
        pickChoice(choiceRef.current.list[choiceRef.current.at]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasChoices]);

  if (!dialogue) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 sm:px-6 sm:pb-6"
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
    >
      {/* v1.0.20 — 대화창: 게임형 프레임 (우드 프레임 + 금 스피커 네임플레이트)
       *  vc250 (지시 #5) — 패딩을 좌우 비대칭으로 줘 이름표가 프레임에 붙어 보이게 했다(사람이 손본 느낌).
       *  vc270 (버그 #2 "NPC 초상화 크기가 자꾸 바뀜") — vc250 의 self-stretch 를 되돌린다.
       *   stretch 는 초상화 높이를 **행 높이(=대사 줄 수)** 에서 가져와서, 긴 대사일수록 초상화가
       *   커지고 짧으면 작아졌다(sm: 에서 폰트/패딩이 바뀌어 폭까지 변함). 초상화는 고정 크기여야 한다. */}
      <div className="game-panel flex w-full max-w-2xl cursor-pointer touch-none items-stretch gap-2.5 py-2.5 pl-2.5 pr-3 sm:gap-3 sm:py-3.5 sm:pl-3.5 sm:pr-4">
        {/* v3.0.24 — 화자 초상화 (클래식 RPG 대화창 레이아웃: 좌측 초상 프레임) */}
        {portrait && (
          <div
            className="game-chip relative h-14 w-14 shrink-0 self-start overflow-hidden sm:h-20 sm:w-20"
            style={{ borderColor: `${portrait.tone}88` }}
          >
            {/* v3.0.25 (#비율 찌그러짐) — object-cover + object-top: 원본 비율 유지하며
                프레임을 채우고(살짝 크롭 허용), 머리는 상단 고정 — 기존 강제 정사각형 스트레치 제거 */}
            <img
              key={portraitSrc}
              src={portraitSrc}
              alt=""
              draggable={false}
              onLoad={() => setPortraitOk(true)}
              onError={() => setPortraitOk(false)}
              className="h-full w-full object-cover object-top"
              style={{ imageRendering: "pixelated", display: portraitOk ? undefined : "none" }}
            />
            {/* 초상 프레임 하단 음영 — 입체감 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            {/* v3.0.24 — 화자명 옆 초상 톤 마커 (보스/정령/NPC 색 구분) */}
            {portrait && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: portrait.tone, boxShadow: `0 0 6px ${portrait.tone}` }}
              />
            )}
            <span className="game-btn inline-block px-2 py-0.5 text-[11px] font-black sm:text-xs">
              {speakerName}
            </span>
          </div>
          <p className="min-h-[2.6em] text-[13px] leading-relaxed text-[#f5ecd6] sm:min-h-[2.4em] sm:text-[15px]">
            {shown}
            {/* vc250 (지시 #5) — 텍스트 편집기 커서(▌) → 얇은 세로 막대. 두께·색을 낮춰
             *  "입력 중"이 아니라 "말하는 중"으로 읽히게 한다. */}
            {shown.length < line.length && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.12em] bg-[#ffd98a]/70" />
            )}
          </p>
          {/* vc143 (#10) — 선택형 대화: 마지막 줄 완료 시 선택지 버튼 (보스전 퇴장 관리인 등).
           *  클릭 시 dialogue:choice 발신 + dialogue:done으로 종료 — 컨테이너 홀드 진행과 충돌 없게 stopPropagation */}
          {hasChoices && (
            <div className="mt-2 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              {choiceList.map((c, i) => {
                /* vc272 — 키보드 강조와 마우스 호버가 같은 시각 언어를 쓰도록 한 곳에서 계산.
                 *  강조 항목: 금색 테두리 + 밝은 배경 + ▸ 마커 (터치 기기에선 호버가 없으므로
                 *  이 강조가 "지금 어떤 걸 고를 수 있는지"의 유일한 단서가 된다) */
                const sel = i === choiceIdx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-current={sel ? "true" : undefined}
                    className={
                      sel
                        ? "game-btn border-2 border-[#ffd98a] bg-[#5a4515]/90 px-3 py-1.5 text-left text-[12px] font-black text-[#fff3cc] shadow-[0_0_10px_rgba(255,217,138,0.45)] transition-transform active:scale-95 sm:text-[13px]"
                        : "game-btn border-2 border-transparent px-3 py-1.5 text-left text-[12px] font-black text-[#ffe9b0]/70 transition-transform active:scale-95 sm:text-[13px]"
                    }
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setChoiceIdx(i);
                      pickChoice(c);
                    }}
                  >
                    {sel ? "▸ " : "\u2003"}
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-1.5 flex items-end justify-between gap-2">
            {/* vc250 (지시 #5) — "AI 티 나지 않게".
             *  종전엔 "스페이스·탭으로 건너뛰기 (꾹 누르면 빠르게)" 같은 **조작 설명문**이
             *  매 줄마다 깔려 있었다. 이게 AI 생성 UI 특유의 티를 만든다:
             *   ① 사람이 쓴 게임은 조작법을 문장으로 설명하지 않는다(이미 아는 것을 반복)
             *   ② 문장 길이가 줄마다 달라져 하단 정렬이 흔들린다
             *   ③ 게임 세계관 텍스트 옆에 UI 메타 설명이 붙어 몰입이 끊긴다
             *  → 게임 문법인 **깜빡이는 진행 화살표**로 바꾼다. 키 힌트는 첫 줄에서 한 번만,
             *    그마저도 아이콘 없이 짧게(모바일은 탭, PC는 Space) 표기한다. */}
            <span className="text-[10px] font-bold text-white/25 sm:text-[11px]">
              {idx === 0 && shown.length >= line.length ? "Space / 탭" : ""}
            </span>
            {shown.length >= line.length && (
              <span
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-[#ffd98a] sm:text-xs"
                style={{ animation: "dialogueNudge 1.1s ease-in-out infinite" }}
                aria-hidden="true"
              >
                {/* 마지막 줄이면 닫기(×), 아니면 계속(▸) — 문장 대신 기호로 의도를 전달 */}
                {idx < dialogue.lines.length - 1 ? "▸" : "✕"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
