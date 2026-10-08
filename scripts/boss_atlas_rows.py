#!/usr/bin/env python3
"""하단 블록(2,0) 헬 악마 시각화 — 행 구조 확인용"""
from PIL import Image, ImageDraw
import numpy as np
from collections import deque

SRC = "/home/z/my-project/upload/file_0000000091d48206b677615d0d54e2ba.png"
img = Image.open(SRC).convert("RGB")
arr = np.array(img).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
bg_like = ((mx - mn) <= 16) & (mx >= 195)
H = img.height; W = img.width
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

# 하단 3블록 행 거터
for bj, (x0, x1) in enumerate([(15, 522), (567, 1072), (1121, 1623)]):
    blk = content[695:949, x0:x1]
    rowproj = blk.any(axis=1)
    gutters = []
    in_g = False
    for y in range(len(rowproj)):
        if not rowproj[y]:
            if not in_g: gs = y; in_g = True
        else:
            if in_g: gutters.append((gs, y - 1)); in_g = False
    if in_g: gutters.append((gs, len(rowproj) - 1))
    print(f"블록(2,{bj}) 행 거터: {[(a, b_, b_-a+1) for a, b_ in gutters]}")

# 블록(2,0) 크롭 저장 (2배)
crop = img.crop((15, 695, 522, 949))
crop = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
crop.save("/home/z/my-project/scripts/atlas_preview/block_hel.png")
print("saved")
