"use client";

import React from "react";

import type { HudState, QuestState } from "./EventBus";
import { classDef, classLabel } from "@/game/classes";
import { BUFF_DEFS, type BuffKey } from "@/game/data";
import { loadKeyMap } from "@/game/keymap"; // v1.0.5 — HUD 키 배지가 키맵 재배치를 따라가도록
import { Volume2, VolumeX, ScrollText, Backpack, Sparkles, Gauge, ListChecks, Settings, Bot, Crown, Gift, Swords, Users, Repeat, Trophy } from "lucide-react";
import { EventBus } from "./EventBus";

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
  onOpenBoss,
  onOpenBenefit,
  onOpenContent,
  onOpenOpt,
  onOpenUnion,
  onOpenTrade,
  onOpenRank, // v1.3.0 (#7) — 랭킹창
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
}) {
  /* v1.0.5 — 키맵 재배치 시 HUD 키 배지·aria도 함께 갱신 (I/T/J/K/O 하드코딩 제거) */
  const km = loadKeyMap();
  const expPct = Math.min(100, (hud.exp / Math.max(1, hud.expNext)) * 100);
  /* v3.0.2 (지시 #4/#5) — 퀘스트 트래커 축소/펼침 토글 (모바일에서 너무 큰 문제) */
  const [trackerOpen, setTrackerOpen] = React.useState(() => localStorage.getItem("sertz.trackerOpen") !== "0");
  const toggleTracker = () => {
    setTrackerOpen((v) => {
      localStorage.setItem("sertz.trackerOpen", v ? "0" : "1");
      return !v;
    });
  };
  /* v1.1.1 (#1 가림) — 튜토리얼 진행 중엔 퀘스트 트래커를 숨긴다.
   *  튜토리얼 패널(Phaser 캔버스 상단 중앙)과 트래커(우상단 DOM)가 모바일 가로에서 겹쳐
   *  "튜토리얼 UI가 다른 UI에 가려진다"는 지적의 주범. 트래커는 튜토리얼 끝나면 복귀. */
  const [tutActive, setTutActive] = React.useState(false);
  React.useEffect(() => {
    const onTut = (v: { active: boolean }) => setTutActive(!!v?.active);
    EventBus.on("tut:active", onTut);
    return () => { EventBus.off("tut:active", onTut); };
  }, []);
  return (
    <>
      {/* 좌상단: 상태 — v1.0.20 게임형 LV 플레이트 */}
      <div className="pointer-events-none absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] flex items-start gap-2 sm:left-3 sm:top-3">
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
          {/* 골드 + 공격/방어 (2D MMORPG 기본 요소) — v1.0.20 게임형 칩 */}
          <div className="mt-0.5 flex items-center gap-1">
            <span className="game-chip flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-black text-[#ffd98a]">
              { }
              <img src="/assets/item_coin.webp" alt="" className="h-3.5 w-3.5" style={{ imageRendering: "pixelated" }} />
              {hud.gold}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#ffb0b0]">
              공격 {hud.atkTotal}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#a8e0ff]">
              방어 {hud.defTotal}
            </span>
            <span className="game-chip px-1.5 py-0.5 text-[11px] font-black text-[#ffe49a]">
              크리 {hud.critRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 우상단: 사운드/가방 + 퀘스트 */}
      <div className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] flex max-w-[46%] flex-col items-end gap-1.5 sm:right-3 sm:top-3">
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          {/* v1.1.0 (#2) — 퀘스트창 on/off 버튼: 접기가 아니라 아예 숨김/표시 (유저 지시) */}
          <button
            onClick={toggleTracker}
            aria-label={trackerOpen ? "퀘스트창 끄기" : "퀘스트창 켜기"}
            className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${
              trackerOpen ? "game-chip text-amber-200" : "game-chip text-white/45"
            }`}
          >
            <ScrollText size={17} />
          </button>
          {/* v2.5 — 자동사냥 토글 (펫 보유 시만 표시) · v1.0.20 flex-wrap: 375px 세로에서 버튼행 넘침 방지 */}
          {canAutoHunt && (
            <button
              onClick={() => EventBus.emit("rpg:autohunt", {})}
              aria-label={autoHunt ? "자동사냥 끄기" : "자동사냥 켜기"}
              className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${
                autoHunt
                  ? "animate-pulse rounded-lg border-2 border-lime-300/80 bg-gradient-to-b from-lime-600/90 to-emerald-800/90 text-lime-100"
                  : "game-chip text-white/80"
              }`}
            >
              <Bot size={17} />
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${autoHunt ? "text-lime-200" : "text-white/60"}`}>자동</span>
            </button>
          )}
          <button
            onClick={onToggleMute}
            aria-label={muted ? "소리 켜기" : "소리 끄기"}
            className="game-chip pointer-events-auto flex h-9 w-9 items-center justify-center text-white/90 active:scale-95"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          {/* v1.3.0 (#2) — HUD ☰ 버튼 제거 (유저 지시 "선 3개 짜리 ui저거 없애").
           *  메뉴 나가기 기능은 설정(⚙) → 메뉴 화면 카드로 이동 — 기능 유지, UI 간소화 */}
          <button
            onClick={onOpenInv}
            aria-label={`가방 열기 (${km.bag})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#a8e0ff] active:scale-95"
          >
            <Backpack size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/70">{km.bag}</span>
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
              <Sparkles size={17} />
              <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${canJob ? "text-amber-200" : "text-white/50"}`}>전직</span>
            </button>
          )}
          {/* v1.9: 스탯/퀘스트 로그/설정 — v1.0.5 키맵 연동 배지 */}
          <button
            onClick={onOpenStat}
            aria-label={`스탯 창 열기 (${km.stat})`}
            className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${
              hud.ap > 0
                ? "animate-pulse rounded-lg border-2 border-lime-300/70 bg-gradient-to-b from-lime-500/80 to-emerald-700/80 text-lime-100"
                : "game-chip text-white/70"
            }`}
          >
            <Gauge size={17} />
            <span className={`absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black ${hud.ap > 0 ? "text-lime-200" : "text-white/50"}`}>{km.stat}</span>
          </button>
          <button
            onClick={onOpenQuest}
            aria-label={`퀘스트 로그 열기 (${km.quest})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"
          >
            <ListChecks size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">{km.quest}</span>
          </button>
          {/* v3.0.25 — 보스 재도전 전용 창 버튼 (퀘스트창과 분리) */}
          <button
            onClick={onOpenBoss}
            aria-label="보스 재도전 창 열기"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffb0b0] active:scale-95"
          >
            <Crown size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-rose-300/80">보스</span>
          </button>
          {/* v4.0.0 — 혜택 버튼 (출석부/일일 퀘스트/쿠폰/이세카이 허브) */}
          <button
            onClick={onOpenBenefit}
            aria-label="혜택 열기 (출석부/일일 퀘스트/쿠폰)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#b8f0a0] active:scale-95"
          >
            <Gift size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-emerald-300/80">혜택</span>
          </button>
          {/* v1.0.8 — 무한 콘텐츠 허브 버튼 (탑/시련/제작/심연상점/환생) */}
          <button
            onClick={onOpenContent}
            aria-label="콘텐츠 열기 (심연의 탑/일일 시련/제작/심연 상점/환생)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#d0b0ff] active:scale-95"
          >
            <Swords size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-purple-300/80">콘텐츠</span>
          </button>
          {/* v1.0.18 — 유니온 패널 버튼 (캐릭터 배치/상점/버프/레이드) */}
          <button
            onClick={onOpenUnion}
            aria-label="유니온 열기 (캐릭터 배치/상점/레이드)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffd98a] active:scale-95"
          >
            <Users size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-indigo-300/90">유니온</span>
          </button>
          {/* v1.2.0 (#2) — 유저 거래소 직접 진입 버튼 (보스 드롭 사고팔기) */}
          <button
            onClick={onOpenTrade}
            aria-label="유저 거래소 열기 (보스 드롭 사고팔기)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#9be8dd] active:scale-95"
          >
            <Repeat size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-teal-300/90">거래소</span>
          </button>
          {/* v1.3.0 (#7) — 랭킹창 버튼 (전투력/레벨/콘텐츠 랭킹 + 주간 랭커 보상) */}
          <button
            onClick={onOpenRank}
            aria-label="랭킹창 열기 (전투력/레벨/콘텐츠 + 주간 랭커 보상)"
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffe08a] active:scale-95"
          >
            <Trophy size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-amber-300/90">랭킹</span>
          </button>
          <button
            onClick={onOpenOpt}
            aria-label={`설정/키 매핑 열기 (${km.opt})`}
            className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"
          >
            <Settings size={17} />
            <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/90 px-1 text-[8px] font-black text-white/50">{km.opt}</span>
          </button>
        </div>
        {/* v3.0.23 (#56) — 퀘스트 알림을 더 아래로: 모바일 간격 mt-8→mt-20 (상단 버튼행·보스바와 겹침 방지), PC는 mt-1 유지
         *  v1.1.0 (#2) — "접는 형식 말고 버튼으로 아예 키고 끌 수 있게": 트래커 전체를 버튼 토글로 완전히 숨김/표시 */}
        {trackerOpen && !tutActive && (
        <div className="game-panel pointer-events-auto mt-20 w-full px-2.5 py-1.5 sm:mt-1 sm:px-3 sm:py-2">
          <div className="flex items-center gap-1.5">
            <ScrollText size={13} className="shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-amber-100 sm:text-xs">{quest.title}</span>
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
    </>
  );
}
