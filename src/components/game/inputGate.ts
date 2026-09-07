"use client";

import { useEffect, useRef } from "react";
import { EventBus } from "./EventBus";

/**
 * v4.1.0 — 게임 내 모든 텍스트 입력 공용 키 게이트 (유저 지시 #5)
 *  - 포커스 중: Phaser 게임 키 완전 차단 (chat:focus 게이트 재사용)
 *  - 입력 키가 window까지 올라가 다른 창/단축키를 발동하지 않게 전파 차단
 *  - 언마운트 시 게이트 확실히 해제 (패널이 닫혀도 키가 죽지 않게)
 *
 * 사용법:
 *   const gate = useKeyGate();
 *   <input ref={gate} {...swallowKeys} ... />
 */

/** 포커스 게이트 — ref를 input에 붙이면 끝 */
export function useKeyGate() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => EventBus.emit("chat:focus", { focus: true });
    const off = () => EventBus.emit("chat:focus", { focus: false });
    el.addEventListener("focus", on);
    el.addEventListener("blur", off);
    return () => {
      el.removeEventListener("focus", on);
      el.removeEventListener("blur", off);
      off(); // 패널 닫힘/언마운트 누수 방지
    };
  }, []);
  return ref;
}

/** 키 전파 차단 — Phaser(윈도우 리스너)와 다른 UI 단축키 모두 무력화 */
export const swallowKeys = {
  onKeyDown: (e: React.KeyboardEvent) => {
    e.stopPropagation();
  },
  onKeyUp: (e: React.KeyboardEvent) => {
    e.stopPropagation();
  },
};
