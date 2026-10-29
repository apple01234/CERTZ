"use client";

import dynamic from "next/dynamic";

/* v1.0.19 (#로딩화면) — 종전엔 Tailwind 기본 스피너 + "SERTZ 로딩 중…" 한 줄이었다.
 *  이 화면은 유저가 게임을 켤 때 가장 먼저 보는 화면인데, 게임의 픽셀·금장 톤과
 *  무관한 범용 스피너라 "웹앱 로딩"처럼 보였다. 세계수 문양 + 금장 진행 바로 교체해
 *  첫 프레임부터 게임의 팔레트(#05070d / #e8c064 / #ffd98a)를 유지한다.
 *  이미지 자산을 쓰지 않는 순수 CSS/SVG라 추가 로딩 비용은 0이다. */
const GameRoot = dynamic(() => import("@/components/game/GameRoot"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#05070d]">
      {/* 중앙 광원 + 세계수 문양 */}
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#e8c064]/10 blur-xl" />
        <svg viewBox="0 0 48 48" className="relative h-16 w-16" aria-hidden>
          <g fill="none" stroke="#e8c064" strokeWidth="1.6" strokeLinecap="round">
            {/* 줄기 */}
            <path d="M24 40V20" />
            {/* 뿌리 */}
            <path d="M24 40l-7 4M24 40l7 4M24 40v5" opacity="0.7" />
            {/* 가지 */}
            <path d="M24 28c-6 0-9-4-10-9M24 28c6 0 9-4 10-9" />
            <path d="M24 22c-4-1-6-4-7-7M24 22c4-1 6-4 7-7" opacity="0.8" />
            {/* 잎(왕관) */}
            <path d="M14 19c-2-3 0-6 3-6M34 19c2-3 0-6-3-6" opacity="0.6" />
          </g>
          <circle cx="24" cy="13" r="1.8" fill="#ffd98a" />
        </svg>
      </div>

      <p className="mb-1 text-2xl font-black tracking-[0.3em] text-[#ffe49a] [text-shadow:0_2px_0_#6b4a1c,0_5px_14px_rgba(0,0,0,0.9)]">
        SERTZ
      </p>
      <p className="mb-5 text-[10px] font-bold tracking-[0.22em] text-[#cbb88a]/80">인피니트보석 : 다섯 왕국</p>

      {/* 금장 진행 바 — 폭을 알 수 없는 최초 로딩이라 무한 왕복으로 표시 */}
      <div className="h-1 w-44 overflow-hidden rounded-full border border-[#8a6a34]/60 bg-black/60">
        <div className="sertz-leadbar h-full w-1/3 rounded-full bg-gradient-to-r from-[#8a6a34] via-[#ffd98a] to-[#8a6a34]" />
      </div>

      <style>{`
        @keyframes sertzLeadbar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sertz-leadbar { animation: none; width: 100%; }
        }
        .sertz-leadbar { animation: sertzLeadbar 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  ),
});

export default function Home() {
  return <GameRoot />;
}
