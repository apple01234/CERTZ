import type { Metadata } from "next";

export const metadata: Metadata = { title: "SERTZ 제작 도구", description: "게임을 실행하지 않고 맵과 스킬을 편집합니다." };

export default function ToolsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-12 text-white">
      <a href="/" className="text-sm text-amber-200">← SERTZ 게임</a>
      <div><h1 className="text-3xl font-bold">제작 도구</h1><p className="mt-3 text-white/65">게임을 실행하지 않고 각 도구를 별도 페이지에서 사용할 수 있습니다.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <a href="/editor" className="rounded-xl border border-white/20 bg-white/5 p-6 hover:border-amber-200 focus-visible:outline-2 focus-visible:outline-amber-200">
          <h2 className="text-xl font-bold text-amber-200">맵 메이커</h2><p className="mt-3 text-sm text-white/65">지형·길·장식물·입출구를 배치하고 맵을 저장합니다.</p>
        </a>
        <a href="/skill-editor" className="rounded-xl border border-white/20 bg-white/5 p-6 hover:border-sky-200 focus-visible:outline-2 focus-visible:outline-sky-200">
          <h2 className="text-xl font-bold text-sky-200">스킬 에디터</h2><p className="mt-3 text-sm text-white/65">스킬 판정·피해·쿨다운을 편집하고 미리 봅니다.</p>
        </a>
      </div>
    </main>
  );
}
