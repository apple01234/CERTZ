#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.20 #7 — 엘릭서 아이콘 (HP/MP 100% 회복)
HP 물약 실루엣 → 황금빛 엘릭서 (전체 회복 전설감). 24x24 RGBA."""
from PIL import Image

A = "/home/z/my-project/public/assets"

def hue_shift(src, dst, r_mul, g_mul, b_mul, bright=1.0):
    im = Image.open(f"{A}/{src}.png").convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nr = min(255, int(r * r_mul * bright))
            ng = min(255, int(g * g_mul * bright))
            nb = min(255, int(b * b_mul * bright))
            px[x, y] = (nr, ng, nb, a)
    im.save(f"{A}/{dst}.png")
    print(f"  {dst}.png <- {src}.png")

# 엘릭서 — 진한 황금빛 (빨간 물약을 골드로 변환 + 하이라이트 강조)
hue_shift("item_potion_hp", "item_potion_elixir", 1.62, 1.28, 0.42, 1.14)
print("완료")
