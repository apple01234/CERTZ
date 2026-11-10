"use client";
import { useEffect, useState } from "react";
import type { LoadProgress } from "@/game/stagedAssets";

export function LoadingStatus() {
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  useEffect(() => {
    const onLoading = (event: Event) => setProgress({ ...(event as CustomEvent<LoadProgress>).detail });
    window.addEventListener("sertz:loading", onLoading);
    return () => window.removeEventListener("sertz:loading", onLoading);
  }, []);
  if (!progress || (!progress.error && ["title-ready", "world-ready"].includes(progress.phase))) return null;
  return <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 text-center text-amber-100">
    <strong className="text-lg">{progress.error ? "불러오기를 완료하지 못했어요" : "모험을 준비하고 있어요"}</strong>
    <p className="text-sm">{progress.error ?? `${progress.complete} / ${progress.total}`}</p>
    {!progress.error && <progress aria-label="게임 로딩" max={Math.max(1, progress.total)} value={progress.complete} className="h-3 w-64 accent-amber-300" />}
    {progress.error && <button className="game-btn px-5 py-3" onClick={() => window.location.reload()}>다시 시도</button>}
  </div>;
}
