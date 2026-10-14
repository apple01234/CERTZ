"use client";

import { useEffect, useState } from "react";

/**
 * vc150 (#신규3) — 터치 기기 판정 훅 (공용)
 *  - "모바일에서는 항상 단축키 UI 없애 (PC에만 적용)" 지시의 공용 판정선.
 *  - pointer:coarse(터치 주 입력) 또는 좁은 화면(<900px) → 터치 기기로 간주.
 *  - 첫 터치 이벤트가 오면 무조건 터치로 확정(하이브리드 기기 배려) — TouchControls의
 *    기존 판정 로직과 동일 규칙을 HUD/패널에서도 쓰게 추출했다.
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900)
  );
  useEffect(() => {
    const reevaluate = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsTouch(coarse || window.innerWidth < 900);
    };
    reevaluate();
    const onTouch = () => setIsTouch(true); // 첫 터치가 오면 터치 기기 확정
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    window.addEventListener("resize", reevaluate);
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("resize", reevaluate);
    };
  }, []);
  return isTouch;
}
