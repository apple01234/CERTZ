"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { Swords, Bot, Pause, Star } from "lucide-react";
import type { Skills } from "./useGameUi";
import { loadKeyMap } from "@/game/keymap"; // v1.0.4 — 물약 키 힌트를 키맵 따라 표시

/* v3.0.18 — 52→64px: 스틱 반경 확대로 미세 조작 정밀도 향상 + 풀 기울임이 쉬워짐
 *  (기존 52px는 손가락이 조금만 쉬어도 실질 60~85% 속도 — "이속이 느림" 체감의 주원인) */
const JOY_RADIUS = 64;

/* ═══ v1.4.12 (#8 유저 지시 "사진처럼 스킬 UI 배치를 바꿔") — 와일드리프트식 아크 레이아웃 ═══
 *  사진(LoL Wild Rift) 기준:
 *   · 기본공격 버튼을 우하단 코너에 두고, 스킬 버튼들이 공격 버튼을 중심으로
 *     부채꼴(arc) 위에 극좌표 배치된다 — 엄지 회전 동선상 어느 스킬이든 한 손에 닿는다.
 *   · 자동전투/물약은 공격 버튼 왼쪽·아래 작은 원형으로 별도 클러스터.
 *  극좌표 헬퍼: 각도(°)와 반경(px) → 버튼 left/top (버튼 중심 기준) */
const ARC = {
  /** 컨테이너 크기 (sm: 태블림/PC 확대) */
  w: 236,
  h: 232,
  wSm: 272,
  hSm: 264,
  /** 스킬 반경 — 공격 버튼 중심에서 스킬 버튼 중심까지 */
  r: 82,
  rSm: 96,
  /** 시작/종료 각도 (°, 수학 좌표계 — 180=왼쪽, 90=위) */
  a0: 196,
  a1: 74,
  /** 공격 버튼 중심 = 컨테이너 우하단 코너에서 안쪽으로 */
  cx: 178,
  cy: 164,
  cxSm: 204,
  cySm: 196,
};

/** 극좌표 → 컨테이너 내 left/top (버튼 중심 기준 px) */
function arcPos(cx: number, cy: number, r: number, deg: number): { left: number; top: number } {
  const rad = (deg * Math.PI) / 180;
  return { left: Math.round(cx + Math.cos(rad) * r), top: Math.round(cy - Math.sin(rad) * r) };
}

