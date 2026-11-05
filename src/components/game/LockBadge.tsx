"use client";

/**
 * vc247 (지시 #11) — 레벨 잠금 공용 표시.
 *
 * [참고 UI] 첨부된 컨텐츠/인벤토리 참고자료의 패턴을 그대로 따랐다:
 *  · 카드/버튼 **외형은 유지**한다(회색 박스로 바꾸지 않는다) — "차단"이 아니라 "예고된 해금"
 *  · 아이콘은 **딤 처리**(grayscale + 낮은 불투명도)하되 윤곽은 남긴다
 *  · 중앙(또는 모서리)에 **자물쇠**를 얹는다
 *  · 조건 문구는 부정형이 아니라 긍정형: "Lv.N에 열립니다"(참고 UI의 "Lv.30에 오픈됩니다.")
 *  · 레벨 숫자만 노란색으로 강조해 목표가 한눈에 보이게 한다
 *
 * [왜 공용 컴포넌트인가] HUD 아이콘·패널 카드·상점 진열이 각자 잠금 표시를 만들면
 *  색/크기/문구가 갈라진다. 잠금 규칙은 `unlocks.ts` 한 곳에서 오고, 표시는 여기 한 곳에서만 만든다.
 */

import { GameIcon, type IconName } from "./GameIcon";

/** 잠금 사유 문구 — 참고 UI처럼 레벨 숫자만 강조한다. */
export function LockReason({ lv, compact = false }: { lv: number; compact?: boolean }) {
  if (compact) {
    return (
      <span className="font-black text-amber-300 drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">
        Lv.{lv}
      </span>
    );
  }
  return (
    <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">
      <span className="font-black text-amber-300">Lv.{lv}</span>
      <span className="text-white/80">에 열립니다</span>
    </span>
  );
}

/**
 * 아이콘 위에 얹는 잠금 배지.
 *  - 중앙형(카드/큰 버튼): 자물쇠 + 조건 문구를 세로로 묶는다
 *  - 모서리형(HUD 36px 아이콘): 아이콘 우하단에 작은 자물쇠만 (참고 인벤토리 UI와 동일)
 */
export function LockBadge({
  lv,
  variant = "corner",
  size = 18,
}: {
  lv: number;
  /** corner = 작은 모서리 자물쇠 / center = 카드 중앙 오버레이 */
  variant?: "corner" | "center";
  /** 자물쇠 아이콘 크기(px) */
  size?: number;
}) {
  if (variant === "center") {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-[inherit] bg-black/45">
        <GameIcon name="lock" size={size} className="opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
        <span className="px-1 text-center text-[10px] leading-none font-black">
          <LockReason lv={lv} />
        </span>
      </div>
    );
  }
  return (
    <span
      className="pointer-events-none absolute -bottom-0.5 -right-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/90 ring-1 ring-amber-300/60"
      aria-hidden="true"
    >
      <GameIcon name="lock" size={10} className="opacity-95" />
    </span>
  );
}

/**
 * 잠금 상태의 아이콘 — 딤 처리만 담당(참고 UI: 완전 무채색이 아니라 반투명 검정 오버레이 느낌).
 *  `dim` 은 GameIcon 이 이미 grayscale + opacity-35 로 처리한다.
 */
export function LockedIcon({
  name,
  size,
  locked,
}: {
  name: IconName;
  size: number;
  locked: boolean;
}) {
  return <GameIcon name={name} size={size} dim={locked} />;
}

/** 잠금 여부에 따른 버튼 클래스 — 잠겨도 누를 수는 있어야 안내가 뜬다(참고 UI와 동일). */
export function lockableClass(locked: boolean, base: string): string {
  return `${base} ${locked ? "opacity-80" : ""}`;
}
