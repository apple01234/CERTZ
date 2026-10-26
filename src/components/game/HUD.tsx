"use client";

import React from "react";

import type { HudState, QuestState } from "./EventBus";
import { classDef, classLabel } from "@/game/classes";
import { BUFF_DEFS, type BuffKey } from "@/game/data";
import { loadKeyMap } from "@/game/keymap"; // v1.0.5 — HUD 키 배지가 키맵 재배치를 따라가도록
import { fmt, fmtC } from "@/game/fmt"; // v1.4.0 규칙 1-1 — 전역 반올림 포맷터
import { Volume2, VolumeX, ScrollText, Backpack, Sparkles, Gauge, ListChecks, Settings, Crown, Gift, Swords, Users, UsersRound, Repeat, Trophy, Ellipsis, UserRound, KeyRound, HelpCircle, GraduationCap, UserRoundPen } from "lucide-react";
import { GameIcon } from "./GameIcon"; // vc185 (#7) — 사람이 그린 RPG 아이콘으로 교체
import { EventBus } from "./EventBus";
import * as audio from "@/game/audio"; // v1.4.8 — 더보기 소셜 버튼 클릭음

/** 버프 아이콘 + 남은 시간 바 (v1.9 BM) */
function BuffChip({ buff }: { buff: HudState["buffs"][number] }) {
  const def = BUFF_DEFS[buff.key as BuffKey];
  if (!def) return null;
  const pct = Math.max(0, Math.min(100, (buff.remain / buff.total) * 100));
  const sec = Math.ceil(buff.remain / 1000);
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-md border border-white/25 bg-black/60">
      <img src={`/assets/${def.icon}.webp`} alt={def.name} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/70">
        <div className="h-full" style={{ width: `${pct}%`, background: def.color }} />
      </div>
      <span
        className="absolute inset-x-0 top-0 text-center text-[8px] font-black text-white [text-shadow:0_1px_1px_#000]"
      >
        {sec > 99 ? "99" : sec}
      </span>
    </div>
  );
}

/** v1.1.6 (#개편 B55) — 값이 바뀔 때 이전 값에서 새 값으로 굴러 올라가는 표시값.
 *  골드가 15,000 → 32,400으로 튀면 "얼마나 늘었나"가 안 보인다. 400ms에 걸쳐
 *  증가분을 굴리면 획득감이 생긴다(감소 시엔 즉시 반영 — 잔액 부족이 늦게 보이면 안 됨). */
function useRollingNumber(target: number, ms = 400) {
  const [shown, setShown] = React.useState(target);
  const fromRef = React.useRef(target);
  const rafRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (target === shown) return;
    if (target < shown) { fromRef.current = target; setShown(target); return; }
    const from = fromRef.current;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const eased = 1 - (1 - k) * (1 - k);
      setShown(Math.round(from + (target - from) * eased));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // shown은 의도적으로 의존성에서 제외 — target 변화에만 반응해야 한다
  }, [target, ms]);
  return shown;
}

