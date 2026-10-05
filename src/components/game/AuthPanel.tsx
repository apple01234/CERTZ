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
  authGoogle, // v1.0.2-beta — 구글 로그인(Firebase Auth ID 토큰 → 서버 검증·세션 발급)
  fetchSnsProviders,
  consumeAuthTokenFromHash, // v1.0.7 — SNS 콜백 해시 토큰 저장
  cloudSaveUpload,
  cloudSaveDownload,
  getApiServerHost, // v1.4.12 — GM 로그인 진단 (접속 서버 표시)
  type AuthUser,
  type SnsProviders,
} from "@/game/account";
import { SAVE_KEY } from "@/game/config";
import { resolveApiBase } from "@/game/server"; // v1.4.20 — 멀티서버 분리: 정적 배포에서 원격 서버 OAuth 시작

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
    consumeAuthTokenFromHash(); // v1.0.7 — SNS 콜백 토큰을 저장 후 /me 가 즉시 인식
    authMe().then(setUser).catch(() => {});
    fetchSnsProviders().then(setProviders).catch(() => {});
    /* v1.1.1 (#8 거래소) — 패널 안에서 바로 계정창을 열 수 있는 외부 오픈 이벤트
     *  (기존엔 우측 위 계정 버튼이 유일한 진입로라 "거래소 사용 불가"로 느껴졌다) */
    const onOpen = () => setOpen(true);
    EventBus.on("ui:authOpen", onOpen);
    return () => { EventBus.off("ui:authOpen", onOpen); };
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
      /* v1.4.12 (#6 GM 로그인 안됨) — 실패 원인에 접속 서버를 노출:
       *  GM(admin) 계정은 서버별로 관리되므로, 접속 서버가 구버전이거나 그 서버의
       *  admin 비밀번호가 다르면 로그인이 안 된다. 유저가 "어느 서버에서 실패했는지"
       *  알 수 있게 오류문에 호스트를 붙인다. */
      const base = String(r.data.error ?? "실패했어요");
      const hint = r.status === 401
        ? ` — 접속 서버: ${getApiServerHost()}`
        : r.status === 404
          ? " — 이 서버는 계정 기능이 없는 구버전이에요 (서버 연결에서 변경)"
          : "";
      setMsg(base + hint);
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
      /* v1.4.20 — 정적 배포(Vercel 등)에서는 원격 게임 서버의 OAuth 시작 경로로 이동 */
      window.location.assign(`${resolveApiBase()}/api/auth/sns/${key}/start`);
    } else {
      setMsg(`${SNS_META[key]?.label ?? key} 로그인은 서버 OAuth 키 미등록 상태예요 — 자체 회원가입을 이용해 주세요`);
    }
  };

  /* ═══ v1.0.2-beta — 구글 로그인 실연동 (Firebase Auth) ═══
   *  · 앱(Capacitor): @capacitor-firebase/authentication signInWithGoogle → 네이티브 구글 계정 선택창
   *    (동작 조건: android/app/google-services.json 투입 + Firebase Console에서 구글 공급자 활성화 + SHA-1 등록)
   *  · 웹(브라우저): Firebase JS SDK signInWithPopup
   *  · 획득한 ID 토큰을 /api/auth/google로 보내 서버 검증 → 기존 세션 체계와 동일하게 로그인 */
  const googleLogin = async () => {
    if (busy) return;
    setMsg("");
    setBusy(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      let idToken = "";
      if (Capacitor.isNativePlatform()) {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        const res = await FirebaseAuthentication.signInWithGoogle();
        idToken = res.credential?.idToken ?? ""; // OIDC 자격증명의 ID 토큰 (구글)
      } else {
        const { initializeApp, getApps } = await import("firebase/app");
        const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
        const app = getApps()[0] ?? initializeApp({ apiKey: "AIzaSyD8bXRnF1HA5RDFZitbds45BO2GX2KodmM", authDomain: "sertz-681eb.firebaseapp.com", projectId: "sertz-681eb" });
        const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
        idToken = await cred.user.getIdToken();
      }
      if (!idToken) {
        setMsg("구글 로그인 토큰을 받지 못했어요 — 다시 시도해 주세요");
        return;
      }
      const r = await authGoogle(idToken);
      if (!r.ok) {
        setMsg(String(r.data.error ?? "구글 로그인에 실패했어요"));
        return;
      }
      setUser((r.data.user as AuthUser) ?? null);
      EventBus.emit("banner:show", { text: `${(r.data.user as AuthUser)?.name ?? ""} 님, 구글 계정으로 로그인! — 클라우드 세이브 사용 가능` });
      EventBus.emit("auth:changed");
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
      if (msg.includes("cancel") || msg.includes("dismiss") || msg.includes("popup_closed")) {
        setMsg(""); // 유저가 창을 닫은 것 — 오류 아님
      } else if (msg.includes("developer_error") || msg.includes("apiexception") || msg.includes("10:") || msg.includes("12500") || msg.includes("12501") || msg.includes("not_found") || msg.includes("resources") || msg.includes("not implemented") || msg.includes("firebaseapp") && msg.includes("initialize")) {
        /* v1.0.3-beta — Android DEVELOPER_ERROR(코드 10)·리소스 부재·플러그인 로드 실패
         *  ("plugin is not implemented" = google-services.json 부재로 네이티브 플러그인이
         *   등록되지 않은 상태 — FirebaseAuth.getInstance()가 IllegalStateException을 내고
         *   Bridge가 조용히 스킵) = 전부 Firebase 콘솔 설정 미완료가 원인.
         *  유저가 "왜 안 되는지" 바로 알 수 있게 원인을 명시한다. */
        setMsg("구글 로그인 서버 설정이 아직 완료되지 않았어요 (운영자: Firebase 콘솔 Google 공급자 활성화 + Android 앱 SHA-1 등록 + google-services.json) — 자체 계정을 이용해 주세요");
      } else if (msg.includes("configuration-not-found") || msg.includes("operation-not-allowed") || msg.includes("api key") || msg.includes("firebaseapp") || msg.includes("not configured") || msg.includes("identitytoolkit") || msg.includes("permission_denied")) {
        setMsg("구글 로그인이 아직 서버에서 활성화되지 않았어요 (Firebase 설정 준비 중) — 자체 계정을 이용해 주세요");
      } else {
        setMsg(`구글 로그인 중 오류가 발생했어요 — 자체 계정을 이용해 주세요 (${msg.slice(0, 60)})`);
      }
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-white/20 bg-slate-900/90 px-3 py-2 text-[13px] font-bold text-white outline-none placeholder:text-white/30 focus:border-amber-300/70";

  return (
    <>
      {/* v1.4.8 (#3 겹침) — 우측 부유 계정 버튼 제거 → HUD 더보기 메뉴 + ui:authOpen 이벤트 진입로로 대체 */}

      {open && (
        /* v1.0.8 — 모바일 가화면(세로 360px급)에서 로그인 버튼이 하단에 잘리는 문제 수정:
         *  패널을 컴팩트하게 줄이고 + max-height 초과 시 내부 스크롤 허용 */
        <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center bg-black/60 px-3 py-3" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="sertz-scroll game-panel w-full max-w-[340px] max-h-[calc(100dvh-24px)] overflow-y-auto p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-sky-300" />
                <span className="text-sm font-black text-sky-200">계정</span>
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={doBackup} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-sky-200/60 bg-sky-500/25 px-3 py-2.5 text-[12px] font-black text-sky-100 transition-transform hover:bg-sky-500/40 active:scale-95 disabled:opacity-40">
                    <CloudUpload size={14} /> 세이브 백업
                  </button>
                  <button onClick={doRestore} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-200/50 bg-violet-500/20 px-3 py-2.5 text-[12px] font-black text-violet-100 transition-transform hover:bg-violet-500/35 active:scale-95 disabled:opacity-40">
                    <CloudDownload size={14} /> 세이브 복원
                  </button>
                </div>
                {/* v1.0.3 (#GM안내) — 관리자 계정 상태 표시: GM 로그인 방법을 패널에서 바로 알려준다 */}
                {user.role === "admin" && (
                  <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-2.5 py-2 text-[10px] font-black text-amber-200">
                    ✨ 관리자 계정 — 마을 우물 오른쪽의 GM NPC와 대화하면 운영자 패널이 열려요
                    <br />접속 서버: {getApiServerHost()}
                  </p>
                )}
                <p className="mt-2 text-[9px] font-bold leading-relaxed text-white/40">
                  백업은 3분마다 자동 실행돼요 · 복원하면 이 기기의 세이브가 교체돼요
                </p>
                <button onClick={doLogout} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-black text-white/70 hover:bg-white/10 active:scale-95">
                  <LogOut size={13} /> 로그아웃
                </button>
              </>
            ) : (
              <>
                {/* v1.0.2-beta — 구글 로그인 재개(Firebase Auth 실연동): 카카오·네이버는
                 *  OAuth 키 준비 전까지 일시 중단 유지. 구글 버튼은 앱/웹 모두 동일 UI. */}
                <button
                  onClick={googleLogin}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/70 bg-white px-4 py-2.5 text-[13px] font-black text-slate-800 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1z" />
                    <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
                  </svg>
                  구글로 로그인
                </button>
                <p className="mt-1.5 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-[9px] font-bold leading-relaxed text-white/45">
                  🔒 카카오·네이버 로그인은 일시 중단 중이에요 — 구글·자체 계정을 이용해 주세요
                </p>

                <div className="my-2 flex items-center gap-2 text-[9px] font-black text-white/30">
                  <span className="h-px flex-1 bg-white/15" /> 자체 계정 <span className="h-px flex-1 bg-white/15" />
                </div>

                <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                  <button onClick={() => { setMode("login"); setMsg(""); }} className={`rounded-lg py-1.5 text-[12px] font-black ${mode === "login" ? "bg-amber-400 text-slate-900" : "border border-white/15 bg-white/5 text-white/60"}`}>
                    로그인
                  </button>
                  <button onClick={() => { setMode("signup"); setMsg(""); }} className={`rounded-lg py-1.5 text-[12px] font-black ${mode === "signup" ? "bg-amber-400 text-slate-900" : "border border-white/15 bg-white/5 text-white/60"}`}>
                    회원가입
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <input ref={gate} {...swallowKeys} value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디 (영문 소문자/숫자 3~20자)" className={inputCls} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  {mode === "signup" && (
                    <input {...swallowKeys} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="게임 내 이름 (1~8자, 선택)" className={inputCls} maxLength={8} />
                  )}
                  <input {...swallowKeys} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호 (6자 이상)" className={inputCls} maxLength={40} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
                </div>
                <button onClick={submit} disabled={busy || !id || !pw} className="mt-1.5 w-full rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-[13px] font-black text-slate-900 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40">
                  {mode === "login" ? "로그인" : "이 정보로 가입!"}
                </button>
                {/* v1.4.0 (#4) — 관리자 로그인 방법 설명 완전 제거: 클라이언트에 운영자 진입 힌트 노출 금지 (서버 롤 검증만 유지) */}
              </>
            )}

            {msg && <p className="mt-2 rounded-lg bg-black/50 px-2.5 py-2 text-[11px] font-bold text-amber-200">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
