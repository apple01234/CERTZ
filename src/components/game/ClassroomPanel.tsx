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
import { GraduationCap, LogOut, Play, Square, Trophy, Skull, Swords, Copy, Users, Gem, HelpCircle } from "lucide-react";
import {
  onClassUpdate, classJoin, classLeave, classStart, classEnd, scaleGoal, classAnswer, QUIZ_BANK,
  type ClassSnapshot,
} from "@/game/classroom";
import { EventBus } from "./EventBus";
import { loadSave } from "@/game/config";
import { fetchBossContests, contestRequest, prepareBossContest, activeBossContest, type ContestSnapshot, type ContestAttempt } from "@/game/bossContest";

export function ClassroomPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"activities" | "contest">("activities");
  const [snap, setSnap] = useState<ClassSnapshot | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [, force] = useState(0);

  useEffect(() => onClassUpdate((s) => { setSnap(s); force((n) => n + 1); }), []);

  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    const onContest = () => { setTab("contest"); setOpen(true); };
    EventBus.on("classroom:toggle", onToggle);
    EventBus.on("contest:toggle", onContest);
    return () => { EventBus.off("classroom:toggle", onToggle); EventBus.off("contest:toggle", onContest); };
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
  /* v1.4.31 — 실제 플레이어 레벨 반영 (기존 lv:1 하드코딩 수정) */
  const myLv = (() => { try { return loadSave()?.lv ?? 1; } catch { return 1; } })();
  const myProfile = { name: snap?.myName || "모험가", lv: myLv };

  const doCreate = () => {
    const c = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    if (classJoin(c, { name: snap?.myName || "선생님", lv: myLv }, true)) setCode(c);
  };
  const doJoin = () => { if (code.trim().length >= 4) classJoin(code.trim(), myProfile, false); };

  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-black/55 p-3" onPointerDown={() => setOpen(false)}>
      <div className="game-panel sertz-scroll max-h-[min(90svh,640px)] w-full max-w-md overflow-y-auto p-4" onPointerDown={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-black text-emerald-200">
            <GraduationCap size={16} /> 클래스룸 — 교실 모드
          </p>
          <button onClick={() => setOpen(false)} aria-label="클래스룸 닫기" className="game-chip flex h-7 w-7 items-center justify-center text-white/60">
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-2" role="tablist" aria-label="교실 활동 선택">
          <button role="tab" aria-selected={tab === "activities"} className="game-chip flex-1 px-2 py-2 text-xs" onClick={() => setTab("activities")}>교실 활동 6종</button>
          <button role="tab" aria-selected={tab === "contest"} className="game-chip flex-1 px-2 py-2 text-xs text-amber-200" onClick={() => setTab("contest")}>🏆 보스 기록전</button>
        </div>
        {tab === "contest" ? <BossContestSection onPlay={() => setOpen(false)} /> : !joined ? (
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
                className="game-input w-full px-3 py-2.5 text-center text-[14px] font-black tracking-[0.3em] placeholder:tracking-normal placeholder:text-white/55"
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
                {/* v1.4.31 (#3) — 파티 게임 3종 신설 (기존 3종 유지) */}
                <ActivityBtn
                  icon={<Users size={14} />} title="팀 킬전 — 레드 vs 블루" desc={`팀당 ${scaleGoal("team", snap!.peers.length)}킬 — 접속 시 자동 팀편성!`}
                  onClick={() => classStart("team", scaleGoal("team", snap!.peers.length))}
                />
                <ActivityBtn
                  icon={<Gem size={14} />} title="보물 사냥" desc={`전체 정예 몬스터 ${scaleGoal("treasure", snap!.peers.length)}마리 — 희귀 사냥 대작전`}
                  onClick={() => classStart("treasure", scaleGoal("treasure", snap!.peers.length))}
                />
                <QuizPicker onStart={(qz) => classStart("quiz", qz.a, { q: qz.q, ch: qz.ch })} />
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
              {snap!.peers.length === 0 && <p className="px-1 py-2 text-center text-[10px] font-bold text-white/55">참가자를 기다리는 중…</p>}
              {[...snap!.peers].sort((a, b) => b.kills - a.kills).slice(0, 100).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-[11px] font-bold">
                  <span className="w-5 text-right text-white/55">{i + 1}</span>
                  <span className="flex-1 truncate text-white/80">{p.name}{p.id === snap!.id ? " (나)" : ""}</span>
                  {snap!.mode === "team" && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.tm === 0 ? "bg-rose-400" : "bg-sky-400"}`} />}
                  <span className="text-white/55">Lv.{p.lv}</span>
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
      <Play size={12} className="ml-auto text-white/55" />
    </button>
  );
}

/* v1.4.31 (#3) — 퀴즈 출제기 (host): 내장 퀴즈 뱅크에서 선택해 바로 시작 */
function QuizPicker({ onStart }: { onStart: (qz: { q: string; ch: string[]; a: number }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.04]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-transform active:scale-95">
        <span className="text-emerald-200"><HelpCircle size={14} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-black text-white">퀴즈쇼</span>
          <span className="block text-[9px] font-bold text-white/50">게임 지식 퀴즈 출제 — 학생 전원 패널 투표 · 30초</span>
        </span>
        <span className="text-[10px] font-black text-white/55">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="sertz-scroll max-h-40 space-y-1 overflow-y-auto border-t border-white/10 p-1.5">
          {QUIZ_BANK.map((qz, i) => (
            <button
              key={i}
              onClick={() => { onStart(qz); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-bold text-white/80 transition-colors hover:bg-emerald-400/10"
            >
              <span className="w-4 text-white/55">{i + 1}</span>
              <span className="flex-1 truncate">{qz.q}</span>
              <Play size={10} className="text-emerald-300" />
            </button>
          ))}
        </div>
      )}
    </div>
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
  /* v1.4.31 (#3) — 팀 킬전 뷰: 레드 vs 블루 대결 바 */
  if (snap.mode === "team") {
    const [red, blue] = snap.teamKills;
    const total = Math.max(1, red + blue);
    const rp = Math.round((red / total) * 100);
    return (
      <div className="rounded-lg border border-fuchsia-300/40 bg-fuchsia-400/10 px-3 py-2">
        <p className="flex items-center justify-between text-[11px] font-black text-white/90">
          <span className="text-rose-300">레드 {red}킬</span>
          <span className="text-white/50">목표 {snap.goal}킬 · 나는 {snap.myTeam === 0 ? "레드" : "블루"}팀!</span>
          <span className="text-sky-300">블루 {blue}킬</span>
        </p>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all" style={{ width: `${rp}%` }} />
          <div className="h-full flex-1 bg-gradient-to-r from-sky-400 to-sky-500" />
        </div>
        <p className="mt-1 text-[9px] font-bold text-white/50">같은 팀 킬이 합산됩니다 — 목표를 먼저 채운 팀이 승리!</p>
      </div>
    );
  }
  /* v1.4.31 (#3) — 보물 사냥 뷰: 정예 킬 합산 */
  if (snap.mode === "treasure") {
    const pct = Math.min(100, Math.round((snap.eliteKills / Math.max(1, snap.goal)) * 100));
    return (
      <div className="rounded-lg border border-violet-300/40 bg-violet-400/10 px-3 py-2">
        <p className="flex justify-between text-[11px] font-black text-violet-100"><span>보물 사냥 — 정예 몬스터만 카운트!</span><span>{snap.eliteKills} / {snap.goal}</span></p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[9px] font-bold text-white/50">이름 앞에 정예가 붙은 몬스터를 잡으면 카운트 — 일반 몬스터는 안 돼요!</p>
      </div>
    );
  }
  /* v1.4.31 (#3) — 퀴즈쇼 뷰: 문제 + 답 투표 + 실시간 집계 */
  if (snap.mode === "quiz" && snap.quizQ) {
    const left = Math.max(0, Math.ceil((snap.endsAt - Date.now()) / 1000));
    const revealed = snap.endsAt > 0 && Date.now() >= snap.endsAt;
    const answered = snap.quizTally.reduce((a, b) => a + b, 0);
    return (
      <div className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2">
        <p className="flex items-start justify-between gap-2 text-[11px] font-black text-amber-100">
          <span className="flex items-start gap-1"><HelpCircle size={13} className="mt-0.5 shrink-0" />{snap.quizQ}</span>
          <span className="shrink-0 text-white/60">{revealed ? "종료" : `${left}초`}</span>
        </p>
        <div className="mt-1.5 space-y-1">
          {snap.quizCh.map((c, i) => {
            const correct = revealed && i === snap.goal;
            const mine = snap.myAns === i;
            const pct = answered > 0 ? Math.round((snap.quizTally[i] / answered) * 100) : 0;
            return (
              <button
                key={i}
                disabled={!snap.host && (mine || revealed)}
                onClick={() => classAnswer(i)}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-[11px] font-bold transition-transform active:scale-95 ${
                  correct ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                  : mine ? "border-amber-200/60 bg-amber-300/15 text-amber-100"
                  : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
                }`}
              >
                <span className="w-4 text-white/50">{i + 1}.</span>
                <span className="flex-1 truncate">{c}{correct ? " ✓ 정답" : ""}{mine && !revealed ? " (내 답)" : ""}</span>
                <span className="w-16 text-right text-[9px] text-white/50">
                  {revealed || snap.host ? `${snap.quizTally[i]}명 ${pct}%` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[9px] font-bold text-white/50">
          {snap.host ? "개설자 화면 — 실시간 답 분포가 표시됩니다" : "번호를 눌러 답하세요! (1인 1회)"}
        </p>
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

const CONTEST_STATE: Record<ContestAttempt["state"], string> = {
  ready: "출전 준비 · 30초 안에 시작", running: "전투 중", pending: "승인 대기 · 클라이언트 처치 보고",
  approved: "공식 기록 · GM 승인", rejected: "기록 거절", failed: "실패 · 순위 제외", abandoned: "중도 이탈 · 순위 제외", expired: "시간 초과 · 순위 제외",
};
function BossContestSection({ onPlay }: { onPlay: () => void }) {
  const [data, setData] = useState<ContestSnapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("우리 반 보스 기록전");
  const [prize, setPrize] = useState("간식 1개");
  const [places, setPlaces] = useState(3);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);
  const reload = async () => {
    try { const next = await fetchBossContests(); clockOffset.current = next.serverNow - Date.now(); setNow(next.serverNow); setData(next); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "대회 목록을 불러오지 못했어요"); }
  };
  useEffect(() => {
    void reload();
    const refresh = () => { void reload(); };
    const clock = setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    const poll = setInterval(refresh, 15000);
    EventBus.on("contest:update", refresh);
    return () => { clearInterval(clock); clearInterval(poll); EventBus.off("contest:update", refresh); };
  }, []);
  const act = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { const result = await contestRequest(body); if (typeof result.contestId === "string") setSelected(result.contestId); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "대회 요청에 실패했어요"); }
    finally { setBusy(false); }
  };
  const c = data?.contests.find(c => c.id === selected) ?? data?.contests[0];
  const mine = c?.attempts.find(a => a.uid === data?.userId);
  const isOpen = c && !c.finalizedAt && now + c.rules.limitMs + 30000 <= c.endsAt;
  return <div className="space-y-3 text-[11px] text-white/80">
    <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 leading-relaxed">
      같은 보스 <b>심연의 수호자 · 노말 · HP 120,000</b>를 혼자 처치하는 시간 기록전입니다. 3분 제한 · 계정당 1회 · 서버 시작/접수 시간으로 기록합니다. 장비와 레벨은 현재 캐릭터 기준입니다.
      <br />실패·이탈·시간 초과는 순위에서 제외합니다. 동률은 공동 순위이며 수상 순위의 동률은 모두 경품 대상입니다.
      <br />전투는 클라이언트에서 진행되어 변조를 완전히 막을 수 없습니다. <b>승인 대기 → GM 현장 확인 → 공식 기록 → 순위 확정 → 실제 경품 전달</b> 순서입니다.
    </p>
    {error && <p role="alert" className="rounded bg-rose-400/15 p-2 text-rose-200">{error}</p>}
    <button disabled={busy} onClick={() => void reload()} className="game-chip px-3 py-1.5">목록 새로고침</button>
    {data?.admin && <form className="space-y-2 rounded border border-white/15 p-2" onSubmit={e => { e.preventDefault(); void act({ action: "create", title, prize, places, minutes }); }}>
      <p className="font-black text-amber-200">GM 대회 개최 · 개최 즉시 서버 접수 시작</p>
      <label className="block">대회 이름<input required maxLength={50} value={title} onChange={e => setTitle(e.target.value)} className="game-input mt-1 w-full px-2 py-1.5" /></label>
      <label className="block">실물 경품<input required maxLength={100} value={prize} onChange={e => setPrize(e.target.value)} className="game-input mt-1 w-full px-2 py-1.5" /></label>
      <div className="flex gap-2"><label>수상 순위 (공동 순위 포함)<input aria-label="수상 순위" type="number" min={1} max={10} value={places} onChange={e => setPlaces(Number(e.target.value))} className="game-input w-16 px-2 py-1" /></label>
      <label>개최 시간 (분)<input aria-label="개최 시간 분" type="number" min={5} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="game-input w-16 px-2 py-1" /></label></div>
      <button disabled={busy} className="game-btn w-full px-2 py-2">대회 개최</button>
    </form>}
    {data && data.contests.length === 0 && <p>아직 열린 대회가 없습니다. GM이 대회를 개최하면 여기에 표시됩니다.</p>}
    {data && data.contests.length > 0 && <label className="block">대회 선택<select value={c?.id ?? ""} onChange={e => setSelected(e.target.value)} className="game-input mt-1 w-full px-2 py-2">{data.contests.map(c => <option key={c.id} value={c.id}>{c.title}{c.finalizedAt ? " · 순위 확정" : ""}</option>)}</select></label>}
    {c && <>
      <div className="rounded border border-white/15 p-2 leading-relaxed"><b className="text-amber-200">{c.title}</b><br />경품: {c.prize} · {c.places}위까지 (동률 포함)<br />서버 개최: {new Date(c.startsAt).toLocaleString("ko-KR")}<br />서버 종료: {new Date(c.endsAt).toLocaleString("ko-KR")}<br />{c.finalizedAt ? "순위 확정 · 경품 전달 가능" : isOpen ? `접수 중 · 종료까지 ${Math.max(0, Math.ceil((c.endsAt - now) / 60000))}분` : "신규 접수 마감 · 제출 기록 검토 중"}</div>
      {!data?.admin && !mine && <button disabled={busy || !isOpen || !!activeBossContest()} className="game-btn w-full px-3 py-2 disabled:opacity-40" onClick={async () => {
        setBusy(true); setError("");
        try { await prepareBossContest(c.id); onPlay(); } catch (e) { setError(e instanceof Error ? e.message : "출전 준비 실패"); } finally { setBusy(false); }
      }}>출전 준비 및 입장 (1회 소모)</button>}
      {mine && <div className="rounded border border-sky-300/30 p-2"><b>내 출전: {CONTEST_STATE[mine.state]}</b>{mine.elapsedMs !== undefined && <p>서버 기록 {(mine.elapsedMs / 1000).toFixed(3)}초</p>}{mine.reviewNote && <p>GM 검토: {mine.reviewNote}</p>}{mine.state === "running" && <p>재접속 후 출전은 재개되지 않습니다. 제한시간이 지나면 순위에서 제외됩니다.</p>}</div>}
      <div><p className="font-black text-amber-200">공식 기록 {c.finalizedAt ? "· 최종 순위" : "· GM 승인 순위 (변동 가능)"}</p>{c.official.length === 0 && <p className="py-2 text-white/60">아직 승인된 공식 기록이 없습니다.</p>}
      {c.official.map(a => <div key={a.id} className="my-1 flex flex-wrap items-center justify-between gap-1 rounded bg-white/5 p-2"><span>{a.rank}위 · {a.name} · {(a.elapsedMs! / 1000).toFixed(3)}초 {a.rank <= c.places ? "🏆" : ""}<br />{a.awardedAt ? `경품 전달 완료 · ${new Date(a.awardedAt).toLocaleString("ko-KR")}` : "경품 미지급"}{data?.admin && a.awardNote && <><br />전달 메모: {a.awardNote}</>}</span>
      {data?.admin && c.finalizedAt && a.rank <= c.places && !a.awardedAt && <button disabled={busy || !note.trim()} onClick={() => void act({ action: "award", contestId: c.id, attemptId: a.id, note })} className="game-chip px-2 py-1.5">실제 전달 완료 표시</button>}</div>)}</div>
      {data?.admin && <div className="space-y-2 rounded border border-amber-300/30 p-2"><p className="font-black text-amber-200">GM 검토 및 경품 대장 · 참가 {c.attempts.length}명</p>
      <label className="block">검토/거절/실제 전달 메모 (필수)<input value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="현장 확인 내용 · 개인정보는 적지 마세요" className="game-input mt-1 w-full px-2 py-2" /></label>
      {c.attempts.map(a => <div key={a.id} className="rounded bg-white/5 p-2"><p>{a.name} · {CONTEST_STATE[a.state]} {a.elapsedMs !== undefined ? `· ${(a.elapsedMs / 1000).toFixed(3)}초` : ""}</p>{a.evidence && <p className="text-white/60">클라이언트 보고: 잔여 HP {a.evidence.bossHp} · 피해 {a.evidence.damage} · {a.evidence.hits}회 타격 · {(a.evidence.combatMs / 1000).toFixed(3)}초</p>}{a.reviewNote && <p>검토 메모: {a.reviewNote} · {a.reviewedBy}</p>}
      {a.state === "pending" && !c.finalizedAt && <div className="mt-1 flex gap-2"><button disabled={busy || !note.trim()} onClick={() => void act({ action: "review", contestId: c.id, attemptId: a.id, decision: "approved", note })} className="game-chip px-2 py-1 text-emerald-200">현장 확인 후 승인</button><button disabled={busy || !note.trim()} onClick={() => void act({ action: "review", contestId: c.id, attemptId: a.id, decision: "rejected", note })} className="game-chip px-2 py-1 text-rose-200">거절</button></div>}</div>)}
      {!c.finalizedAt && <button disabled={busy || c.attempts.some(a => ["ready", "running", "pending"].includes(a.state))} onClick={() => void act({ action: "finalize", contestId: c.id })} className="game-btn w-full px-2 py-2 disabled:opacity-40">접수 마감 및 최종 순위 확정</button>}
      <p className="text-white/60">진행 중 출전과 승인 대기가 없어야 확정됩니다. 확정 뒤에는 순위/승인을 바꿀 수 없습니다. 경품은 직접 전달한 뒤 완료 표시해 주세요.</p></div>}
    </>}
  </div>;
}
