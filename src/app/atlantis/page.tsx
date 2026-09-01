"use client";

import dynamic from "next/dynamic";

// Phaser는 브라우저 전용 — SSR 비활성화
const AtlantisRoot = dynamic(() => import("@/components/atlantis/AtlantisRoot"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#05070d]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/30 border-t-cyan-300" />
        <p className="text-sm font-bold tracking-widest text-cyan-200/80">아뜰란티스 로딩 중…</p>
      </div>
    </div>
  ),
});

export default function AtlantisPage() {
  return <AtlantisRoot />;
}
