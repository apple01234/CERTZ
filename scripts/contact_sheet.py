#!/usr/bin/env python3
"""여러 PNG를 하나의 컨택트시트(그리드)로 합쳐 저장 — 라벨은 파일명 축약"""
import sys, glob, os
from PIL import Image, ImageDraw

def contact(files, out, cols=6, cell=150, bg=(24,24,32)):
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols*cell, rows*(cell+14)), bg)
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        try:
            im = Image.open(f).convert("RGBA")
        except Exception:
            continue
        im.thumbnail((cell-8, cell-8), Image.NEAREST)
        cx, cy = (i % cols)*cell, (i // cols)*(cell+14)
        sheet.paste(im, (cx + (cell-im.width)//2, cy + (cell-im.height)//2), im)
        name = os.path.basename(f).replace(".png","")[:22]
        d.text((cx+4, cy+cell+1), name, fill=(220,220,120))
    sheet.save(out)
    print("saved", out, sheet.size, len(files), "items")

if __name__ == "__main__":
    out = sys.argv[1]
    files = []
    for pat in sys.argv[2:]:
        files += sorted(glob.glob(pat, recursive=True))
    contact(files, out)
