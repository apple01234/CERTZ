#!/usr/bin/env python3
"""v1.2.1 (#7) 미소녀 패스 검수 컨택트시트 — 얼굴 확대 4종 + 전신 4종"""
from PIL import Image, ImageDraw

sheets = ["chf0", "chf1", "chf3", "jobf_berserker", "jobf_archmage", "jobf_windrunner", "cost_silver", "cost_crimson"]
W, H = 96 * 4, 64 * 4
sheet = Image.new("RGBA", (W * 4 + 50, (H + 26) * 2 + 20), (28, 28, 36, 255))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(sheets):
    im = Image.open(f"public/assets/{p}_idle0.webp").convert("RGBA")
    big = im.resize((W, H), Image.NEAREST)
    col, row = i % 4, i // 4
    ox, oy = 10 + col * (W + 10), 8 + row * (H + 26)
    sheet.alpha_composite(big, (ox, oy))
    d.text((ox, oy + H + 4), p, fill=(255, 220, 120, 255))
sheet.save("scripts/girls_review.png")
print(sheet.size)
