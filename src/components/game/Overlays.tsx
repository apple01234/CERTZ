"use client";

import { useEffect, useState } from "react";
import { loadSave, clearSave, type SaveData } from "@/game/config";
import { EventBus, type EndState } from "./EventBus";
import { STAGES } from "@/game/data";
import { RotateCw, Play, Save, Swords, Skull, Trophy, Home, Store, MessageCircle, Sparkles } from "lucide-react";

/** 세이브 이어하기 라벨용 스테이지 표기명 */
const STAGE_LABEL: Record<string, string> = {
  village: "시작 마을",
  forest: "뿌리숲",
  alfheim: "알프헤임",
  cave: "동굴",
  niflheim: "니플헤임",
  abyss: "심연의 왕좌",
};

/* ---------- 타이틀 화면 ---------- */

export function TitleScreen() {
  // 클라이언트 전용 컴포넌트(ssr:false)라 지연 초기화로 안전
  const [save, setSave] = useState<SaveData | null>(() => loadSave());

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-transparent px-4">
      <div className="mb-1 text-center">
        <h1 className="text-5xl font-black tracking-[0.18em] text-amber-300 [text-shadow:0_3px_0_#7a3c00,0_6px_18px_rgba(0,0,0,0.9)] sm:text-7xl">
          SERTZ
        </h1>
        <p className="mt-1 text-sm font-bold tracking-widest text-sky-200/90 [text-shadow:0_2px_4px_#000] sm:text-base">
          이그드라실 : 아뜰란티스
          <span className="ml-2 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 align-middle text-[9px] font-black tracking-normal text-white/65">v1.8</span>
        </p>
      </div>

      <div className="mt-8 flex w-56 flex-col gap-3 sm:w-64">
        <button
          onClick={() => EventBus.emit("game:new")}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 text-base font-black text-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Play size={18} />
          새로운 모험
        </button>
        {save && (
          <button
            onClick={() => EventBus.emit("game:continue", save)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-sky-200/70 bg-gradient-to-b from-sky-600 to-blue-900 px-4 py-3 text-base font-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Save size={18} />
            이어하기
            <span className="text-[10px] font-bold text-sky-200">
              LV{save.lv} · {save.cleared ? "클리어" : (STAGE_LABEL[save.stage] ?? STAGES[save.stage as keyof typeof STAGES]?.subtitle ?? "여행 중")}
            </span>
          </button>
        )}
        {save && (
          <button
            onClick={() => {
              clearSave();
              setSave(null);
            }}
            className="mx-auto text-[11px] font-bold text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            저장 데이터 삭제
          </button>
        )}
      </div>

      <div className="absolute bottom-3 flex flex-col items-center gap-1 text-center">
        <p className="text-[10px] font-bold text-white/45 sm:text-[11px]">
          이동: 방향키 / 왼쪽 화면 드래그 · 공격: X · 스킬: Z, C · 물약: Q, E
        </p>
        <p className="max-w-[92%] text-[8px] leading-relaxed text-white/30 sm:text-[9px]">
          Art: Zelda-like by ArMM1998 · Slash by Cethiel · Portal by varkalandar (CC-BY) · Kenney · LPC Wolf by
          williamthompsonj (CC-BY) · Sotrak by gilgaphoenixignis (CC-BY) · Music: Juhani Junkala · SFX: Rubberduck (CC0)
        </p>
      </div>
    </div>
  );
}

/* ---------- 배너 ---------- */

export function Banner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-30 flex justify-center">
      <div className="animate-[bannerPop_2.3s_ease-out_forwards] rounded-lg border border-amber-200/50 bg-black/70 px-6 py-2.5 shadow-xl">
        <p className="text-lg font-black tracking-wide text-amber-200 [text-shadow:0_2px_4px_#000] sm:text-xl">
          {text}
        </p>
      </div>
    </div>
  );
}

/* ---------- 보스 HP바 ---------- */

