"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Globe, X } from "lucide-react";
import { netConnect, netJoined, isElectron } from "@/game/net";

const KEY = "sertz.server.url";

/** v2.9 (사용자 지시 #10) — 기본 게임 서버. APK 첫 실행 시 이 주소로 바로 연결해
 *  “멀티 안됨” 문제를 해소한다. 주소가 바뀌면 이 상수만 고치면 된다.
 *  v3.0.25 — 만료된 구 프리뷰 주소를 실제 서비스 주소로 교체
 *  v3.1.0 — 신규 서비스 주소 sertz4.space-z.ai 로 교체 (유저 확인)
 *  v3.2.0 — 구 서버 목록 자동 이행 추가: 덮어쓰기 설치 시 localStorage에 남은
 *           만료 주소 때문에 “APK에서 연동 안됨”이 재발하는 것을 근본 차단 */
const DEFAULT_SERVER = "https://sertz4.space-z.ai";

/* v3.2.0 — 서비스 종료/만료된 과거 기본 서버들 (자동 이행 대상) */
const DEAD_SERVERS = [
  "https://preview-6a94b1ab.space-z.ai",
  "https://preview-6a95efa8.space-z.ai",
  "https://sertz1234.space-z.ai",
  "http://preview-6a94b1ab.space-z.ai",
  "http://preview-6a95efa8.space-z.ai",
  "http://sertz1234.space-z.ai",
];

