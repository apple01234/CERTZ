import React from "react";
"use client";

import type { HudState, QuestState } from "./EventBus";
import { classDef, classLabel } from "@/game/classes";
import { BUFF_DEFS, type BuffKey } from "@/game/data";
import { Volume2, VolumeX, ScrollText, Backpack, Sparkles, Gauge, ListChecks, Settings, Bot } from "lucide-react";
import { EventBus } from "./EventBus";

/** 버프 아이콘 + 남은 시간 바 (v1.9 BM) */
function BuffChip({ buff }: { buff: HudState["buffs"][number] }) {
  const def = BUFF_DEFS[buff.key as BuffKey];
  if (!def) return null;
  const pct = Math.max(0, Math.min(100, (buff.remain / buff.total) * 100));
  const sec = Math.ceil(buff.remain / 1000);
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-md border border-white/25 bg-black/60">
      <img src={`/assets/${def.icon}.png`} alt={def.name} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
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
  canAutoHunt,
  autoHunt,
  onToggleMute,
  onOpenInv,
  onOpenJob,
  onOpenStat,
  onOpenQuest,
  onOpenOpt,
}: {
  hud: HudState;
  quest: QuestState;
  muted: boolean;
  /** 전직/승격 가능 — 버튼 강조(펄스) */
  canJob: boolean;
  /** 전직 패널 접근 가능 (승격 가능 or 2차 이상 자유전직) */
  jobAvail: boolean;
  /** v2.5 자동사냥 (펫 보유 시) */
  canAutoHunt: boolean;
  autoHunt: boolean;
  onToggleMute: () => void;
  onOpenInv: () => void;
  onOpenJob: () => void;
  /** 스탯 창 (T) — AP 남으면 강조 */
  onOpenStat: () => void;
  /** 퀘스트 로그 (J) */
  onOpenQuest: () => void;
  /** 설정/키 매핑 (O) */
  onOpenOpt: () => void;
}) {
  const expPct = Math.min(100, (hud.exp / Math.max(1, hud.expNext)) * 100);
  /* v3.0.2 (지시 #4/#5) — 퀘스트 트래커 축소/펼침 토글 (모바일에서 너무 큰 문제) */
  const [trackerOpen, setTrackerOpen] = React.useState(() => localStorage.getItem("sertz.trackerOpen") !== "0");
  const toggleTracker = () => {
    setTrackerOpen((v) => {
      localStorage.setItem("sertz.trackerOpen", v ? "0" : "1");
      return !v;
    });
  };
  return (
    <>
      {/* 좌상단: 상태 */}
      <div className="pointer-events-none absolute left-2 top-2 flex items-start gap-2 sm:left-3 sm:top-3">
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-amber-300/90 bg-gradient-to-b from-slate-800 to-slate-900 shadow-lg sm:h-12 sm:w-12">
          <span className="text-[8px] font-bold leading-none text-amber-200">LV</span>
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
                className="w-fit rounded-md border px-1.5 py-0.5 text-[10px] font-black backdrop-blur-sm"
                style={{ color: d.color, borderColor: `${d.color}55`, background: "rgba(0,0,0,0.55)" }}
              >
                {classLabel(hud.cls)}
              </span>
            ) : null;
          })()}
          <Bar value={hud.hp} max={hud.maxHp} from="#c2273a" to="#ff7a68" label={`${hud.hp} / ${hud.maxHp}`} />
          <Bar value={hud.mp} max={hud.maxMp} from="#1e6fb8" to="#5ec5ff" label={`${hud.mp} / ${hud.maxMp}`} height={10} />
          {/* EXP 얇은 바 */}
          <div className="sertz-gauge relative h-[7px] w-44 overflow-hidden rounded-full border border-black/60 bg-black/60 sm:w-56">
            <div
              className="h-full bg-gradient-to-b from-lime-300 to-green-600 transition-[width] duration-200"
              style={{ width: `${expPct}%` }}
            />
          </div>
        {/* 버프 아이콘 (v1.9 BM — 남은 시간 바) */}
        {hud.buffs.length > 0 && (
          <div className="flex items-center gap-1">
            {hud.buffs.map((b) => (
              <BuffChip key={b.key} buff={b} />
            ))}
          </div>
        )}
        {/* 골드 + 공격/방어 (2D MMORPG 기본 요소) */}
          <div className="mt-0.5 flex items-center gap-1">
            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-amber-300 backdrop-blur-sm">
              { }
              <img src="/assets/item_coin.png" alt="" className="h-3.5 w-3.5" style={{ imageRendering: "pixelated" }} />
              {hud.gold}
            </span>
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-rose-300 backdrop-blur-sm">
              공격 {hud.atkTotal}
            </span>
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-sky-300 backdrop-blur-sm">
              방어 {hud.defTotal}
            </span>
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-yellow-200 backdrop-blur-sm">
              크리 {hud.critRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 우상단: 사운드/가방 + 퀘스트 */}
      <div className="absolute right-2 top-2 flex max-w-[46%] flex-col items-end gap-1.5 sm:right-3 sm:top-3">
        <div className="flex items-center gap-1.5">
          {/* v2.5 — 자동사냥 토글 (펫 보유 시만 표시) */}
          {canAutoHunt && (
            <button
              onClick={() => EventBus.emit("rpg:autohunt", {})}
              aria-label={autoHunt ? "자동사냥 끄기" : "자동사냥 켜기"}
              className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors active:scale-95 ${
                autoHunt
                  ? "animate-pulse border-lime-300/80 bg-gradient-to-b from-lime-600/90 to-emerald-800/90 text-lime-100"
                  : "border-white/20 bg-black/55 text-white/80 hover:bg-black/75"
              }`}
            >
              <Bot size={17} />
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${autoHunt ? "text-lime-200" : "text-white/60"}`}>자동</span>
            </button>
          )}
          <button
            onClick={onToggleMute}
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <button
            onClick={onOpenInv}
            aria-label="가방 열기 (I)"
            className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200/40 bg-black/55 text-sky-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
          >
            <Backpack size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/70">I</span>
          </button>
          {jobAvail && (
            <button
              onClick={onOpenJob}
              aria-label="전직 열기 (K)"
              className={`pointer-events-auto relative flex h-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-transform active:scale-95 ${
                canJob
                  ? "animate-pulse border-amber-300/70 bg-gradient-to-b from-amber-500/80 to-amber-700/80 text-amber-100 hover:from-amber-400/90"
                  : "border-white/20 bg-black/55 text-white/70 hover:bg-black/75"
              }`}
            >
              <Sparkles size={17} />
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${canJob ? "text-amber-200" : "text-white/50"}`}>전직</span>
            </button>
          )}
          {/* v1.9: 스탯(T) / 퀘스트 로그(J) / 설정·키 매핑(O) */}
          <button
            onClick={onOpenStat}
            aria-label="스탯 창 열기 (T)"
            className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors active:scale-95 ${
              hud.ap > 0
                ? "animate-pulse border-lime-300/70 bg-gradient-to-b from-lime-500/80 to-emerald-700/80 text-lime-100"
                : "border-white/20 bg-black/55 text-white/70 hover:bg-black/75"
            }`}
          >
            <Gauge size={17} />
            <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${hud.ap > 0 ? "text-lime-200" : "text-white/50"}`}>T</span>
          </button>
          <button
            onClick={onOpenQuest}
            aria-label="퀘스트 로그 열기 (J)"
            className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
          >
            <ListChecks size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">J</span>
          </button>
          <button
            onClick={onOpenOpt}
            aria-label="설정/키 매핑 열기 (O)"
            className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
          >
            <Settings size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">O</span>
          </button>
        </div>
        {/* v3.0.23 (#56) — 퀘스트 알림을 더 아래로: 모바일 간격 mt-8→mt-20 (상단 버튼행·보스바와 겹침 방지), PC는 mt-1 유지 */}
        <div className="pointer-events-auto mt-20 w-full rounded-lg border border-amber-200/40 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm sm:mt-1 sm:px-3 sm:py-2">
          {/* v3.0.4 (지시 #5) — 모바일에서 퀘스트창 키고끄기: 헤더 전체가 토글 버튼 (터치 영역 확대) */}
          <div
            role="button"
            tabIndex={0}
            /* v3.0.4 — onPointerDown 단독 (onClick 병용 시 탭 1회에 2번 토글되는 문제 방지) */
            onPointerDown={(e) => {
              e.preventDefault();
              toggleTracker();
            }}
            className="flex cursor-pointer items-center gap-1.5 select-none"
            aria-label={trackerOpen ? "퀘스트 트래커 접기" : "퀘스트 트래커 펼치기"}
          >
            <ScrollText size={13} className="shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-amber-100 sm:text-xs">{quest.title}</span>
            {quest.pending && (
              <span className="shrink-0 rounded bg-amber-400/25 px-1 py-px text-[8px] font-black text-amber-200">수락 대기</span>
            )}
            <span
              className="flex h-7 w-9 shrink-0 items-center justify-center rounded border border-white/25 bg-black/50 text-[11px] font-black leading-4 text-white/80 active:scale-95"
            >
              {trackerOpen ? "▲" : "▼"}
            </span>
          </div>
          {trackerOpen && (
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
                <p className="mt-1 truncate rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-200 sm:text-[10px]">
                  ✦ 전직 스토리 {quest.jobStory.step}/{quest.jobStory.total} — {quest.jobStory.stepTitle}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
