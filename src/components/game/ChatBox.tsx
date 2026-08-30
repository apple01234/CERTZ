"use client";

import { useEffect, useRef, useState } from "react";
import { EventBus } from "./EventBus";
import { MessageCircle } from "lucide-react";

/**
 * 멀티플레이 전체 채팅 (v1.7)
 *  - Enter: 입력 열기/전송 · ESC: 취소
 *  - 입력 포커스 동안 게임 키 완전 차단 (EventBus "chat:focus" → WorldScene)
 */
type Msg = { id: string; name: string; text: string; sys?: boolean; party?: boolean; t: number };

export function ChatBox() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
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

  const send = () => {
    const t = text.trim().slice(0, 80);
    if (t) EventBus.emit("chat:send", { text: t });
    setOpen(false);
  };

  return (
    <div className="absolute bottom-2 left-2 w-[300px] max-w-[52vw] sm:bottom-3 sm:left-3">
      {/* 최근 메시지 (아래가 최신 — 최대 7개, 살짝 투명) */}
      <div className="pointer-events-none mb-1 flex flex-col gap-0.5">
        {msgs.slice(-7).map((m) => (
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

      {open ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
            else if (e.key === "Escape") setOpen(false);
            e.stopPropagation();
          }}
          onBlur={() => setOpen(false)}
          placeholder="메시지 입력… (Enter 전송 · ESC 취소)"
          maxLength={80}
          aria-label="전체 채팅 입력"
          className="pointer-events-auto w-full rounded-md border border-white/25 bg-black/75 px-2 py-1.5 text-xs font-bold text-white shadow-lg outline-none backdrop-blur-sm placeholder:text-white/35 focus:border-amber-300/60"
        />
      ) : (
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
      )}
    </div>
  );
}
