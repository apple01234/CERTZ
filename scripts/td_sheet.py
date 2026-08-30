#!/usr/bin/env python3
"""Tiny Dungeon 전체 타일 컨택트 시트 — 신규 몬스터 스프라이트 선정용"""
from PIL import Image, ImageDraw
import os

TD = "/home/z/my-project/scripts/asset-sources/assets-src/td_tmp/Tiles"
files = sorted(f for f in os.listdir(TD) if f.endswith(".png"))
cols = 12
cell = 72
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 14)), (40, 40, 52))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(TD, f)).convert("RGBA")
    t = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
    x, y = (i % cols) * cell, (i // cols) * (cell + 14)
    sheet.paste(t, (x + 4, y + 4), t)
    d.text((x + 3, y + cell - 2), f.replace("tile_", "").replace(".png", ""), fill=(255, 255, 120))
sheet.save("/home/z/my-project/scripts/td_all_sheet.png")
print("saved", sheet.size, len(files))
