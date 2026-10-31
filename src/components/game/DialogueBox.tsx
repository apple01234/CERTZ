"use client";

import { useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { getPlayerName } from "@/game/config";
import { BOSS_DEFS } from "@/game/data";
import { BOSS_ATLAS } from "@/game/textures"; // v1.4.31 — 보스 아틀라스 초상화 분기
import * as audio from "@/game/audio"; // v1.4.8 — 대화 진행 클릭음

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
  "룬 정령 이그니": { tex: "pet_pixie", tone: "#67e8f9" }, // 시안 — 룬 정령
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
  "세계수 인피니트보석": { tex: "tree", tone: "#7dd3fc" },
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
    return { tex: portraitId, tone: "#e2e8f0" };
  }
  if (NPC_PORTRAITS[speaker]) return NPC_PORTRAITS[speaker];
  return bossPortrait(speaker);
}

/** vc210 (#npc-face) — 대사창 전용 **오리지널** NPC 얼굴.
 *
 *  ⚠️ 왜 필요한가 (실측)
 *    기존 경로는 맵용 `spum_*.webp`(96×96)를 80×80 프레임에 object-cover 로 잘라 쓴다.
 *    원본 얼굴 영역이 3~5px 뿐이라 **눈을 그릴 픽셀이 없다.** 5개를 실측한 결과
 *    4개가 눈 없는 살구색 블록으로 "얼굴 없는 마네킹"이었다(기사는 투구가 얼굴을 100% 가림).
 *
 *  ⚠️ 저작권
 *    `tools/gen_npc_faces.py` 가 **절차 생성**한 SERTZ 자체 에셋이다(32×32 → 4배 128×128).
 *    참고 사이트의 캐릭터 이미지를 입력으로 쓰지 않았고, 입력은 수치(팔레트)뿐이다.
 *    색은 SERTZ 기존 에셋에서 실측했다.
 *
 *  스프라이트 이름 → 생성 얼굴 종류 매핑. 없는 이름은 기존 경로로 폴백한다. */
const SPUM_TO_FACE: Record<string, string> = {
  spum_merchant: "merchant", npc_merchant: "merchant",
  spum_knight: "knight", npc_gm: "merchant",
  spum_mage: "mage", npc_mage_rin: "mage", spum_mystic: "mage",
  spum_elf: "elf", npc_fairy_aria: "elf", npc_guide_lily: "elf",
  spum_villager_m: "villager_m", npc_villager1: "villager_m",
  spum_forager: "villager_m", spum_fisher: "villager_m", spum_scout: "villager_m",
  spum_villager_f: "villager_f", npc_villager2: "villager_f", npc_witch_nyx: "villager_f",
  spum_butler: "villager_m", spum_devil: "villager_f", spum_skel: "villager_m",
  spum_smith: "smith", npc_jobmaster: "smith", spum_miner: "smith",
  spum_priest: "priest", npc_scholar_mio: "priest",
};

/** 생성 얼굴이 있으면 그 tex 이름을 돌려준다 (확장자 없이 — 렌더러가 .png 로 붙인다). */
function faceFor(tex: string, expr: /** vc211 (#표정연동) */ FaceExpr = "neutral"): string | null {
  const kind = SPUM_TO_FACE[tex];
  return kind ? `npcface/${kind}_${expr}` : null;
}

/** vc211 (#표정연동) — 대사창 표정. 생성 얼굴은 3종을 갖는다. */
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
  const timer = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const lastAdvance = useRef(0);

  const name = getPlayerName();
  // {name} 치환 — 플레이어가 지은 이름이 대사에 반영됨
  const line = (dialogue?.lines[idx] ?? "").replaceAll("{name}", name);
  const speakerName = (dialogue?.speaker ?? "").replaceAll("{name}", name);
  const portrait = dialogue ? portraitOf(dialogue.speaker ?? "", (dialogue as { portrait?: string }).portrait) : null;
  /* vc211 (#표정연동) — 표정 결정 우선순위:
   *  ① exprByLine[idx]  ② dialogue.expr  ③ 문장 자동 추론  ④ neutral
   *  자동 추론은 `line`(현재 줄)을 쓴다 — 줄마다 감정이 바뀌는 대사가 많다. */
  const expr: FaceExpr =
    dialogue?.exprByLine?.[idx] ??
    dialogue?.expr ??
    (line ? inferExpr(line, dialogue?.speaker ?? "") : "neutral");
  /* 생성 얼굴이 있으면 우선 사용. 없으면 기존 경로(.webp). */
  const genFace = portrait ? faceFor(portrait.tex, expr) : null;
  const portraitSrc = genFace ? `/assets/${genFace}.png` : portrait ? `/assets/${portrait.tex}.webp` : "";
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

  /** 홀드 고속 진행 — 반복 키 입력/홀드 타이머가 일정 간격으로 advance 호출 */
  const advanceThrottled = () => {
    const now = performance.now();
    if (now - lastAdvance.current < 130) return;
    lastAdvance.current = now;
    advance();
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
        advanceRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 모바일: 화면 홀드 — 누르는 동안 고속 진행
  const startHold = (e: React.PointerEvent) => {
    e.preventDefault();
    advanceThrottled();
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = window.setInterval(() => advanceRef.current(), 150);
  };
  const stopHold = () => {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
  };

  if (!dialogue) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 sm:px-6 sm:pb-6"
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
    >
      {/* v1.0.20 — 대화창: 게임형 프레임 (우드 프레임 + 금 스피커 네임플레이트) */}
      <div className="game-panel flex w-full max-w-2xl cursor-pointer touch-none items-stretch gap-2.5 p-3 sm:gap-3 sm:p-4">
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
            <span className="animate-pulse text-[#ffd98a]">{shown.length < line.length ? "▌" : ""}</span>
          </p>
          {/* vc143 (#10) — 선택형 대화: 마지막 줄 완료 시 선택지 버튼 (보스전 퇴장 관리인 등).
           *  클릭 시 dialogue:choice 발신 + dialogue:done으로 종료 — 컨테이너 홀드 진행과 충돌 없게 stopPropagation */}
          {dialogue.choices && dialogue.choices.length > 0 && idx >= dialogue.lines.length - 1 && shown.length >= line.length && (
            <div className="mt-2 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              {dialogue.choices.map((c) => (
                <button
                  key={c.id}
                  className="game-btn px-3 py-1.5 text-left text-[12px] font-black text-[#ffe9b0] transition-transform active:scale-95 sm:text-[13px]"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    audio.sfx.uiClick();
                    EventBus.emit("dialogue:choice", { id: c.id });
                    EventBus.emit("dialogue:done");
                  }}
                >
                  ▸ {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 text-right text-[10px] font-bold text-white/50 sm:text-[11px]">
            {shown.length < line.length
              ? "스페이스·탭으로 건너뛰기 (꾹 누르면 빠르게)"
              : idx < dialogue.lines.length - 1
                ? "스페이스·탭으로 계속 ▸ (꾹 누르면 빠르게)"
                : "스페이스·탭으로 닫기"}
          </div>
        </div>
      </div>
    </div>
  );
}
