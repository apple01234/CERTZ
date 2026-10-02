#!/usr/bin/env python3
"""스크린샷 아티팩트 정밀 스캔: 검은 내부 + 밝은 녹색 테두리 + 녹색 대각선.
전체 에셋에서 (1) 밝은 녹색 픽셀이 사각형 테두리를 이루고 (2) 내부가 검고
(3) 대각선 녹색 픽셀이 있는 에셋을 찾는다."""
import os
from PIL import Image

ROOT = "/home/z/my-project/public/assets"

def is_bright_green(r, g, b):
    return g >= 140 and g >= r + 60 and g >= b + 60

def is_black(r, g, b):
    return r < 40 and g < 40 and b < 40

hits = []
for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.lower().endswith((".webp", ".png")):
            continue
        p = os.path.join(dirpath, fn)
        try:
            im = Image.open(p).convert("RGBA")
            w, h = im.size
            if w < 16 or h < 16:
                continue
            # 64x64로 리사이즈해 패턴 정규화
            s = im.resize((64, 64))
            px = s.load()
            green_border = 0      # 테두리 3px 밴드의 녹색
            black_inner = 0       # 내부(8~56) 검정
            inner_total = 0
            green_diag = 0        # 대각선 밴드의 녹색
            for y in range(64):
                for x in range(64):
                    r, g, b, a = px[x, y]
                    if a < 50:
                        continue
                    edge = x < 3 or x > 60 or y < 3 or y > 60
                    inner = 8 <= x <= 55 and 8 <= y <= 55
                    near_diag = abs(y - x) <= 3
                    if is_bright_green(r, g, b):
                        if edge:
                            green_border += 1
                        if near_diag and inner:
                            green_diag += 1
                    if inner:
                        inner_total += 1
                        if is_black(r, g, b):
                            black_inner += 1
            if inner_total == 0:
                continue
            bi = black_inner / inner_total
            if bi > 0.6 and green_border >= 40 and green_diag >= 10:
                hits.append((bi, green_border, green_diag, w, h, p))
        except Exception:
            pass

hits.sort(reverse=True)
print(f"candidates: {len(hits)}")
for bi, gb, gd, w, h, p in hits[:20]:
    print(f"blackInner={bi:.2f} greenBorder={gb:3d} greenDiag={gd:3d} {w}x{h} {p.replace(ROOT + '/', '')}")
