/**
 * SkillButton — 아이콘 아래에 스킬명을 두는 레이아웃 (vc206)
 *
 * 유저 요청: "이 형태를 원함 (아이콘 밑에 글자)" + 스크린샷 지적
 *   "버튼안에 있는 스킬 아이콘 너무 큰 버그"
 *
 * 종전 구조의 문제 (실측 스크린샷)
 *   ① 아이콘이 원 안을 가득 채워 → 스킬명이 아이콘 위에 겹쳐 읽기 어렵다
 *   ② 스킬명을 원 **안**에 넣어 `break-keep` 으로 줄바꿈 → 이름이 길면 잘리거나 3줄이 되어
 *      MP 표기와 함께 원 밖으로 넘친다(스크린샷에서 "…의 화살비 - …" 처럼 잘림)
 *   ③ 8px 폰트를 원 안에 밀어넣어 저시인성
 *
 * 새 구조
 *   [원형 버튼]  = 아이콘 + 쿨다운 + 키탭 + (작은) MP 배지만
 *   [아래 라벨]  = 스킬명 (버튼 **밖**, 밑에 배치)
 *   이렇게 하면 이름 길이와 무관하게 잘리지 않고, 아이콘도 원 안에서 여백을 갖는다.
 */
"use client";
import { useEffect, useState } from "react";

type SkillButtonProps = {
  ready: boolean;
  cdPct: number;
  cdMax?: number;
  label: string;
  mp?: number;
  icon?: string;
  onDown: () => void;
  children?: React.ReactNode;
  ult?: boolean;
  ult2?: boolean;
  compact?: boolean;
  keyHint?: string;
  tutGlow?: boolean;
  auto?: boolean;
};

export function SkillButton({
  ready,
  cdPct,
  cdMax,
  label,
  mp,
  icon,
  onDown,
  children,
  ult,
  ult2,
  compact,
  keyHint,
  tutGlow,
  auto,
}: SkillButtonProps) {
  /* 아이콘 로드 실패 시 이전 아이콘 유지 (깜빡임 방지)
   * vc206 — 종전엔 effect 안에서 setPrevIcon/setIconErr 를 동기 호출해
   *  cascading render 린트 오류가 났다. 아이콘이 바뀌면 "이전 아이콘 기억 +
   *  에러 해제"를 **렌더 중 상태 조정**으로 처리한다(React 권장 패턴 — 이전 값과
   *  다를 때만 set 하므로 무한 루프가 없다). */
  const [iconErr, setIconErr] = useState(false);
  const [prevIcon, setPrevIcon] = useState<string | undefined>(icon);
  const [lastIcon, setLastIcon] = useState<string | undefined>(icon);
  if (icon !== lastIcon) {
    setLastIcon(icon);
    if (icon) setPrevIcon(icon);
    if (iconErr) setIconErr(false);
  }
  const src = iconErr ? prevIcon : icon;
  const showIcon = !!src && !iconErr;

  const ring = ready
    ? ult
      ? "border-amber-100/90 bg-gradient-to-b from-amber-300 via-amber-500 to-orange-700 shadow-[0_0_14px_rgba(255,190,60,0.65)]"
      : ult2
        ? "border-fuchsia-100/90 bg-gradient-to-b from-fuchsia-400 via-purple-600 to-indigo-900 shadow-[0_0_16px_rgba(200,120,255,0.7)]"
        : "border-[#e8c064]/80 bg-gradient-to-b from-[#2c3f6e] to-[#101827] shadow-[inset_0_1px_0_rgba(232,192,100,0.35),0_3px_0_rgba(0,0,0,0.45)]"
    : "border-white/20 bg-slate-700/70 opacity-60";

  return (
    /* 바깥 래퍼가 세로 배치를 담당 — 원(버튼) + 그 아래 라벨 */
    <div className="pointer-events-none flex flex-col items-center gap-[3px]">
      <button
        aria-label={label}
        disabled={!ready}
        className={`pointer-events-auto relative flex touch-none select-none items-center justify-center overflow-hidden rounded-full border-2 text-white shadow-lg transition-transform active:scale-90 ${ring} ${
          tutGlow ? "ring-4 ring-amber-300/90 animate-pulse" : ""
        }`}
        style={{ width: "100%", height: "100%" }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (ready) onDown();
        }}
      >
        {/* 아이콘 — 원 안에서 여백을 두고(contain) 가운데 정렬.
         *  종전엔 object-cover 로 꽉 채워 이름과 겹쳤다. 이제 이름은 버튼 밖에 있다.
         *  vc206 (지시 #12 "버튼안에 있는 스킬 아이콘 너무 큰 버그") — 스크린샷 실측:
         *   아이콘이 원 지름의 90~100% 를 채워 스킬명이 원 밖으로 밀려나 잘렸다.
         *   p-[11%] (아이콘 78%) 는 여전히 커서, 원 지름의 **64%** 가 되도록 18% 여백을 준다. */}
        {showIcon ? (
          <img
            src={src}
            alt=""
            onError={() => setIconErr(true)}
            className="tap-safe pointer-events-none absolute inset-0 h-full w-full rounded-full object-contain p-[18%] opacity-95"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90">{children}</span>
        )}

        {/* 단축키 탭 (좌상단) */}
        {keyHint && (
          <span className="pointer-events-none absolute left-0.5 top-0.5 z-20 rounded bg-slate-950/90 px-1 text-[8px] font-black leading-[12px] text-amber-200 ring-1 ring-amber-300/40">
            {keyHint}
          </span>
        )}

        {/* 쿨다운 오버레이 + 남은 초 (원 안 중앙) */}
        {cdPct > 0 && (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-black/60"
              style={{ clipPath: `inset(${100 - cdPct}% 0 0 0)` }}
            />
            <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[11px] font-black text-white [text-shadow:0_1px_3px_#000]">
              {Math.ceil(((cdMax ?? 0) * cdPct) / 100 / 1000) || ""}
            </span>
          </>
        )}

        {/* MP — 원 안 아래쪽 작은 배지 (이름은 밖으로 나갔으므로 공간 여유) */}
        {typeof mp === "number" && mp > 0 && (
          <span className="pointer-events-none absolute bottom-[3px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/65 px-1 text-[7px] font-bold leading-[10px] text-[#bcd0ff]">
            {mp}MP
          </span>
        )}

        {/* 자동 토글 표시 */}
        {auto && (
          <span className="pointer-events-none absolute right-0.5 top-0.5 z-20 rounded bg-emerald-600/90 px-1 text-[7px] font-black leading-[11px] text-white">
            자동
          </span>
        )}
      </button>

      {/* vc206 — 스킬명은 **버튼 밖 아래**에 둔다. 길어도 잘리지 않게 2줄 허용 +
       *  원 지름보다 넓게 잡아 가독성을 확보한다.
       *  vc206 (지시 #12) — max-w-[76px] 는 원(66px)보다 10px 넓은 정도라 긴 이름이
       *  여전히 1~2글자씩 세로로 쌓였다. 래퍼 폭까지 허용(max-w-none)하고
       *  좌우로 넘칠 때만 말줄임하지 않고 2줄로 감싼다. */}
      {!compact && (
        <span
          className={`pointer-events-none w-[calc(100%+22px)] break-keep text-center text-[9px] font-bold leading-[1.15] [text-shadow:0_1px_2px_#000,0_0_3px_#000] ${
            ult ? "text-amber-100" : ult2 ? "text-fuchsia-100" : "text-white"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
