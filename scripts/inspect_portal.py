#!/usr/bin/env python3
"""포탈 후보 + roguelike 시트(화살표/?" 탐색) 검수"""
from PIL import Image, ImageDraw
import os

SRC = "/home/z/my-project/scripts/asset-sources/assets-src"
items = []

def add(label, im):
    im = im.convert("RGBA")
    im.thumbnail((72, 72), Image.NEAREST)
    items.append((label, im))

# portalRings1 128x160 → 32x32 그리드?
r1 = Image.open(f"{SRC}/portalRings1.png")
w, h = r1.size
for r in range(h // 32):
    for c in range(w // 32):
        add(f"r1_{c},{r}", r1.crop((c * 32, r * 32, (c + 1) * 32, (r + 1) * 32)))

# portalRings2 160x32 → 5프레임 32x32
r2 = Image.open(f"{SRC}/portalRings2.png")
for c in range(5):
    add(f"r2_{c}", r2.crop((c * 32, 0, (c + 1) * 32, 32)))

# gif 프레임 샘플 (17프레임 중 6개)
g = Image.open(f"{SRC}/portal_p1.gif")
for i in [0, 3, 6, 9, 12, 15]:
    g.seek(i)
    add(f"p1_f{i}", g.convert("RGBA").resize((96, 96), Image.NEAREST))

g2 = Image.open(f"{SRC}/portal_p2.gif")
for i in range(5):
    g2.seek(i)
    add(f"p2_f{i}", g2.convert("RGBA").resize((96, 96), Image.NEAREST))

cols, cell, cap = 8, 92, 13
rows = (len(items) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + cap)), (30, 32, 44))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(items):
    x, y = (i % cols) * cell, (i // cols) * (cell + cap)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
    d.text((x + 3, y + cell), name[:14], fill=(255, 255, 120))
sheet.save("/tmp/portal_proof.png")
print("portal items:", len(items), "-> /tmp/portal_proof.png")

# roguelike 전체 라벨뷰 (1/3 스케일 3장)
KN = Image.open(f"{SRC}/kenney/Spritesheet/roguelikeSheet_transparent.png").convert("RGBA")
print("roguelike:", KN.size)
W, H = KN.size
s = 2
big = Image.new("RGBA", (W * s, H * s), (40, 40, 52))
up = KN.resize((W * s, H * s), Image.NEAREST)
big.paste(up, (0, 0), up)
d = ImageDraw.Draw(big)
step = 17 * s
for c in range(0, W // 17 + 1, 2):
    for r in range(0, H // 17 + 1, 4):
        d.text((c * 17 * s + 1, r * 17 * s + 1), f"{c},{r}", fill=(255, 255, 0))
# 세로 2분할 저장
half = big.height // 2
big.crop((0, 0, big.width, half)).save("/tmp/rogue_top.png")
big.crop((0, half, big.width, big.height)).save("/tmp/rogue_bot.png")
print("-> /tmp/rogue_top.png, /tmp/rogue_bot.png", big.size)
