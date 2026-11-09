"use client";

/**
 * vc291 — 보스 러시 패널.
 *
 * [구조]
 *  ① 시작 화면 — 최고 기록 + 해금 여부 + "러시 시작"
 *  ② 강화 선택 — 웨이브 클리어 후 3택1
 *  ③ 결과 — 도달 웨이브·획득 에메랄드·완주 여부
 *
 * [왜 별도 파일인가]
 *  Panels.tsx 가 이미 6,900줄이다. 여기에 패널을 더 넣으면 파일이 더 비대해지고
 *  편집 충돌이 잦아진다. 보스 러시는 자체 상태가 많아 분리하는 편이 읽기도 쉽다.
 *
 * [디자인]
 *  새 디자인을 만들지 않고 기존 `game-panel` · `game-chip` 토큰과
 *  Panels.tsx 의 모달 패턴(`bg-black/50` 오버레이 + 중앙 카드)을 그대로 쓴다.
 */
import { useEffect, useMemo, useState } from "react";
import {
  BOSS_RUSH_WAVES,
  type RushBest,
  type RushBuff,
  type RushUpgrade,
  EMPTY_BEST,
  EMPTY_BUFF,
  applyUpgrade,
  rollUpgradeChoices,
} from "@/game/bossRush";

type Props = {
  /** 세이브에 저장된 최고 기록 */
  best?: RushBest | null;
  /** 해금 여부 (isBossRushUnlocked 결과). false 면 시작 버튼을 잠근다. */
  unlocked?: boolean;
  onClose: () => void;
  /** 런 종료 시 정산 — 상위에서 세이브에 반영한다 */
  onFinish?: (result: { wave: number; emerald: number; cleared: boolean }) => void;
};

type Stage = "idle" | "choosing" | "result";

