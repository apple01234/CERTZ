#!/usr/bin/env python3
"""마스터 전체 세로 거터(블록 경계) 검출 + 블록별 시각화"""
from PIL import Image, ImageDraw
import numpy as np
from collections import deque

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

# 마스터 전체 세로 투영 — 큰 빈 세로 밴드 = 블록 경계
colproj = content.any(axis=0)
bands = []
in_g = False
for x in range(W):
    if not colproj[x]:
        if not in_g: gs = x; in_g = True
    else:
        if in_g:
            if x - gs >= 8: bands.append((gs, x - 1))
            in_g = False
if in_g and W - gs >= 8: bands.append((gs, W - 1))
print("세로 빈 밴드(≥8px):", bands)

rowproj = content.any(axis=1)
rbands = []
in_g = False
for y in range(H):
    if not rowproj[y]:
        if not in_g: gs = y; in_g = True
    else:
        if in_g:
            if y - gs >= 8: rbands.append((gs, y - 1))
            in_g = False
if in_g and H - gs >= 8: rbands.append((gs, H - 1))
print("가로 빈 밴드(≥8px):", rbands)

# 블록(0,1) 백랑에 등분 그리드 오버레이 시각화
bx0, bx1 = round(W/3), round(2*W/3)
by0, by1 = 0, round(H/3)
crop = img.crop((bx0, by0, bx1, by1)).convert("RGBA")
ov = Image.new("RGBA", crop.size, (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
cw = (bx1 - bx0) / 12
chh = (by1 - by0) / 7
for c in range(13):
    x = round(c * cw)
    d.line([(x, 0), (x, crop.height)], fill=(255, 0, 0, 160), width=1)
for rr in range(8):
    y = round(rr * chh)
    d.line([(0, y), (crop.width, y)], fill=(0, 120, 255, 160), width=1)
base = Image.alpha_composite(crop, ov)
base = base.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
base.save("/home/z/my-project/scripts/atlas_preview/grid_overlay_wolf.png")
print("overlay saved")
