"use client";

import { useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { getPlayerName } from "@/game/config";

/** 대화창: 타이프라이터 + 스페이스/엔터·탭으로 진행, 마지막 줄 완료 시 게임 재개 */
export function DialogueBox({
  dialogue,
}: {
  dialogue: { speaker: string; lines: string[] } | null;
}) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState("");
  const timer = useRef<number | null>(null);

  const name = getPlayerName();
  // {name} 치환 — 플레이어가 지은 이름이 대사에 반영됨
  const line = (dialogue?.lines[idx] ?? "").replaceAll("{name}", name);

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

  // PC: 스페이스바/엔터로 대화 넘기기 (사용자 지시 — 대화 진행 키)
  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!dialogue) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 sm:px-6 sm:pb-6"
      onPointerDown={(e) => {
        e.preventDefault();
        advance();
      }}
    >
      <div className="w-full max-w-2xl cursor-pointer touch-none rounded-xl border-2 border-amber-200/60 bg-slate-950/90 p-3.5 shadow-2xl backdrop-blur-sm sm:p-4">
        <div className="mb-1 inline-block rounded-md bg-amber-300/90 px-2 py-0.5 text-[11px] font-black text-slate-900 sm:text-xs">
          {(dialogue.speaker ?? "").replaceAll("{name}", name)}
        </div>
        <p className="min-h-[2.6em] text-[13px] leading-relaxed text-white sm:min-h-[2.4em] sm:text-[15px]">
          {shown}
          <span className="animate-pulse text-amber-300">{shown.length < line.length ? "▌" : ""}</span>
        </p>
        <div className="mt-1 text-right text-[10px] font-bold text-white/50 sm:text-[11px]">
          {shown.length < line.length
            ? "스페이스·탭으로 건너뛰기"
            : idx < dialogue.lines.length - 1
              ? "스페이스·탭으로 계속 ▸"
              : "스페이스·탭으로 닫기"}
        </div>
      </div>
    </div>
  );
}
