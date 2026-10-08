#!/usr/bin/env python3
"""연결 성분 분석으로 각 블록 행별 스프라이트 위치/개수 정확 측정"""
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
content = ~bg

XBANDS = [(15, 522), (567, 1072), (1121, 1623)]
YBANDS = [(11, 328), (352, 676), (695, 949)]

def label_components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), dtype=int)
    cur = 0
    comps = []
    for y0 in range(h):
        xs = np.where(mask[y0] & (lab[y0] == 0))[0]
        for x0 in xs:
            if lab[y0, x0]: continue
            cur += 1
            q = deque([(y0, x0)]); lab[y0, x0] = cur
            pts = []
            while q:
                y, x = q.popleft(); pts.append((y, x))
                for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur; q.append((ny, nx))
            comps.append(pts)
    return comps

for bi in range(3):
    y0, y1 = YBANDS[bi]
    for bj in range(3):
        x0, x1 = XBANDS[bj]
        blk = content[y0:y1, x0:x1]
        comps = label_components(blk)
        comps = [c for c in comps if len(c) >= 30]  # 노이즈 제거
        # 행 밴드별 성공했는지: y 중심으로 7개 행 그룹화
        rh = (y1 - y0) / 7
        rows = [[] for _ in range(7)]
        for c in comps:
            cy = sum(p[0] for p in c) / len(c)
            rows[min(6, int(cy / rh))].append(c)
        line = f"블록({bi},{bj}) {x1-x0}x{y1-y0}: "
        info = []
        for ri, row in enumerate(rows):
            # 행 내 x 중심 정렬 → 큰 성분(스프라이트 본체)만 카운트: 면적 200+
            big = [c for c in row if len(c) >= 200]
            big.sort(key=lambda c: sum(p[1] for p in c) / len(c))
            centers = [int(sum(p[1] for p in c) / len(c)) for c in big]
            # 인접 병합 (같은 스프라이트의 분리 조각)
            merged = []
            for cx in centers:
                if merged and cx - merged[-1] < 25:
                    merged[-1] = (merged[-1] + cx) // 2
                else:
                    merged.append(cx)
            info.append(f"r{ri}={len(merged)}")
        print(line + " " + " ".join(info))
