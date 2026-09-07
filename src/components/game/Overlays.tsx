"use client";

import { useEffect, useRef, useState } from "react";
import { loadSave, clearSave, type SaveData } from "@/game/config";
import { EventBus, type EndState, type RewardPopupState } from "./EventBus";
import { STAGES, STAGE_SHORT, resolveStage } from "@/game/data";
import { RotateCw, Play, Save, Swords, Skull, Trophy, Home, Store, MessageCircle, Sparkles, Smartphone } from "lucide-react";
import { useKeyGate, swallowKeys } from "./inputGate"; // v4.1.0

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
  abyss: "세계수의 뿌리",
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
          이그드라실 : 아홉 왕국
          <span className="ml-2 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 align-middle text-[9px] font-black tracking-normal text-white/65">v4.1.3 · 바르가 업데이트 — 균열 수비전·피규어 가챠·배지·룬 합성·성좌·출석부·일일 퀘스트·쿠폰·광고 보상·긴급 귀환 — 게임 1개 · 10장 90구역</span>
        </p>
      </div>

      <div className="mt-8 flex w-56 flex-col gap-3 sm:w-64">
        <button
          onClick={() => EventBus.emit("game:new")}
          className="sertz-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Play size={18} />
          새로운 모험
        </button>
        {save && (
          <button
            onClick={() => EventBus.emit("game:continue", save)}
            className="sertz-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
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
        {/* v3.2.0 — 폰에서 놀고 싶은 유저를 위한 APK 다운로드 안내 (타이틀에서 바로 찾기) */}
        <a
          href="/apk-guide.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-1 flex items-center gap-1.5 text-[11px] font-bold text-sky-300/70 underline underline-offset-2 transition-colors hover:text-sky-200"
        >
          <Smartphone size={13} />
          폰용 APK 다운로드
        </a>
      </div>

      <div className="absolute bottom-3 flex flex-col items-center gap-1 text-center">
        <p className="text-[10px] font-bold text-white/45 sm:text-[11px]">
          이동: 방향키 / 왼쪽 화면 드래그 · 공격: X · 스킬: Z, C · 물약: Q, E
        </p>
        <p className="max-w-[92%] text-[8px] leading-relaxed text-white/30 sm:text-[9px]">
          Art: Zelda-like by ArMM1998 · Slash by Cethiel · Portal by varkalandar (CC-BY) · Kenney · LPC Wolf by
          williamthompsonj (CC-BY) · Sotrak by gilgaphoenixignis (CC-BY) · Music: Kevin MacLeod (incompetech.com, CC-BY 4.0) · SFX: Rubberduck (CC0)
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
  /* v4.1.3 (#보스바모바일) — 가로 모바일 축소 (지시 #7 "모바일 기준 보스 hp바가 너무 커서 화면을 가림").
   *  기존 sm: 분기는 "폭 640px+" 기준이라 가로 폰(보통 640~930px)에서 데스크톱 크기(폭 72%·두꺼운 바)
   *  이 적용됐다. 게임이 가로 모드 필수라 모바일 유저가 항상 큰 바를 보던 문제.
   *  → 터치 포인터 + 낮은 뷰포트 높이(가로 폰 실측 320~460px)면 컴팩트 판 적용, 데스크톱은 현행 유지. */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (max-height: 560px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  if (!boss) return null;
  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1.5 z-30 flex justify-center sm:top-3">
      <div
        className={
          compact
            ? "w-[44%] max-w-[280px] rounded-md border border-purple-300/50 bg-black/65 px-1.5 py-0.5 shadow-lg backdrop-blur-sm"
            : "w-[46%] max-w-[400px] rounded-md border border-purple-300/50 bg-black/70 px-2 py-1.5 shadow-xl backdrop-blur-sm sm:w-[72%] sm:max-w-xl sm:rounded-lg sm:px-3 sm:py-2"
        }
      >
        <div className={compact ? "mb-0.5 flex items-center justify-between" : "mb-1 flex items-center justify-between"}>
          <span
            className={
              compact
                ? "max-w-[70%] truncate text-[9px] font-black tracking-wide text-purple-200 [text-shadow:0_1px_3px_#000]"
                : "truncate text-[10px] font-black tracking-wide text-purple-200 [text-shadow:0_1px_3px_#000] sm:text-sm"
            }
          >
            {boss.name}
          </span>
          <span className={compact ? "text-[8px] font-bold text-white/70" : "text-[9px] font-bold text-white/70 sm:text-[10px]"}>
            {Math.ceil(pct)}%
          </span>
        </div>
        <div className={compact ? "h-1.5 overflow-hidden rounded-full border border-black/70 bg-black/70" : "h-2 overflow-hidden rounded-full border border-black/70 bg-black/70 sm:h-3.5"}>
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
  /* v3.0 (사용자 지시 #3) — PC(마우스)에서는 NPC 머리 위 부유 버튼이 위치가 어중간해 보여
   *  화면 하단 중앙 고정 칩([E] 라벨)으로 교체. 터치 기기는 기존 NPC 머리 위 버튼 유지 */
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900)
  );

  useEffect(() => {
    const reevaluate = () =>
      setIsTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900);
    reevaluate();
    const onTouch = () => setIsTouch(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    window.addEventListener("resize", reevaluate);
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("resize", reevaluate);
    };
  }, []);

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
    if (!isTouch || !st.active || st.x === undefined || st.y === undefined) return;
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

  /* v3.0 (#3) — PC: 하단 중앙 고정 칩 / 터치: NPC 머리 위 부유 버튼 */
  if (!isTouch) {
    return (
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          if (st.kind === "shop") EventBus.emit("ui:panel", { panel: "shop" });
          else EventBus.emit("input:interact");
        }}
        className={`pointer-events-auto absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-black shadow-xl transition-transform active:scale-95 ${
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
      className={`pointer-events-auto absolute flex items-center gap-1.5 rounded-full border-2 px-5 py-2.5 text-[13px] font-black shadow-xl transition-transform active:scale-95 ${
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

/* ---------- v3.0.16 — 퀘스트 보상 수령 팝업 (메이플식 보상 내역 창) ---------- */

export function RewardPopup() {
  const [st, setSt] = useState<RewardPopupState | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const on = (v: RewardPopupState) => {
      setSt(v);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSt(null), 5200);
    };
    EventBus.on("reward:show", on);
    return () => {
      EventBus.off("reward:show", on);
      window.clearTimeout(timer);
    };
  }, []);
  if (!st) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 z-30 flex justify-center px-4 sm:top-20">
      {/* v3.0.23 (#56) — ① 알림 표시를 더 아래로(top-14→top-28) ② 카드에 pointer-events-auto 부여 —
          컨테이너가 pointer-events-none이라 X를 누를 수 없던 버그 수정 */}
      <div className="pointer-events-auto w-[min(92vw,330px)] animate-[rewardPop_0.24s_ease-out] rounded-xl border-2 border-amber-200/70 bg-slate-950/95 p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-black text-amber-200">
            <Sparkles size={14} className="shrink-0" />
            <span className="truncate">{st.title}</span>
          </p>
          <button
            onClick={() => setSt(null)}
            aria-label="보상 팝업 닫기"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/70 hover:bg-black/70"
          >
            ✕
          </button>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-black/40 px-2.5 py-2">
          {st.lines.map((l, i) => (
            <p key={i} className="text-[12px] font-black" style={{ color: l.color ?? "#ffffff" }}>
              {l.text}
            </p>
          ))}
        </div>
        <p className="mt-1 text-right text-[9px] font-bold text-white/40">보상이 인벤토리에 지급되었습니다</p>
      </div>
    </div>
  );
}

