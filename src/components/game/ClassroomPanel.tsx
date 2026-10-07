"use client";

/**
 * v1.4.30 (#9 클래스룸 — 교실 모드) — 수업용 대규모 협동 콘텐츠 UI
 *
 *  [사용법] 선생님이 [교실 생성] → 6자리 코드를 학생에게 공유 → 학생 [코드 참여].
 *   10/20/50/100명이 동시에 접속해도 MQTT 3초 하트비트 합산으로 버틴다 (서버 불필요).
 *
 *  [활동 3종] (교실 개설자=선생님만 시작/종료)
 *   1. 학급 토벌전 — 전체 킬 합산으로 목표 마릿수 달성 (참가자×20)
 *   2. 공유 보스 레이드 — 수업 전체가 한 보스의 HP 풀을 같이 깬다 (각자 딜 합산)
 *   3. 사냥 경쟁전 — 5분 개인 킬 랭킹
 */
import { useEffect, useRef, useState } from "react";
import { GraduationCap, LogOut, Play, Square, Trophy, Skull, Swords, Copy } from "lucide-react";
import {
  onClassUpdate, classJoin, classLeave, classStart, classEnd, scaleGoal,
  type ClassSnapshot,
} from "@/game/classroom";
import { EventBus } from "./EventBus";

