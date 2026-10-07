"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { History, MessageCircle, SendHorizontal, X } from "lucide-react";
import { netChatReady } from "@/game/net";

/**
 * 멀티플레이 전체 채팅 (v1.7 / v2.3 개선)
 *  - Enter: 입력 열기/전송 · ESC: 취소 · 전송 버튼(모바일) 추가
 *  - 입력 포커스 동안 게임 키 완전 차단 (EventBus "chat:focus" → WorldScene)
 *  - v2.3 (지시 #7): 미연결 시 조용히 사라지던 메시지 → 로컬 안내 메시지로 즉시 피드백
 *  - v2.3: onBlur 즉시 닫기 제거 (모바일 가상 키보드 blur로 입력이 닫히는 문제)
 *    → 전송/ESC/바깥 포인터다운으로만 닫기
 */
type Msg = { id: string; name: string; text: string; sys?: boolean; party?: boolean; t: number };

const COLLAPSE_KEY = "sertz.chat.collapsed";

/* v1.2.0 (#5) — 채팅 목록 최대 높이: 이 값을 넘어 불어나면 위(오래된 메시지)부터 자동 잘라낸다.
 *  화면 높이의 32%를 상한으로 하되 120~200px 사이로 클램프 — 좌하단 HUD를 덮지 않게.
 *  최소 3개는 남긴다(완전 소실 방지) — 새 메시지가 오면 여유가 될 때 다시 위쪽도 보여준다. */
const CHAT_MAX_H = (() => {
  try {
    const h = Math.min(200, Math.max(120, Math.round(window.innerHeight * 0.32)));
    return h;
  } catch {
    return 168;
  }
})();
const CHAT_MIN_VISIBLE = 3;
const CHAT_MAX_VISIBLE = 7;
/* v1.4.29 (#채팅기록50) — 채팅 기록 보관 상한: 유저 지시 "최근 채팅기록 50개까지는 스크롤 해서
 *  확인 가능하게" — 41개 → 50개로 상향. 부유 목록은 여전히 최신 몇 개만 보여주고(조이스틱
 *  겹침 회피 — pointer-events-none 유지), [기록] 버튼으로 여는 채팅 기록 뷰에서 전체 50개를
 *  스크롤해 확인한다 (줄바꿈 전문 표시 + 새 메시지 도착 시 하단 자동 추적). */
const CHAT_RETAIN = 50;

