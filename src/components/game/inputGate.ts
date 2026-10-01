"use client";

import { useCallback, useEffect, useRef } from "react";
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
 *
 * v4.9.0 — 버그 근본 수정:
 *  ①기존엔 useEffect가 첫 렌더(ref.current=null — 패널 닫힘)에 1회만 실행되어
 *    NamePanel처럼 "나중에" 마운트되는 인풋엔 focus/blur 리스너가 아예 안 붙었다.
 *    → 콜백 ref로 전환: 인풋이 실제로 DOM에 붙는 순간마다 게이트를 장착한다.
 *  ②autoFocus는 focus 이벤트가 부착보다 먼저 발생할 수 있어, 부착 시점에 이미
 *    포커스된 상태면 즉시 게이트를 가동한다.
 *  (이 게이트가 켜지면 WorldScene이 Phaser 키보드 관리자를 꺼 + 입력 상태를
 *   리셋한다 — 소문자 유실·keyup 고착 자동이동의 근본 차단)
 */

const gateOn = () => EventBus.emit("chat:focus", { focus: true });
const gateOff = () => EventBus.emit("chat:focus", { focus: false });

/** 포커스 게이트 — 콜백 ref를 input에 붙이면 끝 */
export function useKeyGate() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const gate = useCallback((el: HTMLInputElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;
    el.addEventListener("focus", gateOn);
    el.addEventListener("blur", gateOff);
    /* autoFocus 대응 — 부착 시점에 이미 포커스돼 있으면 즉시 가동 */
    if (document.activeElement === el) gateOn();
    cleanupRef.current = () => {
      el.removeEventListener("focus", gateOn);
      el.removeEventListener("blur", gateOff);
      gateOff();
    };
  }, []);

  /* 언마운트 안전망 (콜백 ref가 호출되지 않고 컴포넌트가 사라지는 경우 대비) */
  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    []
  );

  return gate;
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
