"use client";
import dynamic from "next/dynamic";

const CampaignRoot = dynamic(
  () => import("@/components/campaign/CampaignRoot"),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#171d2d] text-[#dfc38b]"
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M1 3h6v1h2V3h6v10H9v1H7v-1H1V3zm1 1v8h5V5H2zm7 1v7h5V4H9v1zM3 6h3v1H3V6zm7 0h3v1h-3V6zM3 9h3v1H3V9zm7 0h3v1h-3V9z"
          />
        </svg>
        <strong className="text-2xl tracking-widest">기억의 서약</strong>
        <span className="text-xs text-[#b5b5c8]">함께한 기억을 펼치는 중…</span>
      </div>
    ),
  },
);
export default function Home() {
  return <CampaignRoot />;
}
