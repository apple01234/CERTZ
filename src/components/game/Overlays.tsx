"use client";

import { useEffect, useRef, useState } from "react";
import { loadSave, clearSave, type SaveData } from "@/game/config";
import { EventBus, type EndState } from "./EventBus";
import { STAGES, STAGE_SHORT, resolveStage } from "@/game/data";
import { RotateCw, Play, Save, Swords, Skull, Trophy, Home, Store, MessageCircle, Sparkles } from "lucide-react";

/** 세이브 이어하기 라벨용 스테이지 표기명 (v2.0 — 구역 체인 대응) */
const STAGE_LABEL: Record<string, string> = {
  village: "미드가르드 마을",
  forest: "숲의 신전",
  kingdom: "쿠소디아",
  alfheim: "알프헤임",
  muspelheim: "무스펠헤임",
  niflheim: "니플헤임",
  cave: "스바르트알프헤임",
  nidavellir: "니다벨리르",
  hel: "헬",
  abyss: "아뜰란티스",
};

/** 이어하기 라벨 — 구 세이브 키도 폴백 처리 */
function stageLabel(key: string): string {
  const resolved = resolveStage(key);
  return STAGE_LABEL[key] ?? STAGE_SHORT[resolved] ?? STAGES[resolved]?.subtitle ?? "여행 중";
}

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
          바다의 수호자 : 아뜰란티스
          <span className="ml-2 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 align-middle text-[9px] font-black tracking-normal text-white/65">v2.7 · 10장 90구역</span>
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
              LV{save.lv} · {save.cleared ? "클리어" : stageLabel(save.stage)}
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
  const [st, setSt] = useState<{ active: boolean; label: string; kind: "talk" | "shop" | "job" | null; x?: number; y?: number }>({
    active: false,
    label: "",
    kind: null,
  });
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = (v: { active: boolean; label: string; kind: "talk" | "shop" | "job" | null; x?: number; y?: number }) =>
      setSt({ active: !!v.active, label: v.label ?? "", kind: v.kind ?? null, x: v.x, y: v.y });
    EventBus.on("ui:interact", on);
    return () => {
      EventBus.off("ui:interact", on);
    };
  }, []);

  /* v2.1 — 프롬프트를 대상(NPC/건물) 머리 위에 고정 (월드→화면 좌표 변환, 카메라 추적) */
  useEffect(() => {
    if (!st.active || st.x === undefined || st.y === undefined) return;
    const wx = st.x;
    const wy = st.y;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      const g = (window as unknown as { __SERTZ__?: { game?: { scene: { getScene: (k: string) => { cameras?: { main?: { scrollX: number; scrollY: number; zoom: number } } } } } } }).__SERTZ__;
      const cam = g?.game?.scene.getScene("world")?.cameras?.main;
      if (!el || !cam) return;
      const zoom = cam.zoom || 1;
      const vw = window.innerWidth;
      const sx = Math.min(Math.max((wx - cam.scrollX) * zoom, 84), vw - 84);
      const sy = Math.max((wy - cam.scrollY) * zoom - 66 * zoom, 10);
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [st.active, st.x, st.y]);

  if (!st.active || !st.label) return null;

  const anchored = st.x !== undefined && st.y !== undefined;

  return (
    <button
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault();
        if (st.kind === "shop") EventBus.emit("ui:panel", { panel: "shop" });
        else EventBus.emit("input:interact");
      }}
      style={anchored ? { left: -9999, top: -9999, transform: "translate(-50%, -100%)" } : undefined}
      className={`pointer-events-auto absolute flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-black shadow-xl transition-transform active:scale-95 ${
        anchored ? "" : "bottom-24 left-1/2 -translate-x-1/2"
      } ${
        st.kind === "job"
          ? "border-amber-200/80 bg-gradient-to-b from-amber-300 to-amber-600 text-slate-900"
          : "border-emerald-200/80 bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-900"
      }`}
    >
      {st.kind === "shop" ? <Store size={16} /> : st.kind === "job" ? <Sparkles size={16} /> : <MessageCircle size={16} />}
      {st.label}
      <span className={`rounded px-1 text-[9px] font-black ${st.kind === "job" ? "bg-slate-900/85 text-amber-200" : "bg-slate-900/85 text-emerald-200"}`}>E</span>
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
          펜던트의 정령 아부디토스: &quot;바다가 기억할 이름을 지어 줘. 인어 후예의 이름이야!&quot;
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