/** 해금된 스킬 수에 따라 부채꼴 각도 분배 (a0→a1 사이 등간격) */
function arcAngles(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(ARC.a0 + ARC.a1) / 2];
  const step = (ARC.a0 - ARC.a1) / (n - 1);
  return Array.from({ length: n }, (_, i) => ARC.a0 - i * step);
}

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
  quickPots,
  potCount,
  atkName,
  s1Name,
  s2Name,
  s3Name,
  s4Name,
  s5Name,
  canAutoHunt,
  autoHunt,
}: {
  skills: Skills;
  hpPot: number;
  mpPot: number;
  /* v3.0.15 (#7) — 퀵슬롯에 장착된 물약 아이템키/수량 */
  quickPots?: { hp: string; mp: string };
  potCount?: (k: string) => number;
  atkName?: string;
  s1Name?: string;
  s2Name?: string;
  /** v3.0.3 — 3차기/4차기 (미해금 시 빈 문자열 → 버튼 숨김) */
  s3Name?: string;
  s4Name?: string;
  /** v3.2.0 — 5차 궁극기 (Lv.200 해금, 쿨타임 60초) */
  s5Name?: string;
  canAutoHunt?: boolean;
  autoHunt?: boolean;
}) {
  /* v3.0.18 — 조이스틱 걸림 근원 제거: 기존엔 스틱 1px마다 setJoyKnob(setState) →
   *  모바일 WebView에서 매 프레임 리렌더 → 입력/프레임 지연 = "움직일 때 뭔가 걸리는 느낌".
   *  이제 베이스/노브를 ref 직접 DOM 조작으로 그린다 — 드래그 중 리렌더 0.
   *  dragging 상태는 down/up 1회씩만 변경 (안내 패드 토글용). */
  const [dragging, setDragging] = useState(false);
  const joyPointer = useRef<number | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
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
    joyOriginRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    const base = joyBaseRef.current;
    if (base) {
      base.style.display = "block";
      base.style.left = `${joyOriginRef.current.x - JOY_RADIUS}px`;
      base.style.top = `${joyOriginRef.current.y - JOY_RADIUS}px`;
    }
    const knob = joyKnobRef.current;
    if (knob) {
      knob.style.display = "block";
      knob.style.left = `${joyOriginRef.current.x - 26}px`;
      knob.style.top = `${joyOriginRef.current.y - 26}px`;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onJoyMove = (e: React.PointerEvent) => {
    const origin = joyOriginRef.current;
    if (joyPointer.current !== e.pointerId || !origin) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dx = e.clientX - rect.left - origin.x;
    let dy = e.clientY - rect.top - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    /* v3.0.18 — 노브 표시는 setState 없이 직접 DOM 이동 (리렌더 0 = 입력 지연 0) */
    const knob = joyKnobRef.current;
    if (knob) {
      knob.style.left = `${origin.x + dx - 26}px`;
      knob.style.top = `${origin.y + dy - 26}px`;
    }
    /* v3.0.18 — 무단속 연속 커브: 기존 14% 데드존 경계에서 속도 0→30% "계단 점프"가
     *  미세 조작 시 뚝뚝 끊기는(걸리는) 체감의 물리적 원인. 신규 곡선은 계단 없이
     *  8% 데드존(5px)부터 부드럽게 가속 — 42%(27px) 밀면 100% 최속 도달.
     *  실측: raw=9%→13%, 15%→40%, 25%→67%, 35%→88%, 42%+→100% */
    const raw = Math.min(1, len / JOY_RADIUS);
    const t = Math.max(0, Math.min(1, (raw - 0.08) / 0.34));
    const boosted = t <= 0 ? 0 : Math.pow(t, 0.58);
    if (boosted > 0 && len > 0.001) {
      /* v3.0.25 버그 수정 — "조이스틱을 너무 세게 당기면 느려지는" 원인:
       *  반경(64px) 초과 시 dx·dy를 클램프한 뒤 [원본 len]으로 나눠서
       *  방향 벡터 크기가 R/len(<1)로 줄어들었다 (128px 당김 = 정확히 반속).
       *  수정: 클램프 [후] 길이(min(len, R))로 정규화 — 어떻게 당겨도 풀속 유지 */
      const outLen = Math.hypot(dx, dy) || 1; // 클램프 후 길이 = min(len, JOY_RADIUS)
      sendMove((dx / outLen) * boosted, (dy / outLen) * boosted);
    } else {
      sendMove(0, 0);
    }
  };

  const onJoyUp = (e: React.PointerEvent) => {
    if (joyPointer.current !== e.pointerId) return;
    joyPointer.current = null;
    joyOriginRef.current = null;
    setDragging(false);
    if (joyBaseRef.current) joyBaseRef.current.style.display = "none";
    if (joyKnobRef.current) joyKnobRef.current.style.display = "none";
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
  /* v3.2.0 — 5차 궁극기 (MP 100, 쿨타임 60초) */
  const s5Ready = (skills.s5Cd ?? 0) <= 0 && skills.mp >= 100;
  const s5Pct = (skills.s5Cd ?? 0) > 0 ? ((skills.s5Cd ?? 0) / Math.max(1, skills.s5Max ?? 60000)) * 100 : 0;

  /* ═══ v1.4.12 (#8) — 와일드리프트식 아크 레이아웃 ═══
   *  해금된 스킬(s1~s5)을 공격 버튼 중심 부채꼴에 등간격 배치.
   *  자동전투·HP/MP 물약은 좌하단 세로 클러스터 (공격 버튼 반대쪽 엄지 닿는 곳). */
  const sm = !isTouch; // PC(넓은 화면)에선 살짝 큰 크기
  const CW = sm ? ARC.wSm : ARC.w;
  const CH = sm ? ARC.hSm : ARC.h;
  const CR = sm ? ARC.rSm : ARC.r;
  const CCX = sm ? ARC.cxSm : ARC.cx;
  const CCY = sm ? ARC.cySm : ARC.cy;
  const ATK = sm ? 72 : 64; // 공격 버튼 지름

  const unlocked = [
    { key: "s1", name: s1Name || "회전베기", mp: 15, ready: s1Ready, cd: s1Pct, icon: skills.s1Icon, emit: "input:skill1" },
    { key: "s2", name: s2Name || "돌진베기", mp: 20, ready: s2Ready, cd: s2Pct, icon: skills.s2Icon, emit: "input:skill2" },
    { key: "s3", name: s3Name ?? "", mp: 25, ready: s3Ready, cd: s3Pct, icon: skills.s3Icon, emit: "input:skill3" },
    { key: "s4", name: s4Name ?? "", mp: 40, ready: s4Ready, cd: s4Pct, icon: skills.s4Icon, emit: "input:skill4" },
  ].filter((s) => s.name); // 미해금(빈 이름) 스킬은 아크에서 제외
  const hasUlt = !!s5Name;
  const angles = arcAngles(unlocked.length + (hasUlt ? 1 : 0));
  const SK = sm ? 54 : 46; // 스킬 버튼 지름

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
        {/* 대기 중 안내 패드 — v3.0.15 (#10): 이동표시를 살짝 아래로 내림 (bottom-20→bottom-15) */}
        {!dragging && (
          <div className="pointer-events-none absolute bottom-15 left-6 flex h-[104px] w-[104px] items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-black/25 sm:bottom-19 sm:left-10">
            <span className="text-[10px] font-black tracking-widest text-white/45">이동</span>
          </div>
        )}
        {/* v3.0.18 — 항상 마운트 + ref 직접 스타일 갱신 (드래그 중 리렌더 0).
         *  down 시 위치 지정, 평소엔 숨김 — JSX는 상태와 무관하게 고정 */}
        <div
          ref={joyBaseRef}
          className="pointer-events-none absolute hidden rounded-full border-2 border-white/35 bg-white/10"
          style={{ width: JOY_RADIUS * 2, height: JOY_RADIUS * 2 }}
        />
        <div
          ref={joyKnobRef}
          className="pointer-events-none absolute hidden rounded-full border-2 border-white/70 bg-white/40 shadow-lg"
          style={{ width: 52, height: 52 }}
        />
      </div>
      )}

      {/* ═══ v1.4.12 (#8 유저 지시 "사진처럼 스킬 UI 배치를 바꿔") — 와일드리프트식 아크 배치 ═══
       *  공격 버튼 우하단 코너 + 스킬 부채꼴(극좌표) + 자동/물약 좌하단 클러스터.
       *  컨테이너는 pointer-events-none, 개별 버튼만 pointer-events-auto — 아크 빈 공간은 터치 통과 */}
      <div
        className="pointer-events-none absolute z-20"
        style={{
          width: CW,
          height: CH,
          right: "max(0.25rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* 스킬 아크 (s1→s5: 왼쪽→위쪽 부채꼴) — 해금된 스킬만 등간격 배치 */}
        {unlocked.map((s, i) => {
          const p = arcPos(CCX, CCY, CR, angles[i]);
          return (
            <div
              key={s.key}
              className="pointer-events-auto absolute"
              style={{ left: p.left - SK / 2, top: p.top - SK / 2, width: SK, height: SK }}
            >
              <SkillButton
                ready={s.ready}
                cdPct={s.cd}
                label={s.name}
                mp={s.mp}
                icon={s.icon}
                compact={!!sm}
                onDown={() => EventBus.emit(s.emit as "input:skill1")}
              />
            </div>
          );
        })}
        {/* 궁극기(s5) — 아크 끝(가장 위쪽)에 살짝 큰 황금 버튼 */}
        {hasUlt && (() => {
          const p = arcPos(CCX, CCY, CR + (sm ? 10 : 8), angles[unlocked.length]);
          return (
            <div
              className="pointer-events-auto absolute"
              style={{ left: p.left - (SK + 6) / 2, top: p.top - (SK + 6) / 2, width: SK + 6, height: SK + 6 }}
            >
              <SkillButton
                ready={s5Ready}
                cdPct={s5Pct}
                label={s5Name || ""}
                mp={100}
                icon={skills.s5Icon}
                ult
                compact={!!sm}
                onDown={() => EventBus.emit("input:skill5")}
              >
                <Star size={18} />
              </SkillButton>
            </div>
          );
        })()}
        {/* 기본공격 — 컨테이너 우하단 코너 고정 */}
        <button
          aria-label="공격"
          className="pointer-events-auto absolute flex touch-none select-none items-center justify-center rounded-full border-[3px] border-rose-200/70 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform active:scale-90"
          style={{ left: CW - ATK, top: CH - ATK, width: ATK, height: ATK }}
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
        {/* 자동전투 + 물약 퀵슬롯 — 좌하단 세로 클러스터 (와일드리프트 소환사 주문 자리 역할) */}
        <div className="pointer-events-auto absolute bottom-0 left-0 flex flex-col gap-1.5">
          {canAutoHunt && (
            <button
              aria-label={autoHunt ? "자동사냥 끄기" : "자동사냥 켜기"}
              className={`relative flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-90 sm:h-12 sm:w-12 ${
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
          {/* 물약 퀵슬롯 — v3.0.15 (#7) 인벤토리에서 장착한 물약이 버튼에 표시/사용된다 */}
          <PotionButton
            kind="hp"
            count={hpPot}
            itemKey={quickPots?.hp ?? "potion_hp"}
            itemCount={potCount?.(quickPots?.hp ?? "potion_hp") ?? hpPot}
            tint="from-rose-500 to-rose-700 border-rose-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "hp" })}
          />
          <PotionButton
            kind="mp"
            count={mpPot}
            itemKey={quickPots?.mp ?? "potion_mp"}
            itemCount={potCount?.(quickPots?.mp ?? "potion_mp") ?? mpPot}
            tint="from-sky-500 to-blue-800 border-sky-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "mp" })}
          />
        </div>
      </div>
    </>
  );
}

function PotionButton({
  kind,
  count,
  itemKey,
  itemCount,
  tint,
  onDown,
}: {
  kind: "hp" | "mp";
  count: number;
  /** v3.0.15 (#7) — 슬롯에 장착된 물약 아이템키 (기본 potion_hp/potion_mp) */
  itemKey?: string;
  itemCount?: number;
  tint: string;
  onDown: () => void;
}) {
  const shown = itemCount ?? count;
  /* v1.0.4 — PC 키 힌트 하드코딩(Q/R) 제거: 키맵 기본값(D/F)·재배치를 따라감 */
  const kmHint = loadKeyMap();
  const iconSrc =
    itemKey && itemKey !== "potion_hp" && itemKey !== "potion_mp"
      ? `/assets/item_${itemKey}.webp`
      : `/assets/item_potion_${kind}.webp`;
  return (
    <button
      aria-label={kind === "hp" ? "HP 물약" : "MP 물약"}
      disabled={shown <= 0}
      className={`relative flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 text-white shadow-lg transition-transform active:scale-90 sm:h-12 sm:w-12 ${
        shown > 0 ? `bg-gradient-to-b ${tint}` : "border-white/20 bg-slate-700/70 opacity-50"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (shown > 0) onDown();
      }}
    >
      { }
      <img
        src={iconSrc}
        alt=""
        draggable={false}
        className="h-5 w-5"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="absolute -bottom-0.5 right-0.5 rounded bg-slate-900/90 px-1 text-[8px] font-black leading-[13px] text-white">
        {shown}
      </span>
      <span className="absolute -top-1 left-0.5 rounded bg-slate-900/80 px-0.5 text-[8px] font-black text-white/70">
        {kind === "hp" ? kmHint.potHp : kmHint.potMp}
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
  icon,
  ult,
  compact,
}: {
  children?: React.ReactNode;
  label: string;
  mp: number;
  ready: boolean;
  cdPct: number;
  onDown: () => void;
  icon?: string;
  /** v3.2.0 — 궁극기 전용 황금 스타일 */
  ult?: boolean;
  /** v1.4.12 (#8 아크 레이아웃) — 컨테이너가 크기를 결정하므로 버튼은 h-full w-full */
  compact?: boolean;
}) {
  /* v3.0.27 — 아이콘 로드 실패 시 lucide 폴백 (웹뷰 캐시 오류 등 어떤 환경에서도 버튼이 깨지지 않게)
     전직 등으로 icon 경로가 바뀌면 렌더 중 상태 조정 패턴으로 에러 플래그 리셋 */
  const [prevIcon, setPrevIcon] = useState(icon);
  const [iconErr, setIconErr] = useState(false);
  if (prevIcon !== icon) {
    setPrevIcon(icon);
    setIconErr(false);
  }
  const showIcon = !!icon && !iconErr;
  return (
    <button
      aria-label={label}
      disabled={!ready}
      className={`relative flex h-full w-full touch-none select-none flex-col items-center justify-center overflow-hidden rounded-full border-2 text-white shadow-lg transition-transform active:scale-90 ${
        ready
          ? ult
            ? "border-amber-100/90 bg-gradient-to-b from-amber-300 via-amber-500 to-orange-700 shadow-[0_0_14px_rgba(255,190,60,0.65)]"
            : "border-[#e8c064]/80 bg-gradient-to-b from-[#2c3f6e] to-[#101827] shadow-[inset_0_1px_0_rgba(232,192,100,0.35),0_3px_0_rgba(0,0,0,0.45)]"
          : "border-white/20 bg-slate-700/70 opacity-60"
      }`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (ready) onDown();
      }}
    >
      {/* v3.0.8 디자인 개편 — 클래스별 스킬 아이콘 (RPG Icons Pixel Art). 없으면 기존 lucide 폴백 */}
      {showIcon ? (
        <img
          src={icon}
          alt=""
          onError={() => setIconErr(true)}
          className={compact ? "h-7 w-7 rounded-sm" : "h-6 w-6 rounded-sm sm:h-7 sm:w-7"}
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        children
      )}
      <span className={`max-w-[42px] truncate text-[7px] font-bold leading-tight sm:max-w-none sm:text-[8px] ${ult ? "text-amber-100" : ""}`}>{label}</span>
      <span className={`text-[7px] font-bold sm:text-[8px] ${ult ? "text-amber-200" : "text-[#a8c0ff]"}`}>{mp}MP</span>
      {cdPct > 0 && (
        <div
          className="pointer-events-none absolute inset-0 bg-black/60"
          style={{ clipPath: `inset(${100 - cdPct}% 0 0 0)` }}
        />
      )}
    </button>
  );
}
