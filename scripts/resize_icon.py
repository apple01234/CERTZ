#!/usr/bin/env python3
"""궁극기 아이콘 후처리 — 원형 마스크 + 축소 (다른 스킬 아이콘과 톤 통일)"""
from PIL import Image, ImageDraw

src = Image.open("/home/z/my-project/public/assets/skillicon/ultimate_s5_raw.png").convert("RGBA")
size = 256
img = src.resize((size, size), Image.LANCZOS)

# 원형 마스크 (다른 스킬 아이콘은 사각형 png라 사각 유지가 나을 수도 — 안전하게 사각 유지하되 가장자리 살짝 라운드)
mask = Image.new("L", (size, size), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([4, 4, size - 4, size - 4], radius=36, fill=255)
img.putalpha(mask)

out = "/home/z/my-project/public/assets/skillicon/ultimate_s5.png"
img.save(out, "PNG")
print("saved", out, img.size)