export function ClassroomPanel() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<ClassSnapshot | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [, force] = useState(0);

  useEffect(() => onClassUpdate((s) => { setSnap(s); force((n) => n + 1); }), []);

  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    EventBus.on("classroom:toggle", onToggle);
    return () => { EventBus.off("classroom:toggle", onToggle); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey)) return; // 복사 단축키 보호
      if (e.key.toLowerCase() === "l") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  const joined = !!snap?.code;
  const isHost = snap?.host ?? false;
  const myProfile = { name: snap?.myName || "모험가", lv: 1 };

  const doCreate = () => {
    const c = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    if (classJoin(c, { name: snap?.myName || "선생님", lv: 1 }, true)) setCode(c);
  };
  const doJoin = () => { if (code.trim().length >= 4) classJoin(code.trim(), myProfile, false); };

  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-black/55 p-3" onPointerDown={() => setOpen(false)}>
      <div className="game-panel w-full max-w-md p-4" onPointerDown={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-black text-emerald-200">
            <GraduationCap size={16} /> 클래스룸 — 교실 모드
          </p>
          <button onClick={() => setOpen(false)} aria-label="클래스룸 닫기" className="game-chip flex h-7 w-7 items-center justify-center text-white/60">
            ✕
          </button>
        </div>

        {!joined ? (
          /* ── 참여 전: 생성 / 코드 참여 ── */
          <div className="space-y-2.5">
            <p className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-bold leading-relaxed text-white/60">
              학교 수행평가·단체 이벤트용 모드 — 10·20·50·100명이 함께 참여하는 협동 미니게임.
              선생님이 교실을 만들어 <b className="text-emerald-300">6자리 코드</b>를 알려주면 학생 전원이 참여합니다.
            </p>
            <button onClick={doCreate} className="game-btn flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-black active:scale-95">
              <Play size={13} /> 교실 생성 (선생님)
            </button>
            <div className="flex gap-1.5">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="참여 코드 6자리"
                maxLength={6}
                className="game-input w-full px-3 py-2.5 text-center text-[14px] font-black tracking-[0.3em] placeholder:tracking-normal placeholder:text-white/25"
              />
              <button onClick={doJoin} disabled={code.trim().length < 4} className="game-btn shrink-0 px-4 py-2.5 text-[12px] font-black active:scale-95 disabled:opacity-40">
                참여
              </button>
            </div>
          </div>
        ) : (
          /* ── 참여 후: 코드 · 참가자 · 활동 · 진행도 ── */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-2">
              <div>
                <p className="text-[9px] font-bold text-emerald-200/70">교실 코드 (칠판에 공유!)</p>
                <p className="flex items-center gap-1.5 text-[20px] font-black tracking-[0.25em] text-emerald-200">
                  {snap!.code}
                  <button
                    onClick={() => { try { navigator.clipboard?.writeText(snap!.code); setCopied(true); window.setTimeout(() => setCopied(false), 1200); } catch { /* 무시 */ } }}
                    aria-label="코드 복사"
                    className="text-white/50 hover:text-white"
                  >
                    <Copy size={13} />
                  </button>
                  {copied && <span className="text-[9px] tracking-normal text-emerald-300">복사됨!</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-white/70">참가자 {snap!.peers.length}명</p>
                <p className={`text-[9px] font-bold ${snap!.connected ? "text-emerald-300" : "text-rose-300"}`}>{snap!.connected ? "● 연결됨" : "○ 연결 중…"}</p>
              </div>
            </div>

            {isHost && snap!.mode === "idle" && (
              /* 활동 선택 — 참가자 수 기반 목표 자동 산정 (10/20/50/100인 전부 대응) */
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-white/60">활동 시작 (개설자 전용) — 참가자 {snap!.peers.length}명 기준 자동 조정</p>
                <ActivityBtn
                  icon={<Swords size={14} />} title="학급 토벌전" desc={`전체 합계 ${scaleGoal("hunt", snap!.peers.length)}마리 사냥`}
                  onClick={() => classStart("hunt", scaleGoal("hunt", snap!.peers.length))}
                />
                <ActivityBtn
                  icon={<Skull size={14} />} title="공유 보스 레이드" desc={`보스 HP ${scaleGoal("boss", snap!.peers.length).toLocaleString()} — 전원 합동 공격`}
                  onClick={() => classStart("boss", scaleGoal("boss", snap!.peers.length))}
                />
                <ActivityBtn
                  icon={<Trophy size={14} />} title="사냥 경쟁전" desc="5분 개인 킬 랭킹 대항전"
                  onClick={() => classStart("race", 0)}
                />
              </div>
            )}

            {snap!.mode !== "idle" && <ProgressView snap={snap!} />}

            {isHost && snap!.mode !== "idle" && (
              <button onClick={() => classEnd()} className="game-btn-ghost flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black active:scale-95">
                <Square size={11} /> 활동 종료
              </button>
            )}

            {/* 참가자 명단 */}
            <div className="sertz-scroll max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-1.5">
              {snap!.peers.length === 0 && <p className="px-1 py-2 text-center text-[10px] font-bold text-white/35">참가자를 기다리는 중…</p>}
              {[...snap!.peers].sort((a, b) => b.kills - a.kills).slice(0, 100).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-[11px] font-bold">
                  <span className="w-5 text-right text-white/35">{i + 1}</span>
                  <span className="flex-1 truncate text-white/80">{p.name}{p.id === snap!.id ? " (나)" : ""}</span>
                  <span className="text-white/40">Lv.{p.lv}</span>
                  <span className="w-12 text-right text-amber-200/90">{p.kills}킬</span>
                </div>
              ))}
            </div>

            <button onClick={() => { classLeave(); setCode(""); }} className="game-btn-ghost flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black text-rose-200/80 active:scale-95">
              <LogOut size={12} /> 교실 나가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityBtn({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-left transition-transform active:scale-95 hover:bg-white/[0.07]">
      <span className="text-emerald-200">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-black text-white">{title}</span>
        <span className="block text-[9px] font-bold text-white/50">{desc}</span>
      </span>
      <Play size={12} className="ml-auto text-white/40" />
    </button>
  );
}

function ProgressView({ snap }: { snap: ClassSnapshot }) {
  const [, force] = useState(0);
  const ivRef = useRef<number | null>(null);
  useEffect(() => {
    ivRef.current = window.setInterval(() => force((n) => n + 1), 1000);
    return () => { if (ivRef.current) window.clearInterval(ivRef.current); };
  }, []);
  if (snap.mode === "hunt") {
    const pct = Math.min(100, Math.round((snap.huntKills / Math.max(1, snap.goal)) * 100));
    return (
      <div className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2">
        <p className="flex justify-between text-[11px] font-black text-amber-100"><span>학급 토벌전</span><span>{snap.huntKills} / {snap.goal}</span></p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[9px] font-bold text-white/50">전원의 킬이 합산됩니다 — 몬스터를 잡을 때마다 카운트!</p>
      </div>
    );
  }
  if (snap.mode === "boss") {
    const pct = Math.min(100, Math.round((snap.bossHp / Math.max(1, snap.goal)) * 100));
    return (
      <div className="rounded-lg border border-rose-300/40 bg-rose-400/10 px-3 py-2">
        <p className="flex justify-between text-[11px] font-black text-rose-100"><span>공유 보스 — 수업 전원 합동!</span><span>{snap.bossHp.toLocaleString()} HP</span></p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[9px] font-bold text-white/50">누적 딜 {snap.bossTaken.toLocaleString()} — 각자 때린 피해가 모두 합산됩니다</p>
      </div>
    );
  }
  const left = Math.max(0, Math.ceil((snap.endsAt - Date.now()) / 1000));
  const top = [...snap.peers].sort((a, b) => b.kills - a.kills).slice(0, 5);
  return (
    <div className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-2">
      <p className="flex justify-between text-[11px] font-black text-sky-100">
        <span>사냥 경쟁전 {snap.rank > 0 ? `— 내 순위 ${snap.rank}위` : ""}</span>
        <span>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      </p>
      <div className="mt-1 space-y-0.5">
        {top.map((p, i) => (
          <p key={p.id} className="flex justify-between text-[10px] font-bold text-white/70">
            <span>{i + 1}. {p.name}{p.id === snap.id ? " (나)" : ""}</span>
            <span className="text-amber-200">{p.kills}킬</span>
          </p>
        ))}
      </div>
    </div>
  );
}
