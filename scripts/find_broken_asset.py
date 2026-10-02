#!/usr/bin/env python3
"""스크린샷의 '검은 사각형 + 녹색 대각선' 에셋 탐색.
모든 webp/png을 열어 검은 픽셀 비율 + 녹색 대각선 패턴을 점수화한다."""
import os, sys
from PIL import Image

ROOT = "/home/z/my-project/public/assets"
hits = []

for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.lower().endswith((".webp", ".png")):
            continue
        p = os.path.join(dirpath, fn)
        try:
            im = Image.open(p).convert("RGBA")
            w, h = im.size
            if w < 8 or h < 8:
                continue
            im2 = im.resize((min(w, 48), min(h, 48)))
            px = im2.load()
            W, H = im2.size
            black = 0
            green_diag = 0
            total = W * H
            for y in range(H):
                for x in range(W):
                    r, g, b, a = px[x, y]
                    if a < 40:
                        continue
                    if r < 30 and g < 30 and b < 30:
                        black += 1
                    # 녹색 우세 픽셀 (대각선 후보)
                    if g > 120 and g > r * 1.8 and g > b * 1.8:
                        # 대각선 근처인가 (y ≈ x or y ≈ H-x)
                        if abs(y - x * H / W) <= max(2, H * 0.06) or abs(y - (H - 1 - x * H / W)) <= max(2, H * 0.06):
                            green_diag += 1
            opaque = sum(1 for y in range(H) for x in range(W) if px[x, y][3] >= 40)
            if opaque == 0:
                continue
            black_ratio = black / opaque
            if black_ratio > 0.5 and green_diag >= 8:
                hits.append((black_ratio, green_diag, w, h, p))
        except Exception as e:
            pass

hits.sort(reverse=True)
print(f"candidates: {len(hits)}")
for br, gd, w, h, p in hits[:25]:
    print(f"black={br:.2f} greenDiagPx={gd:4d} {w}x{h}  {p.replace(ROOT + '/', '')}")
