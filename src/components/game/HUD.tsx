"use client";

import type { HudState, QuestState } from "./EventBus";
import { Volume2, VolumeX, ScrollText } from "lucide-react";

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
      className="relative w-44 overflow-hidden rounded-full border border-black/60 bg-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] sm:w-56"
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
  onToggleMute,
}: {
  hud: HudState;
  quest: QuestState;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const expPct = Math.min(100, (hud.exp / Math.max(1, hud.expNext)) * 100);
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
          {/* 실제 픽셀아트 하트 (Zelda-like pack, CC0) */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const per = hud.maxHp / 5;
              const fill = Math.max(0, Math.min(1, (hud.hp - i * per) / per));
              const src =
                fill > 0.62
                  ? "/assets/ui/heart_full.png"
                  : fill > 0.28
                    ? "/assets/ui/heart_half.png"
                    : "/assets/ui/heart_empty.png";
              return (
                <img
                  key={i}
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  style={{ imageRendering: "pixelated" }}
                />
              );
            })}
          </div>
          <Bar value={hud.hp} max={hud.maxHp} from="#c2273a" to="#ff7a68" label={`${hud.hp} / ${hud.maxHp}`} />
          <Bar value={hud.mp} max={hud.maxMp} from="#1e6fb8" to="#5ec5ff" label={`${hud.mp} / ${hud.maxMp}`} height={10} />
          {/* EXP 얇은 바 */}
          <div className="relative h-[7px] w-44 overflow-hidden rounded-full border border-black/60 bg-black/60 sm:w-56">
            <div
              className="h-full bg-gradient-to-b from-lime-300 to-green-600 transition-[width] duration-200"
              style={{ width: `${expPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 우상단: 퀘스트 + 사운드 */}
      <div className="absolute right-2 top-2 flex max-w-[46%] flex-col items-end gap-1.5 sm:right-3 sm:top-3">
        <button
          onClick={onToggleMute}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <div className="pointer-events-none w-full rounded-lg border border-amber-200/40 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2">
          <div className="flex items-center gap-1.5">
            <ScrollText size={13} className="shrink-0 text-amber-300" />
            <span className="truncate text-[11px] font-bold text-amber-100 sm:text-xs">{quest.title}</span>
          </div>
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
        </div>
      </div>
    </>
  );
}
