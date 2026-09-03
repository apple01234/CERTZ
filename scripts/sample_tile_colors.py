#!/usr/bin/env python3
"""현재 바닥 타일들의 평균/대표 색상 추출 — 신규 텍스처 팔레트 기준선"""
from PIL import Image
import os

os.chdir("/home/z/my-project/public/assets")
tiles = ["tile_grass", "tile_dark", "tile_magma", "tile_snow", "tile_cave",
         "tile_stone", "tile_hel", "tile_abyss", "tile_path", "tile_ice", "tile_magma_path", "tile_path_dark"]
for t in tiles:
    p = f"{t}.png"
    if not os.path.exists(p):
        print(f"{t}: MISSING")
        continue
    im = Image.open(p).convert("RGB")
    px = list(im.getdata())
    n = len(px)
    avg = tuple(sum(c[i] for c in px) // n for i in range(3))
    # 중앙 16x16 평균 (가장자리 셰이딩 제외 순수 바탕색)
    cx0, cy0 = im.width // 2 - 8, im.height // 2 - 8
    core = [im.getpixel((x, y)) for x in range(cx0, cx0 + 16) for y in range(cy0, cy0 + 16)]
    cavg = tuple(sum(c[i] for c in core) // len(core) for i in range(3))
    print(f"{t}: {im.width}x{im.height} avg=#{avg[0]:02x}{avg[1]:02x}{avg[2]:02x} core=#{cavg[0]:02x}{cavg[1]:02x}{cavg[2]:02x}")
