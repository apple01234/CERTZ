"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, X, Copy, Check, Footprints, UserRound } from "lucide-react";
import * as net from "@/game/net";
import { loadSave, mutateFriends, getFcode, type SaveData } from "@/game/config";
import { STAGE_SHORT, resolveStage } from "@/game/data";
import { EventBus } from "./EventBus";

/**
 * 친구 위젯 (v2.1 — 친구코드/고유번호 시스템)
 *  - 내 고유번호(6자리) 표시·복사 → 친구에게 공유
 *  - 친구 코드 추가/삭제 (세이브에 저장 — 기기별 유지)
 *  - 접속 중인 친구: 초록 점 + 현재 구역 + "이동"(따라가기) 버튼
 *  - 접속 중이 아닌 친구: 회색 점 (서버는 코드→온라인 상태만 중계)
 */
export function FriendsWidget() {
  const [open, setOpen] = useState(false);
  // 클라이언트 전용(ssr:false) — lazy 초기화
  const [friends, setFriends] = useState<{ code: string; name: string }[]>(() => loadSave()?.friends ?? []);
  const [online, setOnline] = useState<net.NetFriendOnline[]>([]);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [conn, setConn] = useState(() => net.netStatus());
  const [saveTick, setSaveTick] = useState(0);

  // 내 코드 — 세이브에서 (없으면 발급)
  const myCode = useMemo(() => {
    void saveTick;
    try {
      return getFcode();
    } catch {
      return "";
    }
  }, [saveTick]);

  useEffect(() => {
    const off = net.netOnFriends((list) => setOnline(list || []));
    const t = setInterval(() => setConn(net.netStatus()), 1500);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.key.toLowerCase() === "f") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onlineByCode = useMemo(() => {
    const m = new Map<string, net.NetFriendOnline>();
    for (const o of online) if (o.code) m.set(o.code, o);
    return m;
  }, [online]);

  const add = () => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(c)) {
      setErr("코드는 영문/숫자 4~12자입니다");
      return;
    }
    if (c === myCode) {
      setErr("내 코드는 추가할 수 없습니다");
      return;
    }
    const next = mutateFriends((list) =>
      list.some((f) => f.code === c) ? list : [...list, { code: c, name: onlineByCode.get(c)?.name ?? "" }]
    );
    setFriends(next);
    setCode("");
  };

  const remove = (c: string) => {
    const next = mutateFriends((list) => list.filter((f) => f.code !== c));
    setFriends(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 불가 환경 — 표시만으로 공유 가능 */
    }
  };

  const goto = (stage: string) => {
    EventBus.emit("friend:goto", { stage });
    setOpen(false);
  };

  const stageLabel = (stage: string) => STAGE_SHORT[resolveStage(stage)] ?? stage;

  return (
    <div className="absolute right-2 top-[168px] sm:right-3 sm:top-[190px] flex flex-col items-end gap-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="친구 열기 (F)"
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-emerald-200/30 bg-black/60 px-2.5 py-1.5 text-[11px] font-black text-emerald-200 backdrop-blur-sm transition-transform hover:bg-black/80 active:scale-95"
      >
        <UserRound size={13} />
        친구 <span className="rounded bg-white/10 px-1 text-[9px] text-white/50">F</span>
        {friends.length > 0 && (
          <span className="rounded bg-emerald-400/25 px-1 text-[9px] text-emerald-100">{friends.length}</span>
        )}
      </button>

      {open && (
        <div className="pointer-events-auto w-60 rounded-xl border border-emerald-200/25 bg-slate-950/95 p-2.5 shadow-2xl backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="flex items-center gap-1 text-[11px] font-black text-emerald-200">
              <UserRound size={12} /> 친구
            </p>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                conn.connected ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/45"
              }`}
            >
              {conn.connected ? "온라인" : conn.hasServer ? "연결 중…" : "오프라인"}
            </span>
          </div>

          {/* 내 고유번호 */}
          <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1.5">
            <span className="text-[10px] font-bold text-white/50">내 코드</span>
            <span className="font-mono text-[12px] font-black tracking-widest text-amber-200">{myCode}</span>
            <button onClick={copy} aria-label="코드 복사" className="ml-auto text-white/50 hover:text-white">
              {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
            </button>
          </div>

          {/* 친구 목록 */}
          {friends.length > 0 ? (
            <ul className="mb-2 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
              {friends.map((f) => {
                const o = onlineByCode.get(f.code);
                return (
                  <li
                    key={f.code}
                    className="flex items-center gap-1.5 rounded bg-white/[0.05] px-1.5 py-1 text-[11px] text-white/90"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${o ? "bg-emerald-400 shadow-[0_0_4px_#34d399]" : "bg-white/20"}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-bold">{o?.name || f.name || f.code}</span>
                    {o ? (
                      <>
                        <span className="shrink-0 text-[9px] text-white/45">
                          Lv.{o.lv} · {stageLabel(o.stage)}
                        </span>
                        <button
                          onClick={() => goto(o.stage)}
                          aria-label={`${f.code} 친구 따라가기`}
                          className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-black text-emerald-100 active:scale-95"
                        >
                          <Footprints size={9} /> 이동
                        </button>
                      </>
                    ) : (
                      <span className="shrink-0 text-[9px] text-white/35">오프라인</span>
                    )}
                    <button
                      onClick={() => remove(f.code)}
                      aria-label={`${f.code} 친구 삭제`}
                      className="shrink-0 text-white/30 hover:text-rose-300"
                    >
                      <X size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-2 rounded bg-white/[0.04] px-2 py-2 text-[10px] leading-snug text-white/40">
              아직 친구가 없습니다 — 친구의 코드를 추가하면 접속 중일 때 구역이 표시되고 바로 이동할 수 있어요.
            </p>
          )}

          {/* 코드 추가 */}
          <div className="flex gap-1">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                e.stopPropagation();
              }}
              placeholder="친구 코드 입력"
              maxLength={12}
              aria-label="친구 코드"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/70 px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-white/30"
            />
            <button
              onClick={add}
              className="flex items-center gap-0.5 rounded-lg border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[11px] font-black text-emerald-100 active:scale-95"
            >
              <UserPlus size={11} /> 추가
            </button>
          </div>
          {err && <p className="mt-1 text-[10px] font-bold text-rose-300">{err}</p>}
          <p className="mt-1.5 text-[10px] leading-snug text-white/40">
            친구끼리 코드를 서로 등록하면 접속 시 자동으로 온라인 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