export function BossBar({ boss }: { boss: { name: string; hp: number; maxHp: number } | null }) {
  if (!boss) return null;
  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
      <div className="w-[72%] max-w-xl rounded-lg border border-purple-300/50 bg-black/70 px-3 py-2 shadow-xl backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-black tracking-wide text-purple-200 [text-shadow:0_1px_3px_#000] sm:text-sm">
            {boss.name}
          </span>
          <span className="text-[10px] font-bold text-white/70">{Math.ceil(pct)}%</span>
        </div>
        <div className="h-3.5 overflow-hidden rounded-full border border-black/70 bg-black/70">
          <div
            className="h-full bg-gradient-to-b from-fuchsia-400 to-purple-800 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- 가로 모드 안내 (모바일 세로 감지) ---------- */

export function RotatePrompt({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="rotate-prompt absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-8 text-center">
      <RotateCw size={48} className="animate-spin-slow text-amber-300" />
      <p className="text-lg font-black text-white">기기를 가로로 돌려주세요</p>
      <p className="text-xs font-bold text-white/60">
        SERTZ는 가로 화면에 최적화된 액션 RPG입니다
      </p>
    </div>
  );
}

/* ---------- 엔드 화면 ---------- */

export function EndScreen({ end }: { end: EndState }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}분 ${s % 60}초`;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl border-2 border-white/15 bg-slate-950/95 p-6 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          {end.victory ? (
            <Trophy size={44} className="text-amber-300" />
          ) : (
            <Skull size={44} className="text-rose-400" />
          )}
        </div>
        <h2 className="text-2xl font-black text-white">
          {end.victory ? "세계수를 구원했다!" : "쓰러졌다…"}
        </h2>
        <p className="mt-1 text-xs font-bold text-white/60">
          {end.victory
            ? "심연의 군주를 물리치고 세계수의 빛을 되찾았다"
            : "하지만 모험은 끝나지 않았다"}
        </p>

        <div className="my-5 grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Swords size={14} />} label="처치" value={`${end.kills}`} />
          <Stat icon={<span className="text-[11px] font-black">LV</span>} label="레벨" value={`${end.lv}`} />
          <Stat icon={<RotateCw size={14} />} label="시간" value={fmt(end.playTime)} />
        </div>

        <div className="flex flex-col gap-2">
          {end.victory ? (
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 text-sm font-black text-slate-900 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Home size={16} />
              타이틀로 돌아가기
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  EventBus.emit("respawn");
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Play size={16} />
                부활하기
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-black text-white/80 transition-colors hover:bg-white/10"
              >
                <Home size={14} />
                타이틀로
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 py-2">
      <div className="flex items-center justify-center gap-1 text-amber-200">{icon}</div>
      <div className="mt-0.5 text-sm font-black text-white">{value}</div>
      <div className="text-[9px] font-bold text-white/50">{label}</div>
    </div>
  );
}

/* ---------- 상호작용 프롬프트 (E키 상호작용 — NPC 대화/상점 공용) ---------- */

export function InteractPrompt() {
  const [st, setSt] = useState<{ active: boolean; label: string; kind: "talk" | "shop" | null }>({
    active: false,
    label: "",
    kind: null,
  });

  useEffect(() => {
    const on = (v: { active: boolean; label: string; kind: "talk" | "shop" | null }) =>
      setSt({ active: !!v.active, label: v.label ?? "", kind: v.kind ?? null });
    EventBus.on("ui:interact", on);
    return () => {
      EventBus.off("ui:interact", on);
    };
  }, []);

  if (!st.active || !st.label) return null;

  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        if (st.kind === "shop") EventBus.emit("ui:panel", { panel: "shop" });
        else EventBus.emit("input:interact");
      }}
      className="pointer-events-auto absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 border-emerald-200/80 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-[13px] font-black text-slate-900 shadow-xl transition-transform active:scale-95"
    >
      {st.kind === "shop" ? <Store size={16} /> : <MessageCircle size={16} />}
      {st.label}
      <span className="rounded bg-slate-900/85 px-1 text-[9px] font-black text-emerald-200">E</span>
    </button>
  );
}

/* ---------- 인트로: 이름 정하기 (책장 넘기기 대신 마을 우물에서 플레이 중 입력) ---------- */

export function NamePanel() {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");

  useEffect(() => {
    const ask = () => {
      setOpen(true);
      setVal("");
    };
    EventBus.on("name:ask", ask);
    return () => {
      EventBus.off("name:ask", ask);
    };
  }, []);

  if (!open) return null;

  const confirm = () => {
    const name = val.trim();
    if (!name) return;
    setOpen(false);
    EventBus.emit("name:set", { name });
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-amber-200/70 bg-slate-950/95 p-5 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-300" />
          <span className="text-base font-black text-amber-300">이름을 정해 주자!</span>
        </div>
        <p className="mb-3 text-[12px] font-bold leading-relaxed text-white/70">
          요정 아리: &quot;세계수가 기억할 이름을 지어 줘. 모험가의 이름이야!&quot;
        </p>
        <input
          autoFocus
          value={val}
          maxLength={8}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
          placeholder="1~8자 (한글/영문/숫자)"
          className="w-full rounded-xl border-2 border-white/25 bg-slate-900 px-3 py-3 text-lg font-black tracking-wider text-white outline-none placeholder:text-white/30 focus:border-amber-300"
        />
        <div className="mt-1 text-right text-[10px] font-bold text-white/40">{val.length}/8</div>
        <button
          onClick={confirm}
          disabled={!val.trim()}
          className="mt-2 w-full rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 text-sm font-black text-slate-900 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
        >
          이 이름으로 모험 시작!
        </button>
      </div>
    </div>
  );
}
