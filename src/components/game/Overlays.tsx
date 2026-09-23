"use client";

import { useEffect, useRef, useState } from "react";
import { loadSave, clearSave, type SaveData } from "@/game/config";
import { EventBus, type EndState, type RewardPopupState } from "./EventBus";
import { STAGES, STAGE_SHORT, resolveStage } from "@/game/data";
import { RotateCw, Play, Swords, Skull, Trophy, Home, Store, MessageCircle, Sparkles, Smartphone } from "lucide-react";
import { useKeyGate, swallowKeys } from "./inputGate"; // v4.1.0
import pkg from "../../../package.json"; // v1.0.17 — 클라 자체 버전 (단일 소스 = package.json)

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

/** v1.0.17 — 클라 버전 게이트: 서버 최신 버전과 내 버전을 비교해 구버전이면 재설치 안내.
 *  유저가 구버전 APK(v1.0.15 이하 — 캐릭터가 조준 반대를 보던 판)를 계속 쓰며
 *  "화살 방향 반대" 같은 이미 수정된 증상을 재보고하는 문제를 원천 차단. */
function compareVer(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function TitleScreen() {
  // 클라이언트 전용 컴포넌트(ssr:false)라 지연 초기화로 안전
  const [save, setSave] = useState<SaveData | null>(() => loadSave());
  /* v1.0.17 — 구버전 알림: 서버 /api/version 조회 결과 (내 버전보다 높을 때만 채움) */
  const [update, setUpdate] = useState<{ latest: string; note: string; guide: string } | null>(null);

  useEffect(() => {
    let dead = false;
    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { latest?: string; note?: string; guide?: string } | null) => {
        if (dead || !j?.latest) return;
        if (compareVer(j.latest, pkg.version) > 0) {
          setUpdate({ latest: j.latest, note: j.note ?? "", guide: j.guide ?? "/apk-guide.html" });
        }
      })
      .catch(() => {}); // 오프라인/구 서버 — 조용히 스킵 (게임 플레이 방해 없음)
    return () => { dead = true; };
  }, []);

  return (
    /* v1.0.19 (A-1/A-2) — 타이틀도 스크롤 가능하게: 저높이(가로 폰)에서 버튼/크레딧이 잘리던 것 수정.
     *  컨테이너 overflow-y-auto + 내부 min-h-full flex — 내용이 짧으면 중앙정렬 유지, 길면 스크롤
     *  v1.0.20 — AI스러운 텍스트 로고 → 게임 타이틀 로고타입(금 잉곽+왕관 문장+양피지 부제) 재디자인 */
    <div className="sertz-scroll absolute inset-0 z-40 overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center bg-transparent px-4 py-6">
        <div className="mb-1 text-center">
          {/* 왕관 문장 — 픽셀 게임 타이틀 장식 */}
          <div aria-hidden className="mx-auto mb-1 flex items-center justify-center gap-2">
            <span className="h-0.5 w-10 bg-gradient-to-r from-transparent to-[#e8c064]" />
            <span className="text-[13px] leading-none text-[#ffd98a] [text-shadow:0_2px_0_#3a2508]">✦</span>
            <span className="h-0.5 w-10 bg-gradient-to-l from-transparent to-[#e8c064]" />
          </div>
          <h1 className="text-5xl font-black tracking-[0.14em] text-[#ffe49a] [text-shadow:0_2px_0_#9a6410,0_4px_0_#6b4a1c,0_6px_0_#3a2508,0_10px_18px_rgba(0,0,0,0.9)] sm:text-7xl">
            SERTZ
          </h1>
          {/* 양피지 부제 칩 — 우드 프레임 */}
          <p className="game-chip mx-auto mt-3 inline-block max-w-[min(94vw,560px)] px-4 py-1.5">
            <span className="text-sm font-black tracking-[0.3em] text-[#f0e2c0] [text-shadow:0_1px_2px_#000] sm:text-base">
              이그드라실 : 아홉 왕국
            </span>
            {/* v1.0.3 (#글자짤림) — 버전 배지가 부모 폭 제한 없이 늘어나 화면 밖으로 잘리던 버그:
             *  배지를 별도 줄 블록으로 분리 + 최대 폭 제한 + 2줄 클램프 */}
            <span className="mt-1 block rounded border border-[#8a6a34]/70 bg-black/45 px-1.5 py-0.5 text-center text-[9px] font-black leading-snug tracking-normal text-[#cbb88a] line-clamp-2">v1.4.5 — 무한 재부팅 근본 차단(이상한 비석·ARG 복귀) · 플레이스토어 대비(지원센터·계정삭제·HTTPS) · 멀티 진입 노출</span>
          </p>
        </div>

      {/* v1.0.17 — 구버전 APK 사용자 필수 안내: 최신 수정(화살 방향 등)은 재설치 후에만 적용됨 */}
      {update && (
        <a
          href={update.guide}
          target="_blank"
          rel="noopener noreferrer"
          className="game-btn-danger mt-3 block w-[min(92vw,520px)] px-4 py-2.5 text-center"
        >
          <p className="text-[13px] font-black sm:text-sm">
            새 버전 v{update.latest} 설치 필요 — 여기 눌러 APK 재설치
          </p>
          {update.note && (
            <p className="mt-0.5 text-[10px] font-bold leading-snug text-amber-100/85">{update.note}</p>
          )}
        </a>
      )}

      <div className="mt-8 flex w-56 flex-col gap-3 sm:w-64">
        {/* v1.0.18 — 시작/이어하기 모두 로비(캐릭터 선택·생성)로 진입 (메이플 메인메뉴 흐름) */}
        <button
          onClick={() => EventBus.emit("lobby:open")}
          className="game-btn flex items-center justify-center gap-2 px-4 py-3 text-base font-black active:scale-95"
        >
          <Play size={18} />
          게임 시작
          <span className="text-[9px] font-bold text-[#6b4a1c]/80">— 캐릭터 선택·생성</span>
        </button>
        {save && (
          <span className="game-chip mx-auto -mt-1 px-2 py-1 text-[9px] font-bold text-[#cbb88a]">
            마지막 플레이: LV{save.lv} · {save.cleared ? "클리어" : stageLabel(save.stage)} — 로비에서 이어하기
          </span>
        )}
        {save && (
          <button
            onClick={() => {
              clearSave();
              setSave(null);
            }}
            className="mx-auto text-[11px] font-bold text-white/40 underline underline-offset-2 hover:text-white/70"
          >
            마지막 플레이 세이브 삭제 (로비에서 개별 캐릭터 삭제 가능)
          </button>
        )}
        {/* v3.2.0 — 폰에서 놀고 싶은 유저를 위한 APK 다운로드 안내 (타이틀에서 바로 찾기) */}
        <a
          href="/apk-guide.html"
          target="_blank"
          rel="noopener noreferrer"
          className="game-btn-ghost mx-auto mt-1 flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-black text-[#f0e2c0] active:scale-95"
        >
          <Smartphone size={13} />
          폰용 APK 다운로드
        </a>
      </div>

      {/* v1.0.3 (#글자짤림) — inset-x-0 추가: absolute 컨테이너가 내용 폭만큼 늘어나
       *  max-w-[92%]가 무효가 되고 크레딧이 화면 밖으로 잘리던 버그
       *  v1.0.19 (A-1) — absolute → flow(mt-auto): 스크롤 컨테이너에서 absolute bottom이
       *  첫 화면 하단에 고정되어 콘텐츠와 겹치던 문제 수정 — 내용이 짧으면 하단, 길면 흐름 따름 */}
      <div className="mt-auto flex flex-col items-center gap-1 px-3 pb-3 pt-8 text-center">
        {/* v1.0.3 — 저높이(가로 폰)에서는 키 안내줄이 APK 링크와 겹치므로 숨김 (터치 유저에게 불필요) */}
        <p className="game-chip px-2.5 py-1 text-[10px] font-bold text-[#cbb88a] [@media(max-height:540px)]:hidden">
          이동: 방향키 / 왼쪽 화면 드래그 · 공격: X · 스킬: Z, C, V, A, S · 물약: D, F
        </p>
        <p className="max-w-[min(94vw,760px)] text-[8px] leading-relaxed text-white/30 sm:text-[9px]">
          Art: Zelda-like by ArMM1998 · Slash by Cethiel · Portal by varkalandar (CC-BY) · Kenney · LPC Wolf by
          williamthompsonj (CC-BY) · Sotrak by gilgaphoenixignis (CC-BY) · SPUM · Cartoon FX Remaster & Fantasy UI SFX (Unity Asset Store 유료 라이선스) · Music: Kevin MacLeod (incompetech.com, CC-BY 4.0) · SFX: Rubberduck (CC0)
        </p>
      </div>
      </div>
    </div>
  );
}

