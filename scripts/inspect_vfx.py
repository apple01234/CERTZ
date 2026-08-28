#!/usr/bin/env python3
"""VFX 후보 검수 시트 생성 — 참격 변형/파티클/포탈"""
from PIL import Image, ImageDraw
import os

SRC = "/home/z/my-project/scripts/asset-sources/assets-src"
items = []  # (label, image)

# 참격 4변형 × 앞 6프레임
for v in ["Classic", "Alternative 1", "Alternative 2", "Alternative 3"]:
    base = f"{SRC}/slash_pack/{v}/1"
    for f in sorted(os.listdir(base))[:6]:
        im = Image.open(os.path.join(base, f)).convert("RGBA")
        im.thumbnail((64, 76), Image.NEAREST)
        items.append((f"{v[:9]}_{f[-6:-4]}", im))

# Kenney 파티클 (투명)
PP = f"{SRC}/kenney_pp/PNG (Transparent)"
for f in ["slash_01.png","slash_02.png","slash_03.png","slash_04.png",
          "circle_01.png","circle_02.png","circle_03.png","circle_04.png","circle_05.png",
          "light_01.png","light_02.png","light_03.png","flare_01.png",
          "magic_01.png","magic_02.png","magic_03.png","magic_04.png","magic_05.png",
          "star_01.png","star_02.png","star_03.png","star_04.png",
          "spark_01.png","spark_02.png","spark_03.png","spark_04.png",
          "twinkle_01.png","twinkle_02.png","twinkle_03.png","twinkle_04.png","twinkle_05.png"]:
    p = os.path.join(PP, f)
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA")
        im.thumbnail((48, 48), Image.NEAREST)
        items.append((f[:-4], im))

# 포탈 6프레임
portal = Image.open(f"{SRC}/portals32.png").convert("RGBA")
for r in range(6):
    im = portal.crop((0, r * 48, 32, (r + 1) * 48)).resize((64, 96), Image.NEAREST)
    items.append((f"portal{r}", im))

# 시트 조립
cols, cell, cap = 10, 100, 14
rows = (len(items) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + cap)), (30, 32, 44))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(items):
    x, y = (i % cols) * cell, (i // cols) * (cell + cap)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
    d.text((x + 3, y + cell), name[:16], fill=(255, 255, 120))
sheet.save("/tmp/vfx_proof.png")
print("items:", len(items), "-> /tmp/vfx_proof.png", sheet.size)