export default function BossRushPanel({ best, unlocked = true, onClose, onFinish }: Props) {
  const safeBest = best ?? EMPTY_BEST;
  const [stage, setStage] = useState<Stage>("idle");
  const [wave, setWave] = useState(0);
  const [emerald, setEmerald] = useState(0);
  const [buff, setBuff] = useState<RushBuff>({ ...EMPTY_BUFF });
  /* 런 시드 — 시작 시 한 번 고정한다. 같은 시드면 같은 선택지가 나와 리롤 어뷰징이 막힌다. */
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 현재 웨이브 정의 (범위를 벗어나면 null = 완주) */
  const cur = BOSS_RUSH_WAVES[wave] ?? null;

  /* 강화 선택지 — 시드 + 웨이브 인덱스로 결정한다.
   * 웨이브를 반영하지 않으면 매 웨이브 같은 3개가 떠서 선택이 무의미해진다. */
  const choices = useMemo<RushUpgrade[]>(
    () => (stage === "choosing" ? rollUpgradeChoices(seed + wave * 7919, 3) : []),
    [stage, seed, wave],
  );

  const startRun = () => {
    setWave(0);
    setEmerald(0);
    setBuff({ ...EMPTY_BUFF });
    setSeed(Math.floor(Math.random() * 0x7fffffff));
    setStage("choosing");
  };

  /* 웨이브 클리어 처리 — 강화를 고른 시점에 다음 웨이브로 넘어간다. */
  const pickUpgrade = (up: RushUpgrade) => {
    setBuff((b) => applyUpgrade(b, up));
    const gained = cur?.emerald ?? 0;
    const nextWave = wave + 1;
    setEmerald((e) => e + gained);

    if (nextWave >= BOSS_RUSH_WAVES.length) {
      /* 10웨이브 완주 */
      setWave(nextWave);
      setStage("result");
      onFinish?.({ wave: nextWave, emerald: emerald + gained, cleared: true });
      return;
    }
    setWave(nextWave);
    setStage("choosing");
  };

  /* 강제 종료(포기) — 획득분은 유지하되 완주는 아니다. */
  const giveUp = () => {
    setStage("result");
    onFinish?.({ wave, emerald, cleared: false });
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,620px)] w-[min(94vw,460px)] overflow-y-auto game-panel p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="보스 러시"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-rose-200">보스 러시</p>
            <p className="mt-0.5 text-[10px] text-white/55">
              보스를 연속으로 상대합니다. 웨이브마다 강화를 하나 고릅니다.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="보스 러시 닫기"
            className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] font-black text-white/70 hover:border-white/40"
          >
            닫기
          </button>
        </div>

        {/* ── ① 시작 ── */}
        {stage === "idle" && (
          <>
            <div className="rounded-lg border border-white/12 bg-black/35 px-3 py-2.5">
              <p className="text-[11px] font-black text-white/80">최고 기록</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-[22px] font-black text-rose-200">
                  {safeBest.bestWave}
                  <span className="ml-0.5 text-[11px] font-bold text-white/45">/ {BOSS_RUSH_WAVES.length} 웨이브</span>
                </span>
                <span className="pb-1 text-[10px] font-bold text-white/50">완주 {safeBest.clears}회</span>
              </div>
              <p className="mt-1 text-[10px] text-white/40">
                누적 에메랄드 {safeBest.totalEmerald.toLocaleString()}
              </p>
            </div>

            <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <p className="text-[10px] font-black text-white/60">웨이브 편성</p>
              <div className="mt-1 max-h-[26svh] overflow-y-auto sertz-scroll">
                {BOSS_RUSH_WAVES.map((w, i) => (
                  <div key={w.bossKey + i} className="flex items-center gap-2 py-0.5 text-[10px]">
                    <span className="w-4 shrink-0 text-right font-black text-white/35">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-white/75">{w.label}</span>
                    <span className="shrink-0 font-bold text-emerald-300/80">+{w.emerald}</span>
                  </div>
                ))}
              </div>
            </div>

            {!unlocked && (
              <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-2.5 py-2 text-[10px] font-bold leading-snug text-amber-200">
                보스 러시는 보스를 1회 이상 처치하거나 3개 지역을 방문하면 열립니다.
              </p>
            )}

            <button
              onClick={startRun}
              disabled={!unlocked}
              className="mt-2.5 w-full rounded-xl border-2 border-rose-300/70 bg-rose-500/25 px-3 py-2.5 text-[13px] font-black text-rose-100 transition enabled:hover:bg-rose-500/35 disabled:opacity-40"
            >
              러시 시작
            </button>
          </>
        )}

        {/* ── ② 강화 선택 ── */}
        {stage === "choosing" && cur && (
          <>
            <div className="flex items-center justify-between rounded-lg border border-white/12 bg-black/35 px-3 py-2">
              <div>
                <p className="text-[10px] font-bold text-white/45">
                  웨이브 {wave + 1} / {BOSS_RUSH_WAVES.length}
                </p>
                <p className="text-[12px] font-black text-white/90">{cur.label}</p>
              </div>
              <span className="text-[11px] font-black text-emerald-300">
                {emerald.toLocaleString()}
              </span>
            </div>

            {/* 누적 강화 — 지금까지 고른 것의 합 */}
            {(buff.atkPct > 0 || buff.maxHpPct > 0 || buff.speedPct > 0 || buff.critPct > 0 || buff.cdrPct > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {buff.atkPct > 0 && <Chip label={`공격 +${buff.atkPct}%`} />}
                {buff.maxHpPct > 0 && <Chip label={`HP +${buff.maxHpPct}%`} />}
                {buff.speedPct > 0 && <Chip label={`속도 +${buff.speedPct}%`} />}
                {buff.critPct > 0 && <Chip label={`치명 +${buff.critPct}%p`} />}
                {buff.cdrPct > 0 && <Chip label={`쿨 -${buff.cdrPct}%`} />}
              </div>
            )}

            <p className="mt-2.5 text-[11px] font-black text-white/70">강화 선택</p>
            <div className="mt-1 space-y-1.5">
              {choices.map((up) => (
                <button
                  key={up.key}
                  onClick={() => pickUpgrade(up)}
                  className="w-full rounded-lg border-2 border-white/15 bg-black/40 px-3 py-2 text-left transition hover:border-rose-300/60 hover:bg-rose-500/10"
                >
                  <span className="block text-[12px] font-black text-white/90">{up.name}</span>
                  <span className="mt-0.5 block text-[10px] font-bold text-white/50">{up.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={giveUp}
              className="mt-2 w-full rounded-lg border border-white/12 px-3 py-1.5 text-[10px] font-bold text-white/45 hover:border-white/30"
            >
              러시 포기
            </button>
          </>
        )}

        {/* ── ③ 결과 ── */}
        {stage === "result" && (
          <>
            <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-center">
              <p className="text-[13px] font-black text-rose-100">
                {wave >= BOSS_RUSH_WAVES.length ? "완주!" : `웨이브 ${wave} 까지 도달`}
              </p>
              <p className="mt-1 text-[11px] font-bold text-white/70">
                획득 에메랄드 <span className="text-emerald-300">{emerald.toLocaleString()}</span>
              </p>
            </div>
            <button
              onClick={() => setStage("idle")}
              className="mt-2.5 w-full rounded-xl border-2 border-white/20 bg-black/40 px-3 py-2 text-[12px] font-black text-white/80 hover:border-white/40"
            >
              확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** 누적 강화 표시용 작은 칩 — 기존 game-chip 배경을 그대로 쓴다. */
function Chip({ label }: { label: string }) {
  return (
    <span className="game-chip rounded-md px-1.5 py-0.5 text-[9px] font-black text-emerald-200">
      {label}
    </span>
  );
}