function Bar({
  value,
  max,
  from,
  to,
  label,
  height = 14,
}: {
  value: number;
  max: number;
  from: string;
  to: string;
  label: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      className="sertz-gauge relative w-44 overflow-hidden rounded-full border border-black/60 bg-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] sm:w-56"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${to}, ${from})` }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white [text-shadow:0_1px_2px_#000,0_0_3px_#000]"
        style={{ fontSize: height * 0.62 }}
      >
        {label}
      </span>
    </div>
  );
}

export function HUD({
  hud,
  quest,
  muted,
  canJob,
  jobAvail,
  onToggleMute,
  onOpenInv,
  onOpenJob,
  onOpenStat,
  onOpenQuest,
  onOpenBoss,
  onOpenBenefit,
  onOpenContent,
  onOpenOpt,
  onOpenUnion,
  onOpenTrade,
  onOpenRank, // v1.3.0 (#7) — 랭킹창
  onOpenGuide, // v1.4.12 (#16) — 라일락의 UI 기능 안내
}: {
  hud: HudState;
  quest: QuestState;
  muted: boolean;
  /** 전직/승격 가능 — 버튼 강조(펄스) */
  canJob: boolean;
  /** 전직 패널 접근 가능 (승격 가능 or 2차 이상 자유전직) */
  jobAvail: boolean;
  /** v2.5 자동사냥 (펫 보유 시) */
  onToggleMute: () => void;
  onOpenInv: () => void;
  onOpenJob: () => void;
  /** 스탯 창 (T) — AP 남으면 강조 */
  onOpenStat: () => void;
  /** 퀘스트 로그 (J) */
  onOpenQuest: () => void;
  /** v3.0.25 — 보스 재도전 전용 창 */
  onOpenBoss: () => void;
  /** v4.0.0 — 혜택 (출석부/일일 퀘스트/쿠폰) */
  onOpenBenefit: () => void;
  /** v1.0.8 — 무한 콘텐츠 허브 (탑/시련/제작/심연상점/환생) */
  onOpenContent: () => void;
  /** 설정/키 매핑 (O) */
  onOpenOpt: () => void;
  /** v1.0.18 — 유니온 패널 (캐릭터 배치/상점/레이드) */
  onOpenUnion: () => void;
  /** v1.2.0 (#2) — 유저 거래소 직접 진입 (상점 속 작은 버튼에 숨어 있어 접근성 지적) */
  onOpenTrade: () => void;
  /** v1.3.0 (#7) — 랭킹창 (레벨/전투력/콘텐츠 + 주간 랭커 보상) */
  onOpenRank: () => void;
  /** v1.4.12 (#16) — 라일락의 UI 기능 안내 */
  onOpenGuide: () => void;
}) {
  /* v1.0.16 (F3) — 우측 버튼 컬럼의 zoom 배율. 화면 폭에 따라 커지므로 계산을 한 곳에 모은다.
   *  같은 값을 --tap-zoom으로도 넘겨 .tap-safe 히트 영역이 zoom을 역보정하게 한다. */
  const hudZoom = typeof window !== "undefined"
    ? (window.innerWidth >= 1600 ? 1.28 : window.innerWidth >= 1280 ? 1.18 : window.innerWidth >= 1024 ? 1.08 : window.innerWidth >= 640 ? 0.92 : 0.85)
    : 1;
  /* v1.0.5 — 키맵 재배치 시 HUD 키 배지·aria도 함께 갱신 (I/T/J/K/O 하드코딩 제거) */
  const km = loadKeyMap();
  const expPct = Math.min(100, (hud.exp / Math.max(1, hud.expNext)) * 100);
  /* v1.1.6 — 골드 카운트업 (증가 시에만 굴림) */
  const rollingGold = useRollingNumber(hud.gold);
  /* v3.0.2 (지시 #4/#5) — 퀘스트 트래커 축소/펼침 토글 (모바일에서 너무 큰 문제) */
  const [trackerOpen, setTrackerOpen] = React.useState(() => localStorage.getItem("sertz.trackerOpen") !== "0");
  /* v1.4.0 (#17) — 모바일 버튼 과밀 해소: 2선 버튼(보스/혜택/콘텐츠/유니온/거래소/랭킹/퀘스트로그)을
   *  “더보기” 토글로 접는다 — 주 사용 버튼(가방/스탯/설정/소리/자동/퀘스트)만 상시 노출 */
  const [moreOpen, setMoreOpen] = React.useState(false);
  /* vc150 (#신규4) — 토글이 실제로 안 먹히던 원인 수정:
   *  tutActive(튜토리얼 오버레이)가 켜져 있으면 trackerOpen을 아무리 켜도 화면에 안 나타났다
   *  ("퀘스트창 끄고 키는거 안됨"의 직접 원인) — 유저가 명시적으로 켜면 튜토리얼 중에도 표시 */
  const [tutOverride, setTutOverride] = React.useState(false);
  const toggleTracker = () => {
    setTrackerOpen((v) => {
      const next = !v;
      localStorage.setItem("sertz.trackerOpen", next ? "1" : "0");
      if (next) setTutOverride(true);
      return next;
    });
  };
  /* v1.1.1 (#1 가림) — 튜토리얼 진행 중엔 퀘스트 트래커를 숨긴다.
   *  튜토리얼 패널(Phaser 캔버스 상단 중앙)과 트래커(우상단 DOM)가 모바일 가로에서 겹쳐
   *  "튜토리얼 UI가 다른 UI에 가려진다"는 지적의 주범. 트래커는 튜토리얼 끝나면 복귀. */
  const [tutActive, setTutActive] = React.useState(false);
  /* v1.1.5 — 피격 감지(HP 감소) 시 0.34초간 흔들림 클래스를 준다. */
  const [hpShake, setHpShake] = React.useState(false);
  const prevHpRef = React.useRef(hud.hp);
  React.useEffect(() => {
    if (hud.hp < prevHpRef.current) {
      setHpShake(true);
      const t = setTimeout(() => setHpShake(false), 340);
      prevHpRef.current = hud.hp;
      return () => clearTimeout(t);
    }
    prevHpRef.current = hud.hp;
  }, [hud.hp]);
  React.useEffect(() => {
    const onTut = (v: { active: boolean }) => setTutActive(!!v?.active);
    EventBus.on("tut:active", onTut);
    return () => { EventBus.off("tut:active", onTut); };
  }, []);
  return (
    <>
      {/* 좌상단: 상태 — v1.0.20 게임형 LV 플레이트 · v1.4.0 (#18) zoom .85 전역 축소 (#15) 스탯칩 고정+버프 행은 그 아래
       *  v1.0.16 (F3) — --tap-zoom: 자식 .tap-safe 히트 영역이 이 배율을 역보정한다 */}
      <div
        className="pointer-events-none absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] flex items-start gap-2 sm:left-3 sm:top-3"
        style={{ zoom: 0.85, "--tap-zoom": "0.85" } as React.CSSProperties}
      >
        <div className="game-chip flex h-10 w-10 shrink-0 flex-col items-center justify-center sm:h-12 sm:w-12">
          <span className="text-[8px] font-bold leading-none text-[#cbb88a]">LV</span>
          <span className="text-base font-black leading-none text-white [text-shadow:0_1px_2px_#000] sm:text-lg">
            {hud.lv}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {/* 클래스 배지 (전직 후 — 1차 "전사 · 검사", 2차+ 클래스명) */}
          {hud.cls && (() => {
            const d = classDef(hud.cls);
            return d ? (
              <span
                className="game-chip w-fit px-1.5 py-0.5 text-[10px] font-black"
                style={{ color: d.color }}
              >
                {classLabel(hud.cls)}
              </span>
            ) : null;
          })()}
          {/* v1.1.5 (#개편 피드백) — 피격 시 HP 바 흔들림.
           *  화면 전체 셰이크만으로는 "내 체력이 깎였다"가 늦게 인지된다. HP가 줄어든
           *  순간에만 짧게 흔들어 시선이 HP 바로 가게 한다(회복/최대치 변화엔 반응하지 않음). */}
          <span className={hpShake ? "inline-block animate-[sfshake_0.32s_ease-out]" : "inline-block"}>
            <Bar value={hud.hp} max={hud.maxHp} from="#c2273a" to="#ff7a68" label={`${Math.min(Math.round(hud.hp), Math.round(hud.maxHp))} / ${Math.round(hud.maxHp)}`} />
          </span>
          <Bar value={hud.mp} max={hud.maxMp} from="#1e6fb8" to="#5ec5ff" label={`${Math.min(Math.round(hud.mp), Math.round(hud.maxMp))} / ${Math.round(hud.maxMp)}`} height={10} />
          {/* 골드 + 공격/방어/크리 (지시 #15 — 스탯창 고정) — v1.0.20 게임형 칩 */}
          <div className="mt-0.5 flex items-center gap-1">
            <span className="game-chip flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-black text-[#ffd98a]">
              <img src="/assets/item_coin.webp" alt="" className="h-3.5 w-3.5" style={{ imageRendering: "pixelated" }} />
              {fmtC(rollingGold)}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#ffb0b0]">
              공격 {fmt(hud.atkTotal)}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#a8e0ff]">
              방어 {fmt(hud.defTotal)}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#ffe49a]">
              크리 {fmt(hud.critRate)}%
            </span>
          </div>
          {/* vc179 (지시 #5 DDD) — 연속킬 콤보 상시 표시.
           *  남은 시간이 줄어드는 걸 보이게 하는 것만으로 "끊기기 전에 더 잡자"가 생긴다.
           *  3연킬부터 색이 뜨거워지고, 10연킬은 금색으로 최고조. */}
          {hud.combo && (
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`relative flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-black ${
                  hud.combo.n >= 10
                    ? "bg-amber-400/25 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    : hud.combo.n >= 5
                      ? "bg-orange-500/25 text-orange-200"
                      : "bg-white/10 text-white/85"
                }`}
              >
                <span className="relative z-10">연속킬 x{hud.combo.n}</span>
                <span className="relative z-10 text-[10px] text-lime-300">EXP +{hud.combo.pct}%</span>
                {/* 남은 시간 게이지 */}
                <span
                  className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-100"
                  style={{ width: `${Math.max(0, Math.min(100, (hud.combo.remain / Math.max(1, hud.combo.total)) * 100))}%` }}
                />
              </span>
            </div>
          )}
          {/* 지시 #15 — 버프 아이콘 행을 스탯칩 “바로 아래”로 이동 (기존 EXP바 위 위치에서 전배) */}
          {hud.buffs.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              {hud.buffs.map((b) => (
                <BuffChip key={b.key} buff={b} />
              ))}
            </div>
          )}
          {/* v1.1.3 (#개편) — 상태이상 표시. 중독/출혈/감속에 걸려도 화면에 아무 표시가 없어
           *  "체력이 왜 계속 줄지"를 알 수 없었다. 버프와 구분되게 붉은 테두리+남은 초로 그린다. */}
          {hud.dots && hud.dots.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              {hud.dots.map((d) => {
                const meta =
                  d.kind === "poison" ? { icon: "💀", label: "중독", color: "#9ade8a" }
                    : d.kind === "bleed" ? { icon: "🩸", label: "출혈", color: "#ff8a8a" }
                      : { icon: "🐌", label: "감속", color: "#8ab6ff" };
                const pct = d.total > 0 ? Math.max(0, Math.min(100, (d.remain / d.total) * 100)) : 0;
                return (
                  <div
                    key={d.kind}
                    title={`${meta.label} ${Math.ceil(d.remain / 1000)}초`}
                    className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-rose-400/70 bg-black/70 text-[13px] leading-none"
                  >
                    <span>{meta.icon}</span>
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/70">
                      <div className="h-full" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 우상단: 사운드/가방 + 퀘스트 — v1.4.0 (#17/#18) 2선 버튼 더보기 접기 · v1.4.9 — 우측 마진 축소(오른쪽 끝 정렬)
       *  vc145 (#5) — PC(넓은 화면)에서 UI 확대: 고정 zoom 0.85 철거 → 화면폭 반응형 스케일
       *  (≥1024 1.08 / ≥1280 1.18 / ≥1600 1.28, 모바일은 기존 0.85~0.92 유지)
       *  v1.0.13 피드백#13 — 컨테이너 상단 여백 축소(0.5rem→0.25rem) + 퀘스트 트래커를 버튼행 위(첫 자식)로 이동:
       *  기존엔 트래커가 버튼행 아래에 있어 퀘스트·콘텐츠 버튼이 화면 최상단에 안 보였다 */}
      {/* v1.0.16 (F3) — --tap-zoom: 자식 .tap-safe의 히트 영역을 이 배율로 역보정한다.
       *  zoom 안에서는 44px가 44×zoom으로 렌더되므로, CSS가 같은 값을 알아야 정확히 44px가 된다. */}
      <div
        className="absolute right-[max(0.25rem,env(safe-area-inset-right))] top-[max(0.25rem,env(safe-area-inset-top))] flex max-w-[46%] flex-col items-end gap-1.5 sm:right-1 sm:top-2"
        style={{ zoom: hudZoom, "--tap-zoom": String(hudZoom) } as React.CSSProperties}
      >
        {/* v1.0.14 피드백#5 — 퀘스트 트래커(+재오픈 칩)를 "더보기 버튼 아래"로 이동:
         *  v1.0.13 피드백#13에서 컬럼 첫 자식(버튼행보다 위)으로 올렸더니
         *  유저 지시 "퀘스트 창도 왜 더보기 위에 있음?? 더보기 밑에 있어야지??" — 버튼행·더보기
         *  메뉴 아래(컬럼 마지막)로 재배치. 표시 조건(트래커 토글·튜토리얼 중 숨김/override)은 기존 유지.
         *  v1.4.8 (#2 공간) — 트래커 축소 · v1.1.0 (#2) — 토글로 완전 숨김/표시
         *  vc150 (#신규4) — 퀘스트창이 닫혀 있으면 다시 열 버튼이 화면에 없었다 — 열기 칩 신설 */}
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          {/* vc147 (#22) — 우상단 자동전투(로봇) 버튼 철거: TouchControls 자동 버튼·B키와 삼중 중복.
           *  자동전투 진입점은 좌하단 클러스터 버튼 + B키(키맵 재배치 가능)로 통일. */}
          {/* vc149 (#15) — 소리 버튼 더보기 안으로 이동 */}
          {/* v1.3.0 (#2) — HUD ☰ 버튼 제거 (유저 지시 "선 3개 짜리 ui저거 없애").
           *  메뉴 나가기 기능은 설정(⚙) → 메뉴 화면 카드로 이동 — 기능 유지, UI 간소화 */}
          <button
            onClick={onOpenInv}
            aria-label={`가방 열기 (${km.bag})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#a8e0ff] active:scale-95"
          >
            <GameIcon name="bag" size={18} />
            {/* v1.0.13 피드백#18 — 단축키 표기 → 기능명 통일 (aria-label엔 키가 이미 포함됨) */}
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/70">가방</span>
          </button>
          {/* v1.0.14 피드백#3 — 퀘스트·콘텐츠 아이콘을 더보기 안에서 꺼내 가방 오른쪽 상단 상시 노출
           *  (유저 지시 "퀘스트, 콘텐츠 아이콘 더보기 안에가 아닌 위에(가방 아이콘 오른쪽) 배치해")
           *  v1.0.13 피드백#18 — 단축키→기능명 배지 컨벤션 유지. 좁은 화면은 기존 flex-wrap이
           *  자동 줄바꿈하므로 앵커/zoom 시스템 변경 없이 겹침 없이 수용된다 */}
          <button
            onClick={onOpenQuest}
            aria-label={`퀘스트 로그 열기 (${km.quest})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"
          >
            <GameIcon name="inventory" size={18} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">퀘스트</span>
          </button>
          <button
            onClick={onOpenContent}
            aria-label="콘텐츠 열기 (심연의 탑/일일 시련/제작/심연 상점/환생)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#d0b0ff] active:scale-95"
          >
            <GameIcon name="boss" size={18} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-purple-300/80">콘텐츠</span>
          </button>
          {jobAvail && (
            <button
              onClick={onOpenJob}
              aria-label={`전직 열기 (${km.job})`}
              className={`pointer-events-auto relative flex h-9 items-center justify-center transition-transform active:scale-95 ${
                canJob
                  ? "game-btn w-9"
                  : "game-chip w-9 text-white/70"
              }`}
            >
              <GameIcon name="skills" size={18} />
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${canJob ? "text-amber-200" : "text-white/50"}`}>전직</span>
            </button>
          )}
          {/* vc149 (#15) — 스탯 버튼 더보기 안으로 이동 */}
          {/* vc145 (#8) — 캐릭터 선택 바로가기 (vc149 #17 — 더보기가 설정 바로 왼쪽) */}
          <button
            onClick={() => { audio.sfx.uiClick(); EventBus.emit("rpg:exitMenu", { lobby: true }); }}
            aria-label="캐릭터 선택 화면으로 바로 이동"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffd98a] active:scale-95"
          >
            <GameIcon name="profession" size={18} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-amber-300/90">캐릭</span>
          </button>
          {/* v1.4.0 (#17) — 보스·혜택·유니온·거래소·랭킹 등 2선 버튼은 “더보기” 안
           *  (v1.0.14 피드백#3 — 퀘스트 로그·콘텐츠는 가방 오른쪽 상단 행으로 재이동) */}
          {/* v1.4.0 — 더보기 토글 (vc149 #17 — 설정 바로 왼쪽) */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label={moreOpen ? "부가 창 접기" : "부가 창 더보기"}
            className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${
              moreOpen
                ? "rounded-lg border-2 border-amber-300/70 bg-gradient-to-b from-amber-500/80 to-amber-700/80 text-amber-100"
                : "game-chip text-white/70"
            }`}
          >
            <GameIcon name="menu" size={18} />
            <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${moreOpen ? "text-amber-200" : "text-white/50"}`}>더보기</span>
          </button>
          <button
            onClick={onOpenOpt}
            aria-label={`설정/키 매핑 열기 (${km.opt})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"
          >
            <GameIcon name="options" size={18} />
            {/* v1.0.13 피드백#18 — 단축키 표기 → 기능명 통일 */}
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">설정</span>
          </button>
        </div>
        {/* v1.4.0 (#17) — 접힌 2선 창 버튼 행 (더보기 열림 시만)
         *  v1.0.14 피드백#3 — 퀘스트·콘텐츠는 더보기 밖(가방 오른쪽)으로 이동 */}
        {moreOpen && (
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-lg border border-amber-200/20 bg-black/45 p-1">
            {/* vc149 (#15) — 소리/스탯을 더보기 안으로 이동 (우상단 버튼 행 간소화) */}
            <button
              onClick={onToggleMute}
              aria-label={muted ? "소리 켜기" : "소리 끄기"}
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/90 active:scale-95"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">소리</span>
            </button>
            <button
              onClick={onOpenStat}
              aria-label={`스탯 창 열기 (${km.stat})`}
              className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${
                hud.ap > 0
                  ? "animate-pulse rounded-lg border-2 border-lime-300/70 bg-gradient-to-b from-lime-500/80 to-emerald-700/80 text-lime-100"
                  : "game-chip text-white/70"
              }`}
            >
              <GameIcon name="equip" size={18} />
              {/* v1.0.13 피드백#18 — 단축키 표기 → 기능명 통일 */}
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${hud.ap > 0 ? "text-lime-200" : "text-white/50"}`}>스탯</span>
            </button>
            {/* v1.0.14 피드백#3 — 퀘스트 로그 버튼은 가방 오른쪽 상단 행으로 이동 (위 참조) */}
            {/* v1.4.12 (#16) — 라일락의 UI 안내: 각 UI가 무슨 기능을 하는지 궁금할 때 */}
            <button
              onClick={onOpenGuide}
              aria-label="라일락의 UI 기능 안내 열기"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#a8f0d0] active:scale-95"
            >
              <GameIcon name="quest" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-emerald-300/90">도움</span>
            </button>
            <button
              onClick={onOpenBoss}
              aria-label="보스 재도전 창 열기"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffb0b0] active:scale-95"
            >
              <GameIcon name="honor" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-rose-300/80">보스</span>
            </button>
            <button
              onClick={onOpenBenefit}
              aria-label="혜택 열기 (출석부/일일 퀘스트/쿠폰)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#b8f0a0] active:scale-95"
            >
              <GameIcon name="greed" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-emerald-300/80">혜택</span>
            </button>
            {/* v1.0.14 피드백#3 — 콘텐츠 버튼은 가방 오른쪽 상단 행으로 이동 (위 참조) */}
            <button
              onClick={onOpenUnion}
              aria-label="유니온 열기 (캐릭터 배치/상점/레이드)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffd98a] active:scale-95"
            >
              <GameIcon name="trade" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-indigo-300/90">유니온</span>
            </button>
            <button
              onClick={onOpenTrade}
              aria-label="유저 거래소 열기 (보스 드롭 사고팔기)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#9be8dd] active:scale-95"
            >
              <GameIcon name="inventory" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-teal-300/90">거래소</span>
            </button>
            {/* v1.4.29 (#멀티입구복원) — v1.4.24에 철거됐던 파티 입구 복원:
             *  vc134(공개 릴레이 멀티 복원)로 채팅·파티·공동 토벌전이 다시 동작하므로
             *  죽은 기능의 입구가 아니라 실제 동작하는 멀티 콘텐츠 입구 (Y키 단축키 동일) */}
            <button
              onClick={() => { audio.sfx.uiClick(); EventBus.emit("party:toggle"); }}
              aria-label="파티 창 열기 (Y)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#a8c8ff] active:scale-95"
            >
              <GameIcon name="skills" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-sky-300/90">파티</span>
            </button>
            {/* v1.4.30 (#9 클래스룸) — 수업용 대규모 협동 미니게임 입구 (L키 단축키 동일) */}
            <button
              onClick={() => { audio.sfx.uiClick(); EventBus.emit("classroom:toggle"); }}
              aria-label="클래스룸(교실 모드) 열기 (L)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#8fe8b0] active:scale-95"
            >
              <GameIcon name="skills" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-emerald-300/90">교실</span>
            </button>
            <button
              onClick={onOpenRank}
              aria-label="랭킹창 열기 (전투력/레벨/콘텐츠 + 주간 랭커 보상)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffe08a] active:scale-95"
            >
              <GameIcon name="skull" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-amber-300/90">랭킹</span>
            </button>
            <button
              onClick={() => { audio.sfx.uiClick(); EventBus.emit("friends:toggle"); }}
              aria-label={`친구 창 열기 (${km.friends})`}
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#9fe8c0] active:scale-95"
            >
              <GameIcon name="equip" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-emerald-300/90">친구</span>
            </button>
            <button
              onClick={() => { audio.sfx.uiClick(); EventBus.emit("ui:authOpen", {}); }}
              aria-label="계정 창 열기 (클라우드 세이브)"
              className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#d3c4ff] active:scale-95"
            >
              <GameIcon name="runes" size={18} />
              <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-violet-300/90">계정</span>
            </button>
          </div>
        )}
        {/* v1.0.14 피드백#5 — 퀘스트 트래커(+재오픈 칩): 더보기 버튼이 있는 버튼행·더보기 메뉴
         *  "아래"에 위치 (컬럼 마지막 자식). 위 주석 참조 */}
        {!trackerOpen && (
          <button
            onClick={toggleTracker}
            aria-label="퀘스트창 켜기"
            className="game-chip pointer-events-auto flex h-8 w-8 items-center justify-center text-amber-200/80 active:scale-90"
          >
            <ScrollText size={15} />
          </button>
        )}
        {trackerOpen && (!tutActive || tutOverride) && (
          <div className="game-panel pointer-events-auto w-full max-w-[260px] px-2.5 py-1.5 sm:px-3 sm:py-2">
            <div className="flex items-center gap-1.5">
              <ScrollText size={13} className="shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-amber-100 sm:text-xs">{quest.title}</span>
              {/* vc149 (#16) — 퀘스트 on/off 토글을 퀘스트 창 안 헤더로 이동
               *  v1.0.16 (F3) — tap-safe: 이 버튼은 아이콘(11px)만 있어 실측 17×14px였다.
               *  WCAG 2.2 SC 2.5.8의 24px에도 못 미쳐 사실상 누를 수 없었다.
               *  ::after로 히트 영역만 44px까지 넓힌다(시각 크기·레이아웃 불변). */}
              <button
                onClick={toggleTracker}
                aria-label="퀘스트창 끄기"
                className="tap-safe shrink-0 rounded bg-black/40 px-1 py-0.5 text-amber-200/80 active:scale-90"
              >
                <ScrollText size={11} />
              </button>
              {quest.pending && (
                <span className="shrink-0 rounded bg-amber-400/25 px-1 py-px text-[8px] font-black text-amber-200">수락 대기</span>
              )}
            </div>
            <>
              {quest.desc && (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/70 sm:text-[11px]">{quest.desc}</p>
            )}
            <div className="mt-1 flex items-center justify-between gap-2">
              {quest.target > 1 && (
                <span className="text-[10px] font-bold text-emerald-300 sm:text-[11px]">
                  {quest.current} / {quest.target}
                </span>
              )}
              {quest.distance !== null && (
                <span className="ml-auto rounded bg-emerald-900/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 sm:text-[11px]">
                  목표까지 {quest.distance}m
                </span>
              )}
            </div>
            {quest.jobStory && (
              /* v4.1.3 (#전직조건표시) — 단계 수행 방법·진행도·힌트를 전부 노출 (지시 #6):
               *  기존 한 줄 배지("1/3 — 첫 수련")만으로는 완료 조건을 알 수 없었다 */
              <div className="mt-1 rounded bg-violet-500/15 px-1.5 py-1">
                <p className="truncate text-[9px] font-bold text-violet-200 sm:text-[10px]">
                  ✦ 전직 스토리 {quest.jobStory.step}/{quest.jobStory.total} — {quest.jobStory.stepTitle}
                  {quest.jobStory.need > 1 && (
                    <span className="ml-1 text-amber-300">
                      [{quest.jobStory.current}/{quest.jobStory.need}]
                    </span>
                  )}
                </p>
                {quest.jobStory.stepDesc && (
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-violet-100/85 sm:text-[10px]">
                    {quest.jobStory.stepDesc}
                  </p>
                )}
                {quest.jobStory.hint && (
                  <p className="mt-0.5 text-[9px] font-bold text-amber-300/95 sm:text-[10px]">→ {quest.jobStory.hint}</p>
                )}
              </div>
            )}
            </>
          </div>
        )}
      </div>

      {/* vc182 (지시 — "경험치 바를 메이플 처럼 맨 밑에 길게") — 화면 하단 전체 폭 EXP 바.
       *  종전엔 좌상단에 176~224px짜리 얇은 바가 있어 현재 경험치 비율이 눈에 안 들어왔다.
       *  메이플처럼 하단에 길게 깔면 "얼마나 남았나"가 한눈에 보인다.
       *  터치 조작(조이스틱·스킬 버튼)과 겹치지 않도록 z-index를 낮게 두고
       *  pointer-events:none 으로 입력을 통과시킨다.
       *  90% 이상이면 발광 + 남은 %를 숫자로 병기해 레벨업 임박을 알린다. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5]">
        <div className="relative h-[8px] w-full overflow-hidden bg-black/70 sm:h-[9px]">
          <div
            className={`h-full bg-gradient-to-b from-lime-300 via-green-500 to-green-700 transition-[width] duration-200 ${
              expPct >= 90 ? "animate-pulse" : ""
            }`}
            style={{ width: `${expPct}%` }}
          />
          {/* 바 위 텍스트 — 가운데 정렬, 얇은 테두리로 가독성 확보 */}
          <span className="absolute inset-0 flex items-center justify-center gap-1 text-[7px] font-black leading-none text-white [text-shadow:0_1px_2px_#000,0_0_2px_#000] sm:text-[8px]">
            <span className="text-lime-200">EXP</span>
            <span>{expPct.toFixed(1)}%</span>
            <span className="text-white/60">({fmt(hud.exp)} / {fmt(hud.expNext)})</span>
            {expPct >= 90 && <span className="ml-0.5 animate-pulse text-amber-300">▲</span>}
          </span>
          {/* 90% 이상 경계 발광 */}
          {expPct >= 90 && (
            <div className="pointer-events-none absolute inset-0 border-t-2 border-lime-300/80 shadow-[0_-2px_10px_rgba(163,230,53,0.7)]" />
          )}
        </div>
      </div>
    </>
  );
}