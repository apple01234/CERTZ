"use client";

import { useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { getPlayerName } from "@/game/config";
import { BOSS_DEFS } from "@/game/data";

/**
 * 대화창: 타이프라이터 + 스페이스/엔터·탭으로 진행, 마지막 줄 완료 시 게임 재개.
 * v2.0 (사용자 지시 #3): 스페이스바/클릭을 꾹 누르면 대화가 계속 빠르게 넘어간다.
 * v3.0.24 (#초상화): 대사창 왼쪽 끝에 화자 초상화 배치 — 흔한 RPG의 클래식한 대화 UI.
 *  게임 내 실제 스프라이트(NPC/보스/펫/주인공)를 픽셀 확대해 초상화로 사용 — 아트 스타일 일관성.
 */

/** 화자 → 초상화 스프라이트 매핑 (public/assets/<키>.png) */
const NPC_PORTRAITS: Record<string, { tex: string; tone: string }> = {
  "룬 정령 이그니": { tex: "pet_pixie", tone: "#67e8f9" }, // 시안 — 룬 정령
  "여관 주인 로안": { tex: "npc_villager1", tone: "#fcd34d" },
  "마을 주민": { tex: "npc_villager1", tone: "#fcd34d" },
  "마을 아이": { tex: "npc_villager2", tone: "#fcd34d" },
  "호족 소녀 엘렌": { tex: "npc_villager2", tone: "#fcd34d" },
  "상인 라고스": { tex: "npc_merchant", tone: "#fcd34d" },
  "직업 교관 카이엔": { tex: "npc_jobmaster", tone: "#fbbf24" },
  "쿠소디아 기사단장": { tex: "npc_jobmaster", tone: "#fbbf24" },
  "라이언 드 쿠소디아 국왕": { tex: "npc_villager1", tone: "#fbbf24" },
  "알프헤임의 여왕 요정": { tex: "npc_villager2", tone: "#a7f3d0" },
  "땅의 요정 여왕": { tex: "npc_villager2", tone: "#a7f3d0" },
  "난쟁이 광산 조합장": { tex: "npc_merchant", tone: "#fcd34d" },
  "마법사 흐레스": { tex: "npc_gm", tone: "#c4b5fd" },
  "세계수 이그드라실": { tex: "tree", tone: "#7dd3fc" },
  "종언의 마룡 아부디토스": { tex: "boss_nidhog_idle0", tone: "#fda4af" }, // v4.1.3 고증 표기 통일 — 없는 파일(boss_nidhog) 대신 실제 프레임 파일명
  "{name}": { tex: "hero_idle0", tone: "#86efac" }, // 플레이어
};

/** 보스 대사 — BOSS_DEFS의 보스 이름과 일치하면 해당 보스 스프라이트 사용
 *  v3.0.25 (#이미지 안불러와짐) — 보스 텍스처는 idle 프레임 분할 파일(boss_*_idle0.png)이므로
 *  기본명(boss_nidhog.png 등)은 404 → 전원 이미지가 깨졌다. 첫 idle 프레임을 초상화로 사용 */
function bossPortrait(speaker: string): { tex: string; tone: string } | null {
  for (const def of Object.values(BOSS_DEFS)) {
    if (def.name === speaker) return { tex: `${def.tex}_idle0`, tone: "#fda4af" };
  }
  return null;
}

function portraitOf(speaker: string): { tex: string; tone: string } | null {
  if (NPC_PORTRAITS[speaker]) return NPC_PORTRAITS[speaker];
  return bossPortrait(speaker);
}

export function DialogueBox({
  dialogue,
}: {
  dialogue: { speaker: string; lines: string[] } | null;
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
  const portrait = dialogue ? portraitOf(dialogue.speaker ?? "") : null;
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

  // PC: 스페이스바/엔터로 대화 넘기기 — 꾹 누르면 계속 빠르게 (e.repeat 활용)
  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        advanceThrottled();
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
    holdTimer.current = window.setInterval(advanceThrottled, 150);
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
      <div className="flex w-full max-w-2xl cursor-pointer touch-none items-stretch gap-2.5 rounded-xl border-2 border-amber-200/60 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-sm sm:gap-3 sm:p-4">
        {/* v3.0.24 — 화자 초상화 (클래식 RPG 대화창 레이아웃: 좌측 초상 프레임) */}
        {portrait && (
          <div
            className="relative h-14 w-14 shrink-0 self-start overflow-hidden rounded-lg border-2 bg-gradient-to-b from-slate-800/90 to-slate-950 sm:h-20 sm:w-20"
            style={{ borderColor: `${portrait.tone}88` }}
          >
            {/* v3.0.25 (#비율 찌그러짐) — object-cover + object-top: 원본 비율 유지하며
                프레임을 채우고(살짝 크롭 허용), 머리는 상단 고정 — 기존 강제 정사각형 스트레치 제거 */}
            <img
              key={portrait.tex}
              src={`/assets/${portrait.tex}.png`}
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
            <span className="inline-block rounded-md bg-amber-300/90 px-2 py-0.5 text-[11px] font-black text-slate-900 sm:text-xs">
              {speakerName}
            </span>
          </div>
          <p className="min-h-[2.6em] text-[13px] leading-relaxed text-white sm:min-h-[2.4em] sm:text-[15px]">
            {shown}
            <span className="animate-pulse text-amber-300">{shown.length < line.length ? "▌" : ""}</span>
          </p>
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
