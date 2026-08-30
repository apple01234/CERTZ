"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Globe, X } from "lucide-react";
import { netConnect, netJoined } from "@/game/net";

const KEY = "sertz.server.url";

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
  const [native] = useState(() => Capacitor.isNativePlatform());
  const [open, setOpen] = useState(() => {
    if (!Capacitor.isNativePlatform()) return false;
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

  useEffect(() => {
    if (!native) return;
    if (saved) netConnect(); // 타이틀에서 조기 접속 → 상태 실시간 표시
    const t = setInterval(() => setOnline(netJoined()), 1500);
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
          <p className="mb-2 text-[10px] leading-relaxed text-white/50">
            웹 버전이 실행 중인 서버 주소(https://…)를 입력하면 그 서버의 플레이어와 함께
            플레이합니다. 비우면 오프라인(싱글) 모드로 실행됩니다.
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
            <button
              onClick={goOffline}
              className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-2 text-[11px] font-bold text-white/70 active:scale-95"
            >
              오프라인
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur active:scale-95"
        >
          <Globe size={12} className="text-sky-300" />
          {saved ? (
            online ? (
              <span className="text-emerald-300">서버 연결됨</span>
            ) : (
              <span className="text-amber-200/80">연결 중…</span>
            )
          ) : (
            <span>오프라인 모드</span>
          )}
        </button>
      )}
    </div>
  );
}
