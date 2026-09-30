"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, LogOut, Crown, Swords, CheckCircle2, Gift, X } from "lucide-react";
import * as net from "@/game/net";
import {
  partySynergies, partyBoard, partyBoardResetsIn, PARTY_MISSION_POOL,
  SOLO_BLESS_EXP_PCT, type PartyMissionDef,
} from "@/game/partyContent";
import { EventBus } from "./EventBus";

/**
 * 파티 위젯 (v2.0 — 지시 #5 파티 & 보스 토벌 / v1.4.3 — 작업4 파티 콘텐츠)
 *  - 파티 창설 / 코드 참여 / 탈퇴 / 멤버 목록 (서버 릴레이)
 *  - 파티 채팅은 ChatBox에서 [파티] 프리픽스 메시지로 표시
 *  - v1.4.3 신설:
 *    · 파티 시너지 콤보 — 계열 조합별 실전 버프를 실시간 표시 (EXP/골드에 실적용)
 *    · 오늘의 파티 미션 — 파티 중일 때만 카운트, 파티 중 수령 시 풀 보상 / 솔로 50%
 *    · 솔로 가호 — 파티 없이 사냥해도 EXP +5% (솔로 유저 소외 방지)
 */
export function PartyWidget() {
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState<net.NetParty | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    const off = net.netOnParty((p) => {
      setParty(p);
      if (p === null) setErr("파티에 참여하지 못했습니다 — 코드 확인");
      refresh();
    });
    return off;
  }, [refresh]);

  /* 보드 진행도 실시간 갱신 (WorldScene 훅이 localStorage에 기록) */
  useEffect(() => {
    if (!open) return;
    const iv = window.setInterval(refresh, 2000);
    return () => window.clearInterval(iv);
  }, [open, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.key.toLowerCase() === "y") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    /* v1.4.5 (#멀티입구) — HUD 더보기의 "멀티" 버튼에서도 파티 창을 연다
     * v1.4.8 — HUD 더보기 "파티" 버튼도 같은 이벤트 사용 */
    const onToggle = () => setOpen((v) => !v);
    EventBus.on("party:toggle", onToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      EventBus.off("party:toggle", onToggle);
    };
  }, []);

  const create = () => {
    setErr("");
    if (!net.netJoined()) {
      setErr(net.netStatus().hasServer ? "서버 연결 중입니다 — 잠시 후 다시 시도" : "오프라인 모드 — 타이틀 화면에서 서버 연결 후 이용할 수 있습니다");
      return;
    }
    net.netPartyCreate();
  };
  const join = () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (!net.netJoined()) {
      setErr(net.netStatus().hasServer ? "서버 연결 중입니다 — 잠시 후 다시 시도" : "오프라인 모드 — 타이틀 화면에서 서버 연결 후 이용할 수 있습니다");
      return;
    }
    net.netPartyJoin(c);
  };
  const leave = () => {
    setErr("");
    net.netPartyLeave();
  };

  /* v1.4.3 — 파티 콘텐츠 상태 */
  const inParty = !!(party && party.members.length >= 2);
  const synergies = partySynergies(party);
  const board = partyBoard();
  const resetsIn = partyBoardResetsIn();
  const resetMin = Math.floor(resetsIn / 60000);
  const boardMissions: PartyMissionDef[] = board.missionIds
    .map((id) => PARTY_MISSION_POOL.find((m) => m.id === id))
    .filter((m): m is PartyMissionDef => !!m);

  return (
    <>
      {open && (
        /* v1.4.8 (#3 겹침) — 좌측 부유 버튼 스택 철거 → 중앙 모달 전환.
         *  퀘스트 트래커·채팅·월드 UI와 좌표가 겹치던 근원을 차단하고,
         *  공동 토벌전 입구는 모달 헤더로 이동해 접근성 유지. */
        <div
          className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-black/60 px-3 py-3"
          onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
        <div className="sertz-scroll game-panel w-full max-w-[340px] max-h-[calc(100dvh-24px)] overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1 text-[12px] font-black text-sky-200">
              <Users size={13} /> 파티 (최대 4인)
              {party && <span className="rounded bg-sky-400/25 px-1 text-[9px] text-sky-100">{party.members.length}명</span>}
            </p>
            <button aria-label="파티 창 닫기" onClick={() => setOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/70 hover:bg-black/70">
              <X size={13} />
            </button>
          </div>

          {/* v1.4.3 공동 토벌전 입구 — v1.4.8부터 모달 헤더 아래 배치 (부유 버튼 철거 대체).
           *  파티 없이 단독 입장도 가능(보스 HP/보상은 파티 인원 비례) — 파티 모집 동기가 된다. */}
          <button
            onClick={() => EventBus.emit("rpg:partyRaid", {})}
            aria-label="파티 공동 토벌전 입장"
            title="파티원과 함께 심연의 감시자를 토벌 — 인원수만큼 보스 강화·보상 증가 (단독 입장 가능)"
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200/30 bg-black/60 px-2.5 py-2 text-[11px] font-black text-indigo-200 transition-transform hover:bg-black/80 active:scale-95"
          >
            <Swords size={13} />
            공동 토벌전 입장
            {party && party.members.length > 1 && <span className="rounded bg-indigo-400/25 px-1 text-[9px] text-indigo-100">×{party.members.length}</span>}
          </button>

          {party ? (
            <>
              <ul className="mb-2 flex flex-col gap-0.5">
                {party.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-1.5 rounded bg-white/[0.05] px-1.5 py-1 text-[11px] text-white/90"
                  >
                    {m.name === party.leader && <Crown size={11} className="text-amber-300" />}
                    <span className="font-bold">{m.name}</span>
                    <span className="text-white/45">Lv.{m.lv}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-1.5 text-[10px] text-white/40">
                파티 코드 <span className="font-black text-amber-200">{party.id}</span> — 친구에게 공유!
              </p>

              {/* ===== v1.4.3 (작업4) — 파티 시너지 콤보 ===== */}
              <div className="mb-2 rounded-lg border border-violet-300/25 bg-violet-500/[0.08] px-2 py-1.5">
                <p className="mb-1 text-[10px] font-black text-violet-200">⚔ 파티 시너지 {synergies.length > 0 ? `— ${synergies.length}종 발동` : "(2인부터 발동)"}</p>
                {synergies.length === 0 && (
                  <p className="text-[9px] font-bold leading-snug text-white/40">
                    서로 다른 직업 계열을 모으면 보너스가 커진다! (현재 {party.members.length}인)
                  </p>
                )}
                {synergies.map((s) => (
                  <p key={s.id} className="mt-0.5 text-[9px] font-black leading-snug" style={{ color: s.color }}>
                    ● {s.name} — {s.desc.replace(/^.*— /, "")}
                  </p>
                ))}
              </div>

              {/* v1.4.3 (멀티 콘텐츠) — 파티 내에서도 바로 입장할 수 있는 공동 토벌전 버튼 */}
              <button
                onClick={() => EventBus.emit("rpg:partyRaid", {})}
                className="mb-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-indigo-300/40 bg-indigo-500/20 px-2 py-1.5 text-[11px] font-black text-indigo-100 active:scale-95"
              >
                <Swords size={12} /> 공동 토벌전 입장
              </button>

              <button
                onClick={leave}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-rose-300/30 bg-rose-500/15 px-2 py-1.5 text-[11px] font-black text-rose-200 active:scale-95"
              >
                <LogOut size={12} /> 파티 탈퇴
              </button>
            </>
          ) : (
            <>
              <button
                onClick={create}
                className="mb-1.5 w-full rounded-lg border border-sky-300/40 bg-sky-500/20 px-2 py-1.5 text-[11px] font-black text-sky-100 active:scale-95"
              >
                파티 창설
              </button>
              <div className="flex gap-1">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") join();
                    e.stopPropagation();
                  }}
                  placeholder="코드 입력"
                  maxLength={8}
                  aria-label="파티 코드"
                  className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/70 px-2 py-1 text-[11px] font-bold text-white outline-none placeholder:text-white/30"
                />
                <button
                  onClick={join}
                  className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-black text-white/90 active:scale-95"
                >
                  참여
                </button>
              </div>
              {err && <p className="mt-1 text-[10px] font-bold text-rose-300">{err}</p>}
              <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                파티원과 같은 구역에 보이고, 보스 출현이 파티 전체에 공지됩니다. 혼자 사냥하면 <b className="text-emerald-300">EXP +{SOLO_BLESS_EXP_PCT}%</b>(단독 가호)가 붙습니다.
                <br />
                <span className="font-bold text-indigo-200/80">공동 토벌전</span>에서 파티원 수만큼 보스 HP·보상이 커집니다.
              </p>
            </>
          )}

          {/* ===== v1.4.3 (작업4) — 오늘의 파티 미션 (파티 퀘스트 보드) ===== */}
          <div className="mt-2 rounded-lg border border-emerald-300/25 bg-emerald-500/[0.07] px-2 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-black text-emerald-200">
              <Swords size={10} /> 오늘의 파티 미션
              <span className="ml-auto text-[8px] font-bold text-white/35">갱신 {resetMin}분 전</span>
            </p>
            {!inParty && (
              <p className="mt-0.5 text-[9px] font-bold leading-snug text-white/40">
                파티 중일 때만 카운트된다! 수령은 혼자도 가능(보상 50%)
              </p>
            )}
            <ul className="mt-1 flex flex-col gap-1">
              {boardMissions.map((m) => {
                const prog = board.progress[m.id] ?? 0;
                const done = prog >= m.need;
                const claimed = board.claimed[m.id] ?? false;
                return (
                  <li key={m.id} className="rounded-md border border-white/10 bg-black/40 px-1.5 py-1">
                    <div className="flex items-center justify-between gap-1">
                      <b className={`truncate text-[10px] ${claimed ? "text-white/30 line-through" : done ? "text-emerald-200" : "text-white/85"}`}>{m.title}</b>
                      <span className="shrink-0 text-[9px] font-black text-white/50">{prog}/{m.need}{m.unit}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${Math.min(100, (prog / m.need) * 100)}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[8px] font-bold text-amber-200/80">{m.gold.toLocaleString()}G · EXP {m.exp}{inParty ? "" : " (솔로 50%)"}</span>
                      {claimed ? (
                        <span className="flex items-center gap-0.5 text-[9px] font-black text-white/30"><CheckCircle2 size={9} /> 수령 완료</span>
                      ) : done ? (
                        <button
                          onClick={() => { EventBus.emit("rpg:partyClaim", { id: m.id }); setTimeout(refresh, 120); }}
                          className="flex items-center gap-0.5 rounded-md border border-emerald-300/50 bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-black text-emerald-100 active:scale-95"
                        >
                          <Gift size={9} /> 수령
                        </button>
                      ) : (
                        <span className="text-[8px] font-bold text-white/25">진행 중</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        </div>
      )}
    </>
  );
}
