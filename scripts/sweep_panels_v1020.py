#!/usr/bin/env python3
# v1.0.20 — "AI스러운 UI 전면 교체" 1단계: Panels.tsx 패널 컨테이너 프레임 교체
#  rounded-xl + colored border + sertz-panel + bg-slate-950/95 (글래스) → game-panel (우드+금 프레임)
import re, sys

P = "/home/z/my-project/src/components/game/Panels.tsx"
src = open(P, encoding="utf-8").read()
before = src

# 1) 표준 패턴: rounded-xl border-2 border-<color> sertz-panel bg-slate-950/95  → game-panel
n1 = len(re.findall(r"rounded-xl border-2 border-\S+ sertz-panel bg-slate-950/95", src))
src = re.sub(r"rounded-xl border-2 border-\S+ sertz-panel bg-slate-950/95", "game-panel", src)

# 2) sertz-scroll이 앞에 오는 변형 (콘텐츠 허브 2609행): rounded-xl border-2 border-purple-300/50 sertz-panel bg-slate-950/95
#   → 1)과 같은 패턴이라 이미 처리됨. 확인용 카운트만.

# 3) 전직 패널 (3029행): rounded-xl border border-amber-300/30 bg-slate-950/95
n3 = len(re.findall(r"rounded-xl border border-amber-300/30 bg-slate-950/95", src))
src = src.replace("rounded-xl border border-amber-300/30 bg-slate-950/95", "game-panel")

# 4) 대형 인벤토리 프레임 (1447행): 이미 우드톤이지만 game-panel로 통일
n4 = len(re.findall(r"rounded-xl border-2 border-\[#6b5f52\] bg-\[#38322b\]", src))
src = src.replace(
    "flex max-h-[min(94svh,680px)] w-[min(94vw,444px)] flex-col overflow-hidden rounded-xl border-2 border-[#6b5f52] bg-[#38322b] shadow-[0_0_0_2px_#191512,0_18px_50px_rgba(0,0,0,0.65)]",
    "game-panel flex max-h-[min(94svh,680px)] w-[min(94vw,444px)] flex-col overflow-hidden",
)

# 5) 잔존 단순 모달 (bg-slate-950 단색, border-2 border-rose-300/50 등): rounded-xl border-2 border-<color> bg-slate-950(또는 /95)
n5 = len(re.findall(r"rounded-xl border-2 border-\S+ bg-slate-950(?:/95)?(?=\s|\"| p-)", src))
src = re.sub(r"rounded-xl border-2 border-(\S+) bg-slate-950(?:/95)?(?=[\s\"])", r"game-panel border-\1", src)

open(P, "w", encoding="utf-8").write(src)

print(f"std glass panels swapped : {n1}")
print(f"job panel (amber/30)     : {n3}")
print(f"big inventory frame      : {n4}")
print(f"plain slate modals       : {n5}")
print(f"changed: {before != src}")
# 잔존 검증
left = re.findall(r"sertz-panel bg-slate-950", src)
print(f"residual glass containers: {len(left)}")