function readUrl(): string {
  try {
    return window.localStorage.getItem(KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * APK(네이티브) 전용 — 타이틀 화면 우하단 멀티플레이 서버 설정 버튼.
 *  - 웹 버전이 실행 중인 서버 주소(https://…)를 입력하면 그 서버 플레이어와 멀티플레이
 *  - 비우면 오프라인(싱글) 모드 — 연결 시도 자체를 하지 않아 배터리 낭비 없음
 *  - 웹(브라우저)에서는 same-origin 서버를 자동 사용하므로 이 UI를 렌더링하지 않는다
 */
export function ServerConnect() {
  // 클라이언트 전용(ssr:false) — lazy 초기화로 마운트 effect 없이 상태 확정
  // v3.0.8: EXE(Electron)도 설정 UI 표시 — 원격 멀티 서버 지정 가능 (기본 = 내장 로컬 서버)
  const [native] = useState(() => Capacitor.isNativePlatform() || isElectron());
  const [electron] = useState(() => isElectron());
  const [open, setOpen] = useState(() => {
    if (!Capacitor.isNativePlatform() && !isElectron()) return false;
    if (isElectron()) return false; // EXE는 기본(로컬 서버)으로 조용히 시작
    const u = readUrl();
    if (u) return false;
    let asked = false;
    try {
      asked = window.localStorage.getItem("sertz.server.asked") === "1";
      window.localStorage.setItem("sertz.server.asked", "1");
    } catch {
      /* noop */
    }
    return !asked; // 첫 실행이면 서버 설정창 자동 오픈 (v2.1)
  });
  const [url, setUrl] = useState(() => readUrl());
  const [saved] = useState(() => readUrl());
  const [online, setOnline] = useState(false);
  const [copied, setCopied] = useState(false);
  /* v3.2.0 — 12초 내 미연결 시 “연결 실패” 표시 + 원탭 복구 제공 */
  const [connFailed, setConnFailed] = useState(false);

  /* v2.9 — 서버 주소가 비어 있으면 기본 서버를 자동 저장해 즉시 연결 (멀티 첫 경험 개선).
   *  오프라인을 원하면 아래 ‘오프라인’ 버튼으로 해제 가능.
   *  v3.0.8: EXE(Electron) 제외 — 내장 로컬 서버(same-origin)가 기본.
   *  v3.2.0: 죽은 구 서버 주소가 저장돼 있으면 새 기본값으로 자동 이행. */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const cur = readUrl();
    if (DEAD_SERVERS.includes(cur)) {
      try {
        window.localStorage.setItem(KEY, DEFAULT_SERVER);
      } catch {
        /* noop */
      }
      window.location.reload();
      return;
    }
    if (cur) return;
    try {
      window.localStorage.setItem(KEY, DEFAULT_SERVER);
    } catch {
      /* noop */
    }
    window.location.reload();
  }, [native]);

  useEffect(() => {
    if (!native) return;
    netConnect(); // 타이틀에서 조기 접속 → 상태 실시간 표시 (EXE: 내장 로컬 서버 or 저장 주소)
    const t0 = Date.now();
    const t = setInterval(() => {
      const ok = netJoined();
      setOnline(ok);
      if (!ok && Date.now() - t0 > 12000) setConnFailed(true);
    }, 1500);
    return () => clearInterval(t);
  }, [native, saved]);

  if (!native) return null;

  const save = () => {
    const v = url.trim().replace(/\/$/, "");
    try {
      if (v) window.localStorage.setItem(KEY, v);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    window.location.reload(); // 소켓 싱글턴 재초기화를 위해 새로고침
  };

  const goOffline = () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  /** v3.2.0 — 연결 실패 시 원탭 기본 서버 복구 */
  const restoreDefault = () => {
    try {
      window.localStorage.setItem(KEY, DEFAULT_SERVER);
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  return (
    <div className="absolute bottom-3 right-3 z-50">
      {open ? (
        <div className="w-72 rounded-xl border border-white/15 bg-[#0b1020]/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black text-amber-200">멀티플레이 서버</p>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white" aria-label="닫기">
              <X size={14} />
            </button>
          </div>
          {/* v3.0.23 (#54) — APK↔PC 만남 안내: 현재 서버 주소 표시 + 복사 버튼.
              PC 브라우저에서 같은 주소를 열면 두 기기가 같은 서버에서 만난다. */}
          {saved && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-sky-300/25 bg-sky-950/40 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-black text-sky-300/80">현재 서버</p>
                <p className="truncate text-[10px] font-bold text-sky-100">{saved}</p>
              </div>
              <button
                onClick={() => {
                  try {
                    void navigator.clipboard.writeText(saved);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* noop */
                  }
                }}
                className="shrink-0 rounded-md border border-sky-300/40 bg-sky-500/20 px-2 py-1 text-[9px] font-black text-sky-100 active:scale-95"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          )}
          <p className="mb-2 text-[10px] leading-relaxed text-white/50">
            {electron
              ? "EXE는 내장 로컬 서버로 실행됩니다(싱글/같은 PC 멀티). 웹 버전 서버 주소를 입력하면 그 서버의 플레이어와 함께 플레이할 수 있습니다."
              : <>멀티 하는 법: ① 위 주소를 PC 브라우저로 열어 게임 시작 ② 폰 APK도 같은 주소 입력(자동 연결). 같은 주소로 접속한 기기끼리 같은 월드에서 만납니다.</>}
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://preview-xxxx.space-z.ai"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-[11px] text-white placeholder:text-white/25 focus:border-amber-300/60 focus:outline-none"
            spellCheck={false}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              className="flex-1 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-2 py-2 text-[11px] font-black text-slate-900 active:scale-95"
            >
              저장 & 새로고침
            </button>
            {connFailed && (
              <button
                onClick={restoreDefault}
                className="rounded-lg border border-rose-300/40 bg-rose-500/20 px-2.5 py-2 text-[11px] font-black text-rose-100 active:scale-95"
              >
                기본 서버 복구
              </button>
            )}
            <button
              onClick={goOffline}
              className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-2 text-[11px] font-bold text-white/70 active:scale-95"
            >
              오프라인
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {connFailed && (
            <button
              onClick={restoreDefault}
              className="rounded-full border border-rose-300/50 bg-rose-500/25 px-3 py-1.5 text-[10px] font-black text-rose-100 backdrop-blur active:scale-95"
            >
              기본 서버로 복구
            </button>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur active:scale-95"
          >
            <Globe size={12} className="text-sky-300" />
            {online ? (
              <span className="text-emerald-300">서버 연결됨</span>
            ) : connFailed ? (
              <span className="text-rose-300">연결 실패</span>
            ) : saved ? (
              <span className="text-amber-200/80">연결 중…</span>
            ) : electron ? (
              <span>로컬 모드</span>
            ) : (
              <span>오프라인 모드</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
