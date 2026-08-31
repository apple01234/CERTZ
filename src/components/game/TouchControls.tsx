"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { Swords, RefreshCw, Zap, Bot, Pause, Flame, Star } from "lucide-react";
import type { Skills } from "./useGameUi";

const JOY_RADIUS = 52;

/**
 * F3 반응형 핵심: 멀티터치 가상 컨트롤러
 *  - 왼쪽 절반: 동적 원점 조이스틱 (터치한 곳이 그때그때 중심)
 *  - 오른쪽: 공격/회전베기/돌진베기 버튼 — pointerdown 즉시 발동
 *  - pointerId 추적으로 동시 조작 보장, touch-action:none으로 스크롤 차단
 */
export function TouchControls({
  skills,
  hpPot,
  mpPot,
  atkName,
  s1Name,
  s2Name,
  s3Name,
  s4Name,
  canAutoHunt,
  autoHunt,
}: {
  skills: Skills;
  hpPot: number;
  mpPot: number;
  atkName?: string;
  s1Name?: string;
  s2Name?: string;
  /** v3.0.3 — 3차기/4차기 (미해금 시 빈 문자열 → 버튼 숨김) */
  s3Name?: string;
  s4Name?: string;
  canAutoHunt?: boolean;
  autoHunt?: boolean;
}) {
  const [joyOrigin, setJoyOrigin] = useState<{ x: number; y: number } | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyPointer = useRef<number | null>(null);
  /* v2.9 (사용자 지시 #2) — PC에서도 스킬 쿨타임/물약/자동사냥 버튼을 보여준다.
   *  isTouch = 조이스틱 표시 여부. PC(마우스 전용)면 버튼만, 터치면 조이스틱+버튼 */
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900)
  );

  useEffect(() => {
    const reevaluate = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsTouch(coarse || window.innerWidth < 900);
    };
    reevaluate();
    const onTouch = () => setIsTouch(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    window.addEventListener("resize", reevaluate);
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("resize", reevaluate);
    };
  }, []);

  const sendMove = useCallback((x: number, y: number) => {
    EventBus.emit("input:move", { x, y });
  }, []);

  const onJoyDown = (e: React.PointerEvent) => {
    if (joyPointer.current !== null) return;
    joyPointer.current = e.pointerId;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setJoyOrigin({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setJoyKnob({ x: 0, y: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onJoyMove = (e: React.PointerEvent) => {
    if (joyPointer.current !== e.pointerId || !joyOrigin) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dx = e.clientX - rect.left - joyOrigin.x;
    let dy = e.clientY - rect.top - joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    setJoyKnob({ x: dx, y: dy });
    sendMove(dx / JOY_RADIUS, dy / JOY_RADIUS);
  };

  const onJoyUp = (e: React.PointerEvent) => {
    if (joyPointer.current !== e.pointerId) return;
    joyPointer.current = null;
    setJoyOrigin(null);
    setJoyKnob({ x: 0, y: 0 });
    sendMove(0, 0);
  };

  const s1Ready = skills.s1Cd <= 0 && skills.mp >= 15;
  const s2Ready = skills.s2Cd <= 0 && skills.mp >= 20;
  const s1Pct = skills.s1Cd > 0 ? (skills.s1Cd / skills.s1Max) * 100 : 0;
  const s2Pct = skills.s2Cd > 0 ? (skills.s2Cd / skills.s2Max) * 100 : 0;
  /* v3.0.3 — 3차기/4차기 */
  const s3Ready = skills.s3Cd <= 0 && skills.mp >= 25;
  const s4Ready = skills.s4Cd <= 0 && skills.mp >= 40;
  const s3Pct = skills.s3Cd > 0 ? (skills.s3Cd / Math.max(1, skills.s3Max)) * 100 : 0;
  const s4Pct = skills.s4Cd > 0 ? (skills.s4Cd / Math.max(1, skills.s4Max)) * 100 : 0;

  return (
    <>
      {/* 조이스틱 영역 — v3.0.5: 화면 왼쪽 전체(45% × 전체 높이)에서 좌하단(46% × 아래 55%)으로 축소.
          NPC 머리 위 상호작용 칩과 겹치던 인식 범위 문제 해소 (터치 기기에서만, PC는 마우스 방해 금지) */}
      {isTouch && (
      <div
        className="absolute bottom-0 left-0 h-[55%] w-[46%] touch-none"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
      >
        {/* 대기 중 안내 패드 — 조이스틱 영역이 어디인지 보여줌 (채팅 입력 위로 배치, 터치하면 실제 조이스틱으로 교체) */}
        {!joyOrigin && (
          <div className="pointer-events-none absolute bottom-20 left-6 flex h-[104px] w-[104px] items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-black/25 sm:bottom-24 sm:left-10">
            <span className="text-[10px] font-black tracking-widest text-white/45">이동</span>
          </div>
        )}
        {joyOrigin && (
          <>
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white/35 bg-white/10"
              style={{
                left: joyOrigin.x - JOY_RADIUS,
                top: joyOrigin.y - JOY_RADIUS,
                width: JOY_RADIUS * 2,
                height: JOY_RADIUS * 2,
              }}
            />
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white/70 bg-white/40 shadow-lg"
              style={{
                left: joyOrigin.x - 24 + joyKnob.x,
                top: joyOrigin.y - 24 + joyKnob.y,
                width: 48,
                height: 48,
              }}
            />
          </>
        )}
      </div>
      )}

      {/* 버튼: 우하단 — 터치/PC 공용 (사용자 지시 #2) — v3.0.4: 모바일에서 스킬 버튼 축소+2×2 그리드 (지시 #6) */
      }
      <div className="absolute bottom-3 right-2 flex items-end gap-1.5 sm:bottom-6 sm:right-5 sm:gap-3">
        <div className="flex flex-col gap-1.5">
          {/* v2.5 — 자동사냥 토글 (펫 보유 시) */}
          {canAutoHunt && (
            <button
              aria-label={autoHunt ? "자동사냥 끄기" : "자동사냥 켜기"}
              className={`relative flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-90 sm:h-14 sm:w-14 ${
                autoHunt
                  ? "border-lime-200/80 bg-gradient-to-b from-lime-500 to-emerald-700 text-white animate-pulse"
                  : "border-white/25 bg-slate-800/85 text-white/80"
              }`}
              onPointerDown={(e) => {
                e.preventDefault();
                EventBus.emit("rpg:autohunt", {});
              }}
            >
              {autoHunt ? <Pause size={17} /> : <Bot size={17} />}
              <span className="absolute -top-1 left-0.5 rounded bg-slate-900/80 px-0.5 text-[8px] font-black text-white/80">
                {autoHunt ? "자동중" : "자동"}
              </span>
            </button>
          )}
          {/* 물약 퀵슬롯 (2D MMORPG 기본 요소) */}
          <PotionButton
            kind="hp"
            count={hpPot}
            tint="from-rose-500 to-rose-700 border-rose-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "hp" })}
          />
          <PotionButton
            kind="mp"
            count={mpPot}
            tint="from-sky-500 to-blue-800 border-sky-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "mp" })}
          />
        </div>
        {/* v3.0.4 — 스킬 2×2 그리드 (4차까지 해금돼도 자리 부족하지 않게: 지시 #6) */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* v3.0.3 — 4차기(B): 해금 시만 표시 */}
          {s4Name && (
            <SkillButton
              ready={s4Ready}
              cdPct={s4Pct}
              label={s4Name}
              mp={40}
              onDown={() => EventBus.emit("input:skill4")}
            >
              <Star size={17} />
            </SkillButton>
          )}
          {/* v3.0.3 — 3차기(V): 해금 시만 표시 */}
          {s3Name && (
            <SkillButton
              ready={s3Ready}
              cdPct={s3Pct}
              label={s3Name}
              mp={25}
              onDown={() => EventBus.emit("input:skill3")}
            >
              <Flame size={16} />
            </SkillButton>
          )}
          <SkillButton
            ready={s1Ready}
            cdPct={s1Pct}
            label={s1Name || "회전베기"}
            mp={15}
            onDown={() => EventBus.emit("input:skill1")}
          >
            <RefreshCw size={16} />
          </SkillButton>
          <SkillButton
            ready={s2Ready}
            cdPct={s2Pct}
            label={s2Name || "돌진베기"}
            mp={20}
            onDown={() => EventBus.emit("input:skill2")}
          >
            <Zap size={18} />
          </SkillButton>
        </div>
        <button
          aria-label="공격"
          className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-[3px] border-rose-200/70 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform active:scale-90 sm:h-20 sm:w-20"
          onPointerDown={(e) => {
            e.preventDefault();
            EventBus.emit("input:attack");
          }}
        >
          <div className="flex flex-col items-center">
            <Swords size={22} />
            <span className="mt-0.5 text-[9px] font-black tracking-wide">{atkName || "공격"}</span>
          </div>
        </button>
      </div>
    </>
  );
}

function PotionButton({
  kind,
  count,
  tint,
  onDown,
}: {
  kind: "hp" | "mp";
  count: number;
  tint: string;
  onDown: () => void;
}) {
  return (
    <button
      aria-label={kind === "hp" ? "HP 물약" : "MP 물약"}
      disabled={count <= 0}
      className={`relative flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 text-white shadow-lg transition-transform active:scale-90 sm:h-12 sm:w-12 ${
        count > 0 ? `bg-gradient-to-b ${tint}` : "border-white/20 bg-slate-700/70 opacity-50"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (count > 0) onDown();
      }}
    >
      { }
      <img
        src={`/assets/item_potion_${kind}.png`}
        alt=""
        draggable={false}
        className="h-5 w-5"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="absolute -bottom-0.5 right-0.5 rounded bg-slate-900/90 px-1 text-[8px] font-black leading-[13px] text-white">
        {count}
      </span>
      <span className="absolute -top-1 left-0.5 rounded bg-slate-900/80 px-0.5 text-[8px] font-black text-white/70">
        {kind === "hp" ? "Q" : "R"}
      </span>
    </button>
  );
}

function SkillButton({
  children,
  label,
  mp,
  ready,
  cdPct,
  onDown,
}: {
  children: React.ReactNode;
  label: string;
  mp: number;
  ready: boolean;
  cdPct: number;
  onDown: () => void;
}) {
  return (
    <button
      aria-label={label}
      disabled={!ready}
      className={`relative flex h-11 w-11 touch-none select-none flex-col items-center justify-center overflow-hidden rounded-full border-2 text-white shadow-lg transition-transform active:scale-90 sm:h-14 sm:w-14 ${
        ready
          ? "border-sky-200/70 bg-gradient-to-b from-sky-500 to-blue-800"
          : "border-white/20 bg-slate-700/70 opacity-60"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (ready) onDown();
      }}
    >
      {children}
      <span className="max-w-[42px] truncate text-[7px] font-bold leading-tight sm:max-w-none sm:text-[8px]">{label}</span>
      <span className="text-[7px] font-bold text-sky-200 sm:text-[8px]">{mp}MP</span>
      {cdPct > 0 && (
        <div
          className="pointer-events-none absolute inset-0 bg-black/60"
          style={{ clipPath: `inset(${100 - cdPct}% 0 0 0)` }}
        />
      )}
    </button>
  );
}
