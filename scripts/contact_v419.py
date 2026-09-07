#!/usr/bin/env python3
"""v4.1.9 — SPUM 재조합 결과 컨택트시트 (육안 검증용)"""
import os
from PIL import Image, ImageDraw

OUT = "/home/z/my-project/asset_work/spum_out"
USED = [
    "Human_640352.png", "Human_639405.png", "Human_639234.png", "Elf_451694.png",
    "Human_639493.png", "Skelton_640091.png", "Devil_640476.png", "Human_638981.png",
    "Human_638897.png", "Human_638731.png", "Human_638643.png", "Elf_638140.png",
    "Elf_638308.png", "Devil_640719.png",
]
CELL = 128
COLS = 7
rows = (len(USED) + COLS - 1) // COLS
sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (44, 52, 64, 255))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(USED):
    p = os.path.join(OUT, name)
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    s = min((CELL - 16) / w, (CELL - 16) / h)
    if s < 1:
        im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.NEAREST)
    cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
    sheet.alpha_composite(im, (cx + (CELL - im.width) // 2, cy + (CELL - 8 - im.height)))
    d.text((cx + 4, cy + 2), name.replace(".png", "").replace("Human_", "H").replace("Elf_", "E").replace("Devil_", "D").replace("Skelton_", "S"), fill=(255, 255, 160, 255))
sheet.save("/home/z/my-project/asset_work/v419_contact.png")
print("saved", sheet.size)
