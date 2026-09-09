"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload, CloudDownload, KeyRound, LogOut, UserRound, X } from "lucide-react";
import { EventBus } from "./EventBus";
import { useKeyGate, swallowKeys } from "./inputGate";
import {
  authMe,
  authLogin,
  authRegister,
  authLogout,
  fetchSnsProviders,
  cloudSaveUpload,
  cloudSaveDownload,
  type AuthUser,
  type SnsProviders,
} from "@/game/account";
import { SAVE_KEY } from "@/game/config";

/**
 * v4.9.0 — 계정 패널 (유저 지시 #4)
 *  · 자체 회원가입/로그인 (아이디+비밀번호)
 *  · SNS 연동 로그인 (구글/카카오/네이버 — 서버에 OAuth 키 등록 시 활성화, 미설정 시 안내)
 *  · 클라우드 세이브 백업/복원 (로그인 유저 전용 — 기기 바꿔도 이어하기)
 *  · 3분마다 자동 백업 (로그인 중, 게임 플레이 중)
 */

const SNS_ORDER = ["google", "kakao", "naver"] as const;
const SNS_META: Record<string, { label: string; cls: string }> = {
  google: { label: "구글", cls: "border-white/25 bg-white/10 hover:bg-white/20 text-white" },
  kakao: { label: "카카오", cls: "border-amber-200/40 bg-amber-400/85 hover:bg-amber-300 text-slate-900" },
  naver: { label: "네이버", cls: "border-emerald-300/40 bg-emerald-500/85 hover:bg-emerald-400 text-white" },
};

