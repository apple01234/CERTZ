#!/usr/bin/env python3
# v1.0.20 — HUD.tsx 게임형 칩 교체 (문자열 단위 치환 — 매칭 실패 시 보고)
P = "/home/z/my-project/src/components/game/HUD.tsx"
src = open(P, encoding="utf-8").read()
n = 0

def rep(a, b):
    global src, n
    if a in src:
        src = src.replace(a, b)
        n += 1
    else:
        print(f"MISS: {a[:80]!r}")

# 1) 자동사냥 버튼 (비활성 상태 → game-chip)
rep(
    'className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors active:scale-95 ${\n                autoHunt\n                  ? "animate-pulse border-lime-300/80 bg-gradient-to-b from-lime-600/90 to-emerald-800/90 text-lime-100"\n                  : "border-white/20 bg-black/55 text-white/80 hover:bg-black/75"\n              }`}',
    'className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${\n                autoHunt\n                  ? "animate-pulse rounded-lg border-2 border-lime-300/80 bg-gradient-to-b from-lime-600/90 to-emerald-800/90 text-lime-100"\n                  : "game-chip text-white/80"\n              }`}',
)
# 2) 음소거
rep(
    'className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto flex h-9 w-9 items-center justify-center text-white/90 active:scale-95"',
)
# 3) 가방
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200/40 bg-black/55 text-sky-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#a8e0ff] active:scale-95"',
)
# 4) 전직
rep(
    'className={`pointer-events-auto relative flex h-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-transform active:scale-95 ${\n                canJob\n                  ? "animate-pulse border-amber-300/70 bg-gradient-to-b from-amber-500/80 to-amber-700/80 text-amber-100 hover:from-amber-400/90"\n                  : "border-white/20 bg-black/55 text-white/70 hover:bg-black/75"\n              }`}',
    'className={`pointer-events-auto relative flex h-9 items-center justify-center transition-transform active:scale-95 ${\n                canJob\n                  ? "game-btn w-9"\n                  : "game-chip w-9 text-white/70"\n              }`}',
)
# 5) 스탯
rep(
    'className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors active:scale-95 ${\n              hud.ap > 0\n                ? "animate-pulse border-lime-300/70 bg-gradient-to-b from-lime-500/80 to-emerald-700/80 text-lime-100"\n                : "border-white/20 bg-black/55 text-white/70 hover:bg-black/75"\n            }`}',
    'className={`pointer-events-auto relative flex h-9 w-9 items-center justify-center transition-colors active:scale-95 ${\n              hud.ap > 0\n                ? "animate-pulse rounded-lg border-2 border-lime-300/70 bg-gradient-to-b from-lime-500/80 to-emerald-700/80 text-lime-100"\n                : "game-chip text-white/70"\n            }`}',
)
# 6) 퀘스트 로그
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"',
)
# 7) 보스
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300/40 bg-black/55 text-rose-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffb0b0] active:scale-95"',
)
# 8) 혜택
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/40 bg-black/55 text-emerald-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#b8f0a0] active:scale-95"',
)
# 9) 콘텐츠
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-purple-300/40 bg-black/55 text-purple-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#d0b0ff] active:scale-95"',
)
# 10) 유니온
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300/40 bg-black/55 text-indigo-200 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-[#ffd98a] active:scale-95"',
)
# 11) 설정
rep(
    'className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/75 active:scale-95"',
    'className="game-chip pointer-events-auto relative flex h-9 w-9 items-center justify-center text-white/70 active:scale-95"',
)
# 12) 퀘스트 트래커 컨테이너
rep(
    'className="pointer-events-auto mt-20 w-full rounded-lg border border-amber-200/40 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm sm:mt-1 sm:px-3 sm:py-2"',
    'className="game-panel pointer-events-auto mt-20 w-full px-2.5 py-1.5 sm:mt-1 sm:px-3 sm:py-2"',
)

open(P, "w", encoding="utf-8").write(src)
print(f"applied: {n}/12")
