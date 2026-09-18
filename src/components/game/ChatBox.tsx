"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { MessageCircle, SendHorizontal } from "lucide-react";
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

export function ChatBox() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
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
      setMsgs((cur) => [...cur, ...list].slice(-41));
    };
    EventBus.on("chat:msg", onMsg);
    return () => {
      EventBus.off("chat:msg", onMsg);
    };
  }, []);

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
          [...cur, { id: "local", name: "", text: "서버 미연결 — 멀티 서버 접속 시 채팅을 사용할 수 있어요", sys: true, t: Date.now() }].slice(-41),
        );
      }
    }
    setText("");
    closeChat();
  };

  return (
    <div ref={rootRef} className="absolute bottom-2 left-2 w-[300px] max-w-[52vw] sm:bottom-3 sm:left-3">
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

      <div className="flex items-end gap-1">
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
          </>
        )}
      </div>
    </div>
  );
}
