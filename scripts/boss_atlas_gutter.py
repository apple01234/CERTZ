#!/usr/bin/env python3
"""실제 셀 경계(거터) 검출 — 콘텐츠 x/y 투영의 빈 구간 분석"""
from PIL import Image
import numpy as np
from collections import deque
import sys
sys.path.insert(0, "/home/z/my-project/scripts")

# bg 마스킹 재사용 (slice 스크립트와 동일 로직)
SRC = "/home/z/my-project/upload/file_0000000091d48206b677615d0d54e2ba.png"
img = Image.open(SRC).convert("RGB")
W, H = img.size
arr = np.array(img).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
bg_like = ((mx - mn) <= 16) & (mx >= 195)
bg = np.zeros((H, W), dtype=bool); dq = deque()
for x in range(W):
    for y in (0, H - 1):
        if bg_like[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if bg_like[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
while dq:
    y, x = dq.popleft()
    for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
        if 0 <= ny < H and 0 <= nx < W and bg_like[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; dq.append((ny, nx))
content = ~bg

# 블록 (0,1) 백랑 — 셀 열 경계 검출
bx0, bx1 = round(W/3), round(2*W/3)
by0, by1 = 0, round(H/3)
blk = content[by0:by1, bx0:bx1]
colproj = blk.any(axis=0)  # 각 x에 콘텐츠 존재?
# 빈 구간(gutter) 찾기
gutters = []
in_g = False
for x in range(len(colproj)):
    if not colproj[x]:
        if not in_g: gs = x; in_g = True
    else:
        if in_g:
            gutters.append((gs, x - 1)); in_g = False
if in_g: gutters.append((gs, len(colproj) - 1))
print(f"블록 폭: {bx1-bx0}, 거터 수: {len(gutters)}")
print("거터 (start,end,폭):", [(a, b_, b_-a+1) for a, b_ in gutters])

# 등분 그리드와 비교: 45.53px 간격 경계 위치
cw = (bx1 - bx0) / 12
print("등분 경계:", [round(c * cw) for c in range(13)])

rowproj = blk.any(axis=1)
rg = []
in_g = False
for y in range(len(rowproj)):
    if not rowproj[y]:
        if not in_g: gs = y; in_g = True
    else:
        if in_g: rg.append((gs, y - 1)); in_g = False
if in_g: rg.append((gs, len(rowproj) - 1))
chh = (by1 - by0) / 7
print(f"행 거터 수: {len(rg)}, 등분 경계: {[round(rr * chh) for rr in range(8)]}")
print("행 거터:", [(a, b_, b_-a+1) for a, b_ in rg][:20])