export function AuthPanel() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [providers, setProviders] = useState<SnsProviders>({});
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [nick, setNick] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const gate = useKeyGate();

  useEffect(() => {
    authMe().then(setUser).catch(() => {});
    fetchSnsProviders().then(setProviders).catch(() => {});
  }, []);

  // 게임 진입 시 자동 백업 (3분 주기, 로그인 중일 때만)
  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) cloudSaveUpload(JSON.parse(raw)).catch(() => {});
      } catch { /* 세이브 파싱 실패 무시 */ }
    }, 3 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [user]);

  const refreshSaveInfo = async () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const submit = async () => {
    if (busy) return;
    setMsg("");
    setBusy(true);
    const r =
      mode === "login"
        ? await authLogin(id, pw)
        : await authRegister(id, pw, nick || id.slice(0, 8));
    setBusy(false);
    if (!r.ok) {
      setMsg(String(r.data.error ?? "실패했어요"));
      return;
    }
    setUser((r.data.user as AuthUser) ?? null);
    setMsg("");
    setPw("");
    EventBus.emit("banner:show", { text: `${(r.data.user as AuthUser)?.name ?? ""} 계정 로그인! — 클라우드 세이브 사용 가능` });
    EventBus.emit("auth:changed"); // v1.0.6 — 씬이 로드된 뒤 로그인해도 GM NPC/관리자 UI가 즉시 갱신되도록
  };

  const doLogout = async () => {
    await authLogout();
    setUser(null);
    setMsg("");
    EventBus.emit("auth:changed"); // v1.0.6 — 로그아웃 시 관리자 UI 즉시 해제
  };

  const doBackup = async () => {
    setMsg("");
    const data = await refreshSaveInfo();
    if (!data) {
      setMsg("백업할 세이브가 없어요 — 게임을 시작한 뒤 시도해 주세요");
      return;
    }
    setBusy(true);
    const r = await cloudSaveUpload(data);
    setBusy(false);
    setMsg(r.ok ? "클라우드 백업 완료! 어느 기기에서든 복원할 수 있어요" : (r.error ?? "백업 실패"));
  };

  const doRestore = async () => {
    setMsg("");
    setBusy(true);
    const r = await cloudSaveDownload();
    setBusy(false);
    if (!r.ok || !r.data) {
      setMsg(r.error ?? "클라우드에 백업된 세이브가 없어요");
      return;
    }
    if (!window.confirm("클라우드 세이브로 이 기기를 덮어쓸까요? 현재 기기의 세이브가 교체돼요.")) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(r.data));
      window.location.reload();
    } catch {
      setMsg("복원 실패 — 저장 공간을 확인해 주세요");
    }
  };

  const snsStart = (key: string) => {
    const p = providers[key];
    if (p?.configured) {
      window.location.assign(`/api/auth/sns/${key}/start`);
    } else {
      setMsg(`${SNS_META[key]?.label ?? key} 로그인은 서버 OAuth 키 미등록 상태예요 — 자체 회원가입을 이용해 주세요`);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-white/20 bg-slate-900/90 px-3 py-2.5 text-[13px] font-bold text-white outline-none placeholder:text-white/30 focus:border-amber-300/70";

  return (
    <>
      {/* 위젯 버튼 — 파티(132px)/친구(168px) 아래 우측 스택 */}
      <div className="pointer-events-none absolute right-2 top-[204px] flex flex-col items-end gap-1.5 sm:right-3 sm:top-[228px]">
        <button
          aria-label="계정 창 열기"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-8 items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 text-[10px] font-black text-white/75 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
        >
          <UserRound size={13} />
          계정
          {user && <span className="rounded bg-emerald-400/25 px-1 text-[8px] text-emerald-100">ON</span>}
        </button>
      </div>

      {open && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-4" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border-2 border-sky-200/50 bg-slate-950/95 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={17} className="text-sky-300" />
                <span className="text-base font-black text-sky-200">계정</span>
              </div>
              <button aria-label="계정 창 닫기" onClick={() => setOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/70 hover:bg-black/70">
                <X size={13} />
              </button>
            </div>

            {user ? (
              <>
                <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3">
                  <p className="text-[13px] font-black text-emerald-100">{user.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-white/45">
                    {user.id} · {user.provider === "local" ? "자체 가입" : `${SNS_META[user.provider]?.label ?? user.provider} 연동`}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={doBackup} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-sky-200/60 bg-sky-500/25 px-3 py-3 text-[12px] font-black text-sky-100 transition-transform hover:bg-sky-500/40 active:scale-95 disabled:opacity-40">
                    <CloudUpload size={14} /> 세이브 백업
                  </button>
                  <button onClick={doRestore} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-200/50 bg-violet-500/20 px-3 py-3 text-[12px] font-black text-violet-100 transition-transform hover:bg-violet-500/35 active:scale-95 disabled:opacity-40">
                    <CloudDownload size={14} /> 세이브 복원
                  </button>
                </div>
                {/* v1.0.3 (#GM안내) — 관리자 계정 상태 표시: GM 로그인 방법을 패널에서 바로 알려준다 */}
                {user.role === "admin" && (
                  <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-2.5 py-2 text-[10px] font-black text-amber-200">
                    ✨ 관리자 계정 — 마을 우물 오른쪽의 GM NPC와 대화하면 운영자 패널이 열려요
                  </p>
                )}
                <p className="mt-2 text-[10px] font-bold leading-relaxed text-white/40">
                  백업은 3분마다 자동 실행돼요 · 복원하면 이 기기의 세이브가 클라우드 버전으로 교체돼요
                </p>
                <button onClick={doLogout} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-black text-white/70 hover:bg-white/10 active:scale-95">
                  <LogOut size={13} /> 로그아웃
                </button>
              </>
            ) : (
              <>
                {/* SNS 연동 로그인 */}
                <p className="mb-1.5 text-[11px] font-black text-white/55">SNS로 시작하기 (계정 자동 연동)</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {SNS_ORDER.map((k) => (
                    <button key={k} onClick={() => snsStart(k)} className={`rounded-xl border-2 px-2 py-2.5 text-[12px] font-black transition-transform active:scale-95 ${SNS_META[k].cls}`}>
                      {SNS_META[k].label}
                      {providers[k] && !providers[k].configured && <span className="block text-[8px] opacity-60">미설정</span>}
                    </button>
                  ))}
                </div>

                <div className="my-3 flex items-center gap-2 text-[9px] font-black text-white/30">
                  <span className="h-px flex-1 bg-white/15" /> 또는 자체 계정 <span className="h-px flex-1 bg-white/15" />
                </div>

                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  <button onClick={() => { setMode("login"); setMsg(""); }} className={`rounded-lg py-2 text-[12px] font-black ${mode === "login" ? "bg-amber-400 text-slate-900" : "border border-white/15 bg-white/5 text-white/60"}`}>
                    로그인
                  </button>
                  <button onClick={() => { setMode("signup"); setMsg(""); }} className={`rounded-lg py-2 text-[12px] font-black ${mode === "signup" ? "bg-amber-400 text-slate-900" : "border border-white/15 bg-white/5 text-white/60"}`}>
                    회원가입
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <input ref={gate} {...swallowKeys} value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디 (영문 소문자/숫자 3~20자)" className={inputCls} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  {mode === "signup" && (
                    <input {...swallowKeys} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="게임 내 이름 (1~8자, 선택)" className={inputCls} maxLength={8} />
                  )}
                  <input {...swallowKeys} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호 (6자 이상)" className={inputCls} maxLength={40} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
                </div>
                <button onClick={submit} disabled={busy || !id || !pw} className="mt-2 w-full rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 text-[13px] font-black text-slate-900 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40">
                  {mode === "login" ? "로그인" : "이 정보로 가입!"}
                </button>
                {/* v1.0.3 (#GM안내) — "GM 로그인 어케함?" 해결: 방법을 로그인 화면에 직접 표기 */}
                <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-400/[0.08] px-2.5 py-2 text-[10px] font-bold leading-relaxed text-amber-200/85">
                  🛠 GM(운영자) 로그인: <b className="text-amber-100">admin</b> 또는 <b className="text-amber-100">apple01234</b> 아이디로 회원가입/로그인하면 자동으로 관리자 인정돼요 — 로그인 후 마을에 GM NPC가 나타납니다.
                </p>
              </>
            )}

            {msg && <p className="mt-2 rounded-lg bg-black/50 px-2.5 py-2 text-[11px] font-bold text-amber-200">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
