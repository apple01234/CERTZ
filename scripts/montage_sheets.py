#!/usr/bin/env python3
"""균일 그리드 가정으로 셀을 잘라 검증용 몽타주 생성"""
from PIL import Image, ImageDraw

UP = "/home/z/my-project/upload"
OUT = "/tmp/sheetcheck"

import os
os.makedirs(OUT, exist_ok=True)

def montage(path, name, cols, rows):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    cw, ch = W / cols, H / rows
    # 검은 배경 + 격자선 몽타주 (셀 인덱스 표기)
    canvas = Image.new("RGBA", (W, H), (20, 20, 30, 255))
    canvas.alpha_composite(im)
    d = ImageDraw.Draw(canvas)
    for c in range(1, cols):
        d.line([(c * cw, 0), (c * cw, H)], fill=(255, 0, 0, 160), width=2)
    for r in range(1, rows):
        d.line([(0, r * ch), (W, r * ch)], fill=(0, 255, 255, 160), width=2)
    for r in range(rows):
        for c in range(cols):
            d.text((c * cw + 6, r * ch + 6), f"{r},{c}", fill=(255, 255, 0, 255))
    canvas.convert("RGB").save(f"{OUT}/{name}_grid.jpg", quality=82)
    print(f"{name}: {cols}x{rows} cell={cw:.1f}x{ch:.1f}")

montage(f"{UP}/file_00000000dbf88206abc6be51bc743b76.png", "GOLEM", 6, 6)
montage(f"{UP}/file_000000003b688206be0cc7248e5d9eb9.png", "WOLF", 6, 7)
montage(f"{UP}/file_000000004a5482069531efe87ab73ca2.png", "DRAGON_A", 6, 6)
montage(f"{UP}/file_000000006604820983e9f96db34595a9.png", "DRAGON_B", 7, 7)
montage(f"{UP}/file_00000000de4c8209a4b9813a66ae04c4.png", "FX", 3, 3)