export function ChatBox() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  /* v1.4.29 (#채팅기록50) — 채팅 기록 뷰(최근 50개 스크롤) 열림 상태 */
  const [logOpen, setLogOpen] = useState(false);
  const logListRef = useRef<HTMLDivElement>(null);
  /* v4.1.0 — 채팅창 접기 (유저 지시 #11): 메시지 목록을 숨기고 상태를 저장한다 */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /* v1.2.0 (#5) — 화면에 실제로 렌더할 메시지 수: 목록 높이가 CHAT_MAX_H를 넘으면 줄이고,
   *  새 메시지가 와서 여유가 생기면 다시 늘린다 (위쪽 = 오래된 것부터 잘림) */
  const [visible, setVisible] = useState(CHAT_MAX_VISIBLE);
  const listRef = useRef<HTMLDivElement>(null);

  /* #5 — 렌더 후 실측 → 초과 시 위부터 축소 (상태→렌더→실측 수렴 루프, 1프레임당 1개씩) */
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || collapsed) return;
    if (el.clientHeight > CHAT_MAX_H) {
      setVisible((v) => Math.max(CHAT_MIN_VISIBLE, v - 1));
    }
  }, [msgs, visible, collapsed]);

  /* #5 — 새 메시지 도착 시 여유(28px)가 있으면 다시 확장 (오래된 메시지 복귀) */
  useEffect(() => {
    if (collapsed) return;
    setVisible((v) => {
      if (v >= CHAT_MAX_VISIBLE) return v;
      const el = listRef.current;
      if (!el) return v;
      return el.clientHeight <= CHAT_MAX_H - 28 ? Math.min(CHAT_MAX_VISIBLE, v + 1) : v;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* 저장 불가 환경 무시 */
    }
  }, [collapsed]);

  useEffect(() => {
    // 서버는 접속 시 히스토리(배열), 이후 새 메시지(단건)를 보낸다 — 둘 다 처리
    const onMsg = (m: Msg | Msg[]) => {
      const list = Array.isArray(m) ? m : [m];
      setMsgs((cur) => [...cur, ...list].slice(-CHAT_RETAIN));
    };
    EventBus.on("chat:msg", onMsg);
    return () => {
      EventBus.off("chat:msg", onMsg);
    };
  }, []);

  /* v1.4.29 (#채팅기록50) — 기록 뷰가 열려 있고 유저가 하단 근처를 보고 있으면
   *  새 메시지 도착 시 맨 아래로 자동 추적 (위쪽 기록을 읽는 중이면 시선 보존) */
  useEffect(() => {
    if (!logOpen) return;
    const el = logListRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [msgs, logOpen]);

  /* v1.4.29 — 기록 뷰를 방금 열었을 때 맨 아래(최신)부터 보여주기 */
  useEffect(() => {
    if (!logOpen) return;
    const t = setTimeout(() => {
      const el = logListRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
    return () => clearTimeout(t);
  }, [logOpen]);

  // 포커스 상태를 씬에 알림 (게임 키 차단)
  useEffect(() => {
    EventBus.emit("chat:focus", { focus: open });
    if (open) {
      /* v3.0.28 (#채팅스크롤) — focus의 자동 스크롤 차단: 모바일 가상 키보드가 열릴 때
       *  브라우저가 입력창을 화면 중앙으로 맞추려고 페이지를 밀어올려 채팅창·게임 화면이
       *  위로 계속 밀리는(무한 올라감) 현상 차단 */
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [open]);

  // 입력창 밖 Enter로 열기 (다른 input에 타이핑 중일 땐 무시 — 인트로 이름 짓기 등)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "Enter" && !open && !typing) {
        setText("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // v2.3 — 바깥 포인터다운 시 닫기 (blur 대체: 모바일 키보드 blur 무시)
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  /* v3.0.28 (#채팅스크롤) — 닫힐 때 viewport 위치 복귀: 가상 키보드가 밀어올린
   *  window 스크롤을 즉시 원위치해 채팅창이 화면 위쪽에 붙어 남는 현상 제거 */
  const closeChat = () => {
    setOpen(false);
    inputRef.current?.blur();
    window.scrollTo(0, 0);
  };

  const send = () => {
    const t = text.trim().slice(0, 80);
    if (t) {
      if (netChatReady()) {
        EventBus.emit("chat:send", { text: t });
      } else {
        // v2.3 — 미연결 피드백: 보낸 말이 조용히 증발하지 않게 로컬 안내
        setMsgs((cur) =>
          [...cur, { id: "local", name: "", text: "서버 미연결 — 멀티 서버 접속 시 채팅을 사용할 수 있어요", sys: true, t: Date.now() }].slice(-CHAT_RETAIN),
        );
      }
    }
    setText("");
    closeChat();
  };

  return (
    <div ref={rootRef} className="absolute bottom-2 left-2 w-[300px] max-w-[42vw] sm:bottom-3 sm:left-3">
      {/* 최근 메시지 (아래가 최신 — v1.2.0 (#5): 높이 초과 시 위부터 자동 잘라냄) — v4.1.0: 접기 상태면 숨김 */}
      {!collapsed && (
        <div ref={listRef} className="pointer-events-none mb-1 flex flex-col gap-0.5">
          {msgs.slice(-visible).map((m) => (
          <p
            key={`${m.t}-${m.id}`}
            className={`w-fit max-w-full truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] leading-snug backdrop-blur-[2px] sm:text-[11px] ${
              m.sys ? "font-bold text-sky-300/90" : m.party ? "font-bold text-emerald-300/90" : "text-white/85"
            }`}
          >
            {m.sys ? m.text : <>{m.party && <span className="mr-1 rounded bg-emerald-400/25 px-1 text-[9px] text-emerald-100">[파티]</span>}<span className="font-black text-amber-200">{m.name}</span>: {m.text}</>}
          </p>
          ))}
        </div>
      )}

      {/* v1.4.28 (#채팅가림) — relative z-40: NPC 대화창(DialogueBox absolute inset-x-0 bottom-0 z-30,
       *  DOM 순서도 ChatBox보다 뒤)이 열리면 입력행+전송 버튼이 대화창 뒤로 가려지고 대화의
       *  "터치로 계속" 핸들러가 탭을 잡아먹던 문제 수정. z-40 = 대화창(30) 위 · 모달(45+) 아래 */}
      <div className="relative z-40 flex items-end gap-1">
        {open ? (
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1.5">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
                else if (e.key === "Escape") closeChat();
                e.stopPropagation();
              }}
              onKeyUp={(e) => e.stopPropagation()}
              enterKeyHint="send"
              placeholder="메시지 입력… (Enter 전송 · ESC 취소)"
              maxLength={80}
              aria-label="전체 채팅 입력"
              className="min-w-0 flex-1 rounded-md border border-white/25 bg-black/75 px-2 py-1.5 text-xs font-bold text-white shadow-lg outline-none backdrop-blur-sm placeholder:text-white/35 focus:border-amber-300/60"
            />
            {/* v2.3 전송 버튼 — 모바일 가상 키보드에서 Enter 대신 누를 수 있게 */}
            <button
              onClick={send}
              aria-label="채팅 전송"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-300/50 bg-amber-500/30 text-amber-100 backdrop-blur-sm transition-colors hover:bg-amber-500/50 active:scale-95"
            >
              <SendHorizontal size={14} />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                setText("");
                setOpen(true);
              }}
              aria-label="채팅 열기 (Enter)"
              className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-white/15 bg-black/55 px-2 py-1 text-[10px] font-black text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
            >
              <MessageCircle size={12} />
              채팅 <span className="rounded bg-white/10 px-1 text-[9px] font-black text-white/50">Enter</span>
            </button>
            {/* v4.1.0 — 채팅창 접기/펼치기 (지시 #11) */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "채팅 메시지 펼치기" : "채팅 메시지 접기"}
              title={collapsed ? "메시지 펼치기" : "메시지 접기"}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/55 text-[10px] font-black text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
            >
              {collapsed ? "▸" : "▾"}
            </button>
            {/* v1.4.29 (#채팅기록50) — 채팅 기록 뷰: 최근 50개를 스크롤하며 확인.
             *  부유 목록은 조이스틱 겹침 때문에 터치 이벤트를 게임에 양보하는 대신,
             *  전용 기록 뷰에서 전문(전체 문장) 스크롤 열람을 제공한다. */}
            <button
              onClick={() => setLogOpen(true)}
              aria-label="채팅 기록 열기 (최근 50개)"
              title="채팅 기록 — 최근 50개 스크롤"
              className="pointer-events-auto flex h-7 items-center gap-1 rounded-md border border-white/15 bg-black/55 px-1.5 text-[10px] font-black text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"
            >
              <History size={12} />
              기록
            </button>
          </>
        )}
      </div>

      {/* v1.4.29 (#채팅기록50) — 채팅 기록 뷰 (최근 50개 · 스크롤 · 전문 표시).
       *  PartyWidget과 동일한 중앙 모달 패턴(z-[45]) — 좁은 화면에서도 읽기 좋게. */}
      {logOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-[45] flex items-center justify-center bg-black/60 px-3 py-3"
          onPointerDown={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}
        >
          <div className="game-panel flex max-h-[calc(100dvh-24px)] w-full max-w-[380px] flex-col p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1 text-[12px] font-black text-sky-200">
                <History size={13} /> 채팅 기록
                <span className="rounded bg-sky-400/25 px-1 text-[9px] text-sky-100">최근 {msgs.length}개 (최대 {CHAT_RETAIN})</span>
              </p>
              <button
                onClick={() => setLogOpen(false)}
                aria-label="채팅 기록 닫기"
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/70 hover:bg-black/70"
              >
                <X size={13} />
              </button>
            </div>
            <div ref={logListRef} className="sertz-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
              {msgs.length === 0 && (
                <p className="py-6 text-center text-[11px] font-bold text-white/35">
                  아직 채팅 기록이 없어요 — 채팅을 보내면 여기에 쌓입니다
                </p>
              )}
              <div className="flex flex-col gap-1">
                {msgs.map((m) => (
                  <div
                    key={`${m.t}-${m.id}`}
                    className={`w-fit max-w-full rounded-md px-1.5 py-1 text-[11px] leading-relaxed ${
                      m.sys ? "bg-sky-500/10 font-bold text-sky-300/90" : m.party ? "bg-emerald-500/10 text-emerald-100" : "bg-white/[0.06] text-white/85"
                    }`}
                  >
                    {m.sys ? (
                      m.text
                    ) : (
                      <>
                        {m.party && <span className="mr-1 rounded bg-emerald-400/25 px-1 text-[9px] font-bold text-emerald-100">[파티]</span>}
                        <span className="font-black text-amber-200">{m.name}</span>: {m.text}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-center text-[9px] font-bold text-white/30">위로 스크롤해 이전 기록 확인 · 최대 {CHAT_RETAIN}개까지 보관</p>
          </div>
        </div>
      )}
    </div>
  );
}
