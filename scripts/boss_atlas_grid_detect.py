#!/usr/bin/env python3
"""블록별 그리드 자동 검출 — 자기상관으로 피치 추정 + 경계 정렬"""
from PIL import Image
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
content = (~bg)

XBANDS = [(15, 522), (567, 1072), (1121, 1623)]
YBANDS = [(11, 328), (352, 676), (695, 949)]

def detect_grid(proj, min_pitch=30, max_pitch=70):
    """투영(빈=0)에 대해 피치 자기상관 추정"""
    p = (~proj).astype(float)  # 빈 곳 = 1
    n = len(p)
    best = (0, -1)
    for pitch in range(min_pitch, min(max_pitch, n // 2)):
        s = 0.0
        cnt = 0
        for k in range(0, n - pitch, 4):
            s += p[k] * p[k + pitch]; cnt += 1
        sc = s / max(1, cnt)
        if sc > best[1]:
            best = (pitch, sc)
    pitch = best[0]
    # 위상: 피치 격자 경계가 '빈 구간 중심'에 오도록
    best_off, best_sc = 0, -1
    for off in range(pitch):
        s, cnt = 0.0, 0
        for bpos in range(off, n, pitch):
            s += p[bpos]; cnt += 1
        sc = s / max(1, cnt)
        if sc > best_sc:
            best_sc, best_off = sc, off
    ncols = int(round((n - best_off) / pitch))
    return pitch, best_off, ncols, best_sc

for bi in range(3):
    for bj in range(3):
        x0, x1 = XBANDS[bj]
        y0, y1 = YBANDS[bi]
        blk = content[y0:y1, x0:x1]
        pitch_c, off_c, nc, sc_c = detect_grid(blk.any(axis=0))
        pitch_r, off_r, nr, sc_r = detect_grid(blk.any(axis=1), 28, 60)
        print(f"블록({bi},{bj}): {x1-x0}x{y1-y0}  열 pitch={pitch_c} off={off_c} n={nc} score={sc_c:.2f} | 행 pitch={pitch_r} off={off_r} n={nr} score={sc_r:.2f}")