/* ---------- 배너 ---------- */

export function Banner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-30 flex justify-center">
      {/* v1.0.20 — 게임형 배너: 우드 프레임 + 금 텍스트 */}
      <div className="game-chip animate-[bannerPop_2.3s_ease-out_forwards] px-6 py-2.5">
        <p className="text-lg font-black tracking-wide text-[#ffd98a] [text-shadow:0_2px_0_#3a2508,0_3px_6px_#000] sm:text-xl">
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
          /* v1.0.20 — 보스바: 보라 글라스 → 심홍 우드 프레임 (보스전 긴장감) */
          compact
            ? "w-[64%] max-w-[400px] rounded-md border-2 border-[#7a2a2a] bg-[#140d10]/85 px-2 py-1 shadow-[inset_0_0_0_1px_rgba(255,120,120,0.18),0_4px_0_rgba(0,0,0,0.4)]"
            : "w-[52%] max-w-[480px] rounded-md border-2 border-[#7a2a2a] bg-[#140d10]/85 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,120,120,0.18),0_4px_0_rgba(0,0,0,0.4)] sm:w-[78%] sm:max-w-2xl sm:rounded-lg sm:px-3 sm:py-2"
        }
      >
        <div className={compact ? "mb-0.5 flex items-center justify-between" : "mb-1 flex items-center justify-between"}>
          <span
            className={
              compact
                ? "max-w-[70%] truncate text-[11px] font-black tracking-wide text-[#ffb0b0] [text-shadow:0_1px_3px_#000]"
                : "truncate text-[11px] font-black tracking-wide text-[#ffb0b0] [text-shadow:0_1px_3px_#000] sm:text-sm"
            }
          >
            {boss.name}
          </span>
          <span className={compact ? "text-[8px] font-bold text-white/70" : "text-[9px] font-bold text-white/70 sm:text-[10px]"}>
            {Math.ceil(pct)}%
          </span>
        </div>
        <div className={compact ? "h-2.5 overflow-hidden rounded-full border border-black/70 bg-black/70" : "h-2.5 overflow-hidden rounded-full border border-black/70 bg-black/70 sm:h-4"}>
          <div
            className="h-full bg-gradient-to-b from-[#ff8080] to-[#8a1420] transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- 가로 모드 안내 (모바일 세로 감지) ---------- */

