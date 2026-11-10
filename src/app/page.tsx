"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

function ShellLoading() {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), 30000);
    return () => window.clearTimeout(timer);
  }, []);
  return <div role="status" className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#171d2d] px-6 text-center text-[#dfc38b]">
    <strong className="text-xl">하루는 웨폰마스터가 되었다.</strong>
    <span>{expired ? "게임을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요." : "모험을 준비하고 있어요…"}</span>
    {expired && <button className="game-btn px-5 py-3" onClick={() => window.location.reload()}>다시 시도</button>}
  </div>;
}

const GameRoot = dynamic(
  () => import("@/components/game/GameRoot"),
  {
    ssr: false,
    loading: ShellLoading,
  },
);
export default function Home() {
  return <GameRoot />;
}
