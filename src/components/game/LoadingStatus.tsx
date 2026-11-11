"use client";
import { useEffect, useState } from "react";
import { getLoadingProgress, retryLoading, type LoadProgress } from "@/game/stagedAssets";

export function LoadingStatus() {
  const [progress, setProgress] = useState<LoadProgress | null>(() => getLoadingProgress() ?? null);
  useEffect(() => {
    const onLoading = (event: Event) => setProgress({ ...(event as CustomEvent<LoadProgress>).detail });
    window.addEventListener("sertz:loading", onLoading);
    return () => window.removeEventListener("sertz:loading", onLoading);
  }, []);
  if (!progress || (!progress.error && ["title-ready", "world-ready"].includes(progress.phase))) return null;
  return <div role="status" aria-live="polite" data-loading-phase={progress.phase} className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 text-center text-amber-100">
    <strong className="text-lg">{progress.error ? "불러오기를 완료하지 못했어요" : progress.phase === "title-assets" ? "시작 화면을 준비하고 있어요" : "게임 전체를 불러오고 있어요"}</strong>
    <p className="text-sm">{progress.error ?? `${progress.complete} / ${progress.total} · ${Math.floor(progress.elapsedMs / 1000)}초`}</p>
    {!progress.error && <progress aria-label="게임 로딩" max={Math.max(1, progress.total)} value={progress.complete} className="h-3 w-64 accent-amber-300" />}
    {!progress.error && <p className="max-w-sm text-xs leading-relaxed text-slate-300">캐릭터·지역·전투 효과를 모두 준비한 뒤 시작합니다. 처음에는 시간이 걸릴 수 있어요.</p>}
    {progress.error && progress.failed.length > 0 && <p className="max-w-sm break-all text-xs text-slate-300">불러오지 못한 자료: {progress.failed.slice(0, 3).join(", ")}{progress.failed.length > 3 ? ` 외 ${progress.failed.length - 3}개` : ""}</p>}
    {progress.error && <button className="game-btn px-5 py-3" onClick={retryLoading}>다시 시도</button>}
  </div>;
}