export function RotatePrompt({ active, onDismiss }: { active: boolean; onDismiss?: () => void }) {
  if (!active) return null;
  return (
    <div className="rotate-prompt pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0b1120]/97 p-8 text-center">
      {/* v1.0.20 — 게임형 회전 안내 */}
      <div className="game-panel flex flex-col items-center gap-4 px-8 py-7">
        <RotateCw size={48} className="animate-spin-slow text-[#ffd98a]" />
        <p className="text-lg font-black text-[#ffd98a]">기기를 가로로 돌려주세요</p>
        <p className="text-xs font-bold text-white/60">
          SERTZ는 가로 화면에 최적화된 액션 RPG입니다
        </p>
        {/* v1.0.19 (A-2 반응형) — 세로로도 플레이 가능 (Scale.FIT) — 강제 차단 대신 유저 선택 존중 */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="game-btn-ghost mt-2 px-5 py-2.5 text-[13px] font-black active:scale-95"
          >
            세로 화면으로 계속하기
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- v1.2.1 (#6) — 메뉴 나가기 확인 오버레이 ---------- */

/** 유저 지시 "메뉴화면(게임 시작창&캐릭터 선택화면)으로 어떻게 나감??":
 *  인게임 우상단 ☰ 버튼으로 열리는 종료 확인창. 세이브는 월드 쪽(rpg:exitMenu)에서 수행. */
export function ExitMenuOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div
        className="game-panel w-[min(88vw,360px)] p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm font-black text-[#ffd98a]">메뉴 화면으로 나갈까요?</p>
        <p className="mt-1 text-center text-[11px] font-bold text-white/55">
          진행 상황은 자동 저장됩니다
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              EventBus.emit("rpg:exitMenu", { lobby: true });
            }}
            className="game-btn px-4 py-3 text-[13px] font-black active:scale-95"
          >
            캐릭터 선택 화면으로
            <span className="mt-0.5 block text-[9px] font-bold text-[#6b4a1c]/85">다른 캐릭터로 이어하기·새 캐릭터</span>
          </button>
          <button
            onClick={() => {
              onClose();
              EventBus.emit("rpg:exitMenu", { lobby: false });
            }}
            className="game-btn-ghost px-4 py-2.5 text-[13px] font-black active:scale-95"
          >
            게임 시작 화면으로
          </button>
          <button
            onClick={onClose}
            className="mx-auto px-4 py-1.5 text-[11px] font-black text-white/50 hover:text-white/80 active:scale-95"
          >
            계속 플레이
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 엔드 화면 ---------- */

export function EndScreen({ end }: { end: EndState }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}분 ${s % 60}초`;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-[2px]">
      {/* v1.0.20 — 엔드 화면: 게임형 프레임 */}
      <div className="game-panel w-full max-w-sm p-6 text-center">
        <div className="mb-4 flex justify-center">
          {end.victory ? (
            <Trophy size={44} className="text-[#ffd98a]" />
          ) : (
            <Skull size={44} className="text-[#ff8a8a]" />
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
              className="game-btn flex items-center justify-center gap-2 px-4 py-3 text-sm font-black active:scale-95"
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
                className="game-btn-danger flex items-center justify-center gap-2 px-4 py-3 text-sm font-black active:scale-95"
              >
                <Play size={16} />
                가까운 마을에서 부활
              </button>
              <button
                onClick={() => window.location.reload()}
                className="game-btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black active:scale-95"
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
    <div className="game-chip py-2">
      <div className="flex items-center justify-center gap-1 text-[#ffd98a]">{icon}</div>
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
  /* v1.1.1 (#1 가림) — 튜토리얼 진행 중엔 팝업을 화면 중하단으로 물러난다 (top-28 → 46%).
   *  팝업(z-70·상단 중앙)이 튜토리얼 패널(캔버스 상단 중앙)을 덮어 "튜토리얼이 가려진다"는
   *  지적의 직접 원인. 팝업 자체는 항상 보인다 — 위치만 내린다. */
  const [tutActive, setTutActive] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const on = (v: RewardPopupState) => {
      setSt(v);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSt(null), 5200);
    };
    const onTut = (v: { active: boolean }) => setTutActive(!!v?.active);
    EventBus.on("reward:show", on);
    EventBus.on("tut:active", onTut);
    return () => {
      EventBus.off("reward:show", on);
      EventBus.off("tut:active", onTut);
      window.clearTimeout(timer);
    };
  }, []);
  if (!st) return null;
  return (
    /* v1.0.3 (#랜덤박스UI) — z-30 → z-[70]: 인벤토리(z-40) 아래에 가려져 상자 개봉 보상이 안 보이던 버그.
     *  가방에서 [열기]를 누르면 보상 팝업이 인벤토리 위에 뜬다. */
    <div className={`pointer-events-none absolute inset-x-0 z-[70] flex justify-center px-4 ${tutActive ? "top-[46%]" : "top-28 sm:top-20"}`}>
      {/* v3.0.23 (#56) — ① 알림 표시를 더 아래로(top-14→top-28) ② 카드에 pointer-events-auto 부여 —
          컨테이너가 pointer-events-none이라 X를 누를 수 없던 버그 수정 */}
      <div className="pointer-events-auto w-[min(92vw,330px)] animate-[rewardPop_0.24s_ease-out] game-panel p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-black text-[#ffd98a]">
            <Sparkles size={14} className="shrink-0" />
            <span className="truncate">{st.title}</span>
          </p>
          <button
            onClick={() => setSt(null)}
            aria-label="보상 팝업 닫기"
            className="game-chip flex h-6 w-6 shrink-0 items-center justify-center text-white/70"
          >
            ✕
          </button>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-black/45 px-2.5 py-2">
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
      {/* v1.0.20 — 이름 패널: 게임형 프레임 */}
      <div className="game-panel w-full max-w-sm p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-[#ffd98a]" />
          <span className="text-base font-black text-[#ffd98a]">이름을 정해라</span>
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
          /* v4.9.0 — 모바일 소프트키보드 자동 대문화/자동수정 방지 (소문자 입력 보장) */
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
          placeholder="1~8자 (한글/영문/숫자)"
          className="game-input w-full px-3 py-3 text-lg font-black tracking-wider placeholder:text-white/30"
        />
        <div className="mt-1 text-right text-[10px] font-bold text-white/40">{val.length}/8</div>
        <button
          onClick={confirm}
          disabled={!val.trim()}
          className="game-btn mt-2 w-full px-4 py-3 text-sm font-black active:scale-95"
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
      {/* v1.0.20 — 게이트 카드: 게임형 프레임 */}
      <div className="game-panel w-[min(94vw,520px)] p-4">
        <p className="mb-1 text-center text-lg font-black text-[#ffd98a]">웨이브 {st.wave} 클리어! — 강화 카드 선택</p>
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
      <div className="game-chip rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between text-[10px] font-black">
          <span className="text-[#d0b0ff]">🚪 균열 문 {st.bossWave ? "· 보스 웨이브!" : ""}</span>
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
