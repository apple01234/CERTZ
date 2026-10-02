"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Globe, X } from "lucide-react";
import { netConnect, isElectron } from "@/game/net";
import { storedServerUrl } from "@/game/server";

const KEY = "sertz.server.url";

/** v2.9 (사용자 지시 #10) — 기본 게임 서버. APK 첫 실행 시 이 주소로 바로 연결해
 *  “멀티 안됨” 문제를 해소한다. 주소가 바뀌면 이 상수만 고치면 된다.
 *  v3.0.25 — 만료된 구 프리뷰 주소를 실제 서비스 주소로 교체
 *  v3.1.0 — 신규 서비스 주소 sertz4.space-z.ai 로 교체 (유저 확인)
 *  v3.2.0 — 구 서버 목록 자동 이행 추가: 덮어쓰기 설치 시 localStorage에 남은
 *           만료 주소 때문에 “APK에서 연동 안됨”이 재발하는 것을 근본 차단
 *  v1.0.9 (#GM로그인) — sertz4 만료 판단으로 sertz.z.ai 전환 — 그러나 이 주소는 DNS 미등록 도메인이었음(외부 검증 부재, localhost로만 확인한 실수)
 *  v1.0.12 (#접속불가 리포트) — 외부 실프측 재검증: sertz.z.ai = "Domain could not be resolved"(DNS 미존재),
 *           sertz4.space-z.ai = 생존 확인(외부 page_reader 200, 구버전 가이드 서빙 — 유저 계정 DB가 있는 살아있는 유일 엔드포인트).
 *           기본값을 sertz4로 복원 + sertz.z.ai를 DEAD_SERVERS에 등록(기존 v1.0.9~11 설치분 자동 복귀).
 *           클라이언트 API 계약은 v1.0.8 이후 불변이므로 구 서버와 호환. 서버 이전 시 이 상수+DEAD_SERVERS 한 쌍만 갱신.
 *  v1.4.20 — 서버 이전: sertz4 → sertz11.space-z.ai (현재 라이브 게임 서버 본체).
 *           멀티서버 분리 아키텍처의 유일한 게임 서버(소켓+계정/거래소/랭킹 API).
 *           구 기본값 sertz4는 DEAD_SERVERS로 이동 — 구 APK 설치분도 첫 기동에 자동 이행.
 *  v1.4.21 — 유저 지시: 기본 주소를 Vercel 미러(sertz.vercel.app)로 전환.
 *           미러 주소는 '입구 주소'일 뿐 — 소켓/계정 API는 server.ts의 미러 해석을 통해
 *           게임 서버 본체(GAME_SERVER = sertz11)로 자동 우회 접속된다.
 *           본체 주소가 바뀌면 APK 재설치 없이 vercel.json env 한 줄만 고치면 된다.
 *  v1.4.22 — ②안 전환: 계정·거래소·랭킹 API가 Vercel serverless로 이주 (GitHub-as-DB).
 *           멀티플레이는 제외(오프라인 모드 — 소켓 시도 없음). 기본 주소는 그대로
 *           sertz.vercel.app — 이제 계정/거래소가 그 오리진에서 직접 동작한다.
 *           구 게임 서버 sertz11·sertz5는 DEAD_SERVERS로 이동 — 저장분 자동 이행.
 *  v1.4.24 — 연결 판정 전환(②안 오타보 수정): 소켓 netJoined()는 ②안에서 영원히 false
 *           (Vercel은 소켓 서버가 없음 — 설계상 오프라인) → 12초 후 무조건 “연결 실패”
 *           오타보가 뜨는 유저 리포트 실측. 판정을 계정 API 헬스체크로 교체:
 *           저장 주소 + GET {주소}/api/version(CORS * 실측 확인, 6초 타임아웃).
 *           성공 = “서버 연결됨” / 실패만 “연결 실패”+복구 / 미저장 = “오프라인 모드”. */
const DEFAULT_SERVER = "https://sertz.vercel.app";

/* v3.2.0 — 서비스 종료/만료된 과거 기본 서버들 (자동 이행 대상)
 *  v1.0.12 — sertz4 복원(생존 실측)에 따라 목록에서 제외, 대신 DNS 미존재가 실측된
 *           sertz.z.ai를 등록 — v1.0.9~11 설치분도 첫 기동에 sertz4로 자동 복귀된다.
 *  v1.4.20 — 서버가 sertz11로 이전됨에 따라 sertz4를 목록에 등록 —
 *           sertz4 저장분(구 APK)도 첫 기동에 sertz11로 자동 이행된다.
 *  v1.4.22 — space-z.ai 게임 서버 전량 폐기(②안 Vercel serverless 전환):
 *           sertz11(Recycled)·sertz5(폐기) 등록 — 저장분 첫 기동에 Vercel 기본값으로 자동 이행. */
const DEAD_SERVERS = [
  "https://preview-6a94b1ab.space-z.ai",
  "https://preview-6a95efa8.space-z.ai",
  "https://sertz1234.space-z.ai",
  "https://sertz.z.ai",
  "https://sertz4.space-z.ai",
  "https://sertz11.space-z.ai",
  "https://sertz5.space-z.ai",
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
  /* v3.2.0 — 미연결 시 “연결 실패” 표시 + 원탭 복구 제공
   *  v1.4.24 — 판정 주체를 소켓(netJoined)에서 계정 API 헬스체크로 교체 (②안 오타보 수정) */
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
    netConnect(); // ②안: GAME_SERVER 빈값 → null(소켓 시도 없음). 멀티 재개 시 자동 부활
    /* v1.4.24 — 계정 API 헬스체크로 연결 상태 판정 (소켓 판정은 ②안에서 항상 실패).
     *  저장 주소가 없으면 오프라인 모드(의도적 상태 — 알람 아님)로 확정. */
    let alive = true;
    const check = async () => {
      const base = storedServerUrl(); // 트레일링 슬래시·http 승격 정규화 완료
      if (!base) {
        if (alive) {
          setOnline(false);
          setConnFailed(false);
        }
        return;
      }
      try {
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(base + "/api/version", { cache: "no-store", signal: ctrl.signal });
        window.clearTimeout(to);
        if (alive) {
          setOnline(res.ok);
          setConnFailed(!res.ok);
        }
      } catch {
        if (alive) {
          setOnline(false);
          setConnFailed(true);
        }
      }
    };
    void check();
    const t = setInterval(check, 30000); // 정적 라우트(CDN) — 가벼운 재확인
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [native, saved]);

  if (!native) return null;

  const save = () => {
    /* v1.4.3 (#데이터보안) — 모든 서버 통신은 암호화 전송(HTTPS)만 허용:
     *  Play Console 데이터 보안 "수집 데이터 전체 암호화 전송: 예" 답변의 근거.
     *  http:// 입력은 강제로 https://로 승격한다. */
    const v = url
      .trim()
      .replace(/\/$/, "")
      .replace(/^http:\/\//i, "https://");
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
        <div className="game-panel w-72 p-3">
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
              : "계정·거래소·랭킹은 이 주소(Vercel)에서 바로 동작합니다. 실시간 멀티플레이는 현재 제외 — 오프라인 모드로 플레이해 주세요."}
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sertz.vercel.app"
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