/* ---------- 인트로: 이름 정하기 (책장 넘기기 대신 마을 우물에서 플레이 중 입력) ---------- */

export function NamePanel() {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const gate = useKeyGate(); // v4.1.0 — 이름 입력 중 게임 단축키 차단

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
          <span className="text-base font-black text-amber-300">이름을 정해라</span>
        </div>
        <p className="mb-3 text-[12px] font-bold leading-relaxed text-white/70">
          룬 정령 이그니: &quot;그 이름, 세계수에 새겨질 거야. 모험가의 이름을 지어 줘.&quot;
        </p>
        <input
          ref={gate}
          {...swallowKeys}
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

/* ================= v4.0.0 — 바르가 수비전 오버레이 =================
 *  웨이브 클리어마다 3성 카드 선택 + 실버 상점 + 상단 수비전 HUD */

type GateCardState = {
  open: boolean;
  wave: number;
  silver: number;
  cards: { id: string; tier: 1 | 2 | 3; name: string; desc: string }[];
};

const GATE_SHOP_ITEMS = [
  { id: "sh_heal", name: "응급 키트", desc: "HP 60% 회복", cost: 40, icon: "✚" },
  { id: "sh_bomb", name: "차원 폭탄", desc: "전 적 대미지", cost: 90, icon: "☄" },
  { id: "sh_repair", name: "게이트 수리", desc: "게이트 HP 30% 복구", cost: 120, icon: "⛨" },
  { id: "sh_mp", name: "정신 안정제", desc: "MP 회복", cost: 35, icon: "◇" },
];

const TIER_META: Record<1 | 2 | 3, { label: string; color: string; glow: string }> = {
  1: { label: "1성", color: "#6fb8ff", glow: "rgba(111,184,255,0.35)" },
  2: { label: "2성", color: "#c08aff", glow: "rgba(192,138,255,0.4)" },
  3: { label: "3성", color: "#ffd76a", glow: "rgba(255,215,106,0.5)" },
};

/** 웨이브 클리어 카드 선택 모달 — 게이트 진행 중에만 표시 */
export function GateCardOverlay() {
  const [st, setSt] = useState<GateCardState | null>(null);
  useEffect(() => {
    const onCards = (v: GateCardState) => setSt(v.open ? v : null);
    EventBus.on("gate:cards", onCards);
    return () => { EventBus.off("gate:cards", onCards); };
  }, []);
  if (!st || st.cards.length === 0) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[3px]">
      <div className="w-[min(94vw,520px)] rounded-xl border-2 border-purple-300/60 bg-slate-950/95 p-4 shadow-2xl">
        <p className="mb-1 text-center text-lg font-black text-purple-200">웨이브 {st.wave} 클리어! — 강화 카드 선택</p>
        <p className="mb-3 text-center text-[11px] text-white/50">카드 버프는 이번 게이트 방어전에서만 유지됩니다 · 실버 {st.silver}</p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {st.cards.map((c, i) => {
            const m = TIER_META[c.tier];
            return (
              <button
                key={c.id}
                onClick={() => EventBus.emit("rpg:gatePick", i)}
                className="flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-4 transition-transform hover:scale-[1.04] active:scale-95"
                style={{ borderColor: m.color, background: `linear-gradient(160deg, ${m.glow}, rgba(2,6,23,0.95))`, boxShadow: `0 0 18px ${m.glow}` }}
              >
                <span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ border: `1px solid ${m.color}88`, color: m.color }}>{m.label}</span>
                <span className="text-sm font-black text-white">{c.name}</span>
                <span className="text-[11px] font-bold text-white/70">{c.desc}</span>
              </button>
            );
          })}
        </div>
        {/* 실버 상점 — 웨이브 사이 구매 */}
        <p className="mb-1.5 text-[11px] font-bold text-white/60">실버 상점 (실버 {st.silver})</p>
        <div className="grid grid-cols-4 gap-1.5">
          {GATE_SHOP_ITEMS.map((s) => (
            <button
              key={s.id}
              onClick={() => EventBus.emit("rpg:gateShop", s.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors active:scale-95 ${st.silver >= s.cost ? "border-amber-300/50 bg-amber-400/10 hover:bg-amber-400/20" : "border-white/10 bg-white/[0.02] opacity-40"}`}
            >
              <span className="text-base">{s.icon}</span>
              <span className="text-[9px] font-black text-white">{s.name}</span>
              <span className="text-[8px] text-white/50">{s.desc}</span>
              <span className="text-[9px] font-black text-amber-300">{s.cost} 실버</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type GateState = {
  active: boolean;
  wave: number;
  coreHp: number;
  coreMax: number;
  silver: number;
  phase: string;
  bossWave: boolean;
};

/** 게이트 진행 HUD — 상단 중앙 (게이트 구역에서만 표시) */
export function GateHud() {
  const [st, setSt] = useState<GateState | null>(null);
  useEffect(() => {
    const onState = (v: GateState) => setSt(v.active ? v : null);
    EventBus.on("gate:state", onState);
    return () => { EventBus.off("gate:state", onState); };
  }, []);
  if (!st) return null;
  const pct = Math.max(0, Math.min(100, (st.coreHp / Math.max(1, st.coreMax)) * 100));
  const barColor = pct > 50 ? "#7dffa8" : pct > 25 ? "#ffd76a" : "#e84a5a";
  return (
    <div className="pointer-events-none absolute left-1/2 top-1 z-40 w-[min(92vw,340px)] -translate-x-1/2 sm:top-2">
      <div className="rounded-lg border border-purple-300/40 bg-black/60 px-2.5 py-1.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-[10px] font-black">
          <span className="text-purple-200">🚪 균열 문 {st.bossWave ? "· 보스 웨이브!" : ""}</span>
          <span className="text-white/70">웨이브 {st.wave} · 실버 {st.silver}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <p className="mt-0.5 text-center text-[9px] font-bold text-white/50">게이트 HP {Math.round(st.coreHp).toLocaleString()} / {st.coreMax.toLocaleString()} — 문에 닿기 전에 막아라!</p>
      </div>
    </div>
  );
}
