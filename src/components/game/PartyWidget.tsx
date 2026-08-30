"use client";

import { useEffect, useState } from "react";
import { Users, LogOut, Crown } from "lucide-react";
import * as net from "@/game/net";

/**
 * 파티 위젯 (v2.0 — 지시 #5 파티 & 보스 토벌)
 *  - 파티 창설 / 코드 참여 / 탈퇴 / 멤버 목록 (서버 릴레이)
 *  - 파티 채팅은 ChatBox에서 [파티] 프리픽스 메시지로 표시
 */
export function PartyWidget() {
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState<net.NetParty | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const off = net.netOnParty((p) => {
      setParty(p);
      if (p === null) setErr("파티에 참여하지 못했습니다 — 코드 확인");
    });
    return off;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.key.toLowerCase() === "y") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const create = () => {
    setErr("");
    net.netPartyCreate();
  };
  const join = () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!c) return;
    net.netPartyJoin(c);
  };
  const leave = () => {
    setErr("");
    net.netPartyLeave();
  };

  return (
    <div className="absolute right-2 top-[132px] sm:right-3 sm:top-[150px] flex flex-col items-end gap-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="파티 열기 (Y)"
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-sky-200/30 bg-black/60 px-2.5 py-1.5 text-[11px] font-black text-sky-200 backdrop-blur-sm transition-transform hover:bg-black/80 active:scale-95"
      >
        <Users size={13} />
        파티 <span className="rounded bg-white/10 px-1 text-[9px] text-white/50">Y</span>
        {party && <span className="rounded bg-sky-400/25 px-1 text-[9px] text-sky-100">{party.members.length}</span>}
      </button>

      {open && (
        <div className="pointer-events-auto w-56 rounded-xl border border-sky-200/25 bg-slate-950/95 p-2.5 shadow-2xl backdrop-blur">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-black text-sky-200">
            <Users size={12} /> 파티 (최대 4인)
          </p>

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
                파티원과 같은 구역에 보이고, 보스 출현이 파티 전체에 공지됩니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
