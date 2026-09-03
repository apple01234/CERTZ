#!/usr/bin/env python3
"""아이콘 카테고리 몽타주 생성 — 매핑 선정용 (3배 확대, 8열)."""
import glob, os, sys
from PIL import Image, ImageDraw

CAT = sys.argv[1] if len(sys.argv) > 1 else "Potions"
BASE = "/home/z/my-project/upload/extracted/icons"
files = sorted(glob.glob(f"{BASE}/{CAT}/*.png"))[:48]
COLS, CELL, SCALE = 8, 96, 3  # 32->96 display
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new("RGBA", (COLS * CELL, rows * (CELL + 16)), (24, 26, 34, 255))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGBA")
    if im.size[0] != 32:
        im = im.resize((32, 32), Image.NEAREST)
    im = im.resize((32 * SCALE, 32 * SCALE), Image.NEAREST)
    x, y = (i % COLS) * CELL, (i // COLS) * (CELL + 16)
    sheet.paste(im, (x + 2, y + 2), im)
    d.text((x + 4, y + CELL - 2), os.path.basename(f).replace(".png", ""), fill=(255, 255, 160, 255))
out = f"/home/z/my-project/upload/montage_{CAT.replace(' ', '_')}.png"
sheet.save(out)
print(out, f"{len(files)} icons")
