#!/usr/bin/env python3
"""흰 늑대·천사 셀 고배율 크롭 — 외곽선/체커 경계 확인용"""
from PIL import Image
import numpy as np

SRC = "/home/z/my-project/upload/file_0000000091d48206b677615d0d54e2ba.png"
img = Image.open(SRC).convert("RGB")
W, H = img.size
bw, bh = W / 3, H / 3
cw, ch = bw / 12, bh / 7

def cell(block_r, block_c, r, c, scale=8):
    x0 = int((block_c * 12 + c) * cw)
    y0 = int((block_r * 7 + r) * ch)
    crop = img.crop((x0, y0, int(x0 + cw) + 1, int(y0 + ch) + 1))
    return crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)

# 흰 늑대 블록(0,1): idle r0c5, run r1c5, atk r2c5 / 천사 블록(2,1): idle r0c6
out = Image.new("RGB", (int(cw) * 8 * 4 + 60, int(ch) * 8 * 2 + 30), (30, 30, 40))
positions = [
    cell(0, 1, 0, 5), cell(0, 1, 1, 5), cell(2, 1, 0, 6), cell(0, 1, 6, 5),
]
for i, cimg in enumerate(positions):
    x = (i % 4) * (int(cw) * 8 + 15)
    y = 0 if i < 4 else 0
    out.paste(cimg, (x, y))
out.save("/home/z/my-project/scripts/atlas_probe1.png")

# 셀 경계선 크롭 (늑대 idle 2셀 경계) — 슬라이스 정확성 확인
x0 = int((1 * 12 + 4) * cw) - 10
y0 = int((0 * 7 + 0) * ch) - 6
crop = img.crop((x0, y0, x0 + int(cw * 2) + 20, y0 + int(ch) + 12))
crop = crop.resize((crop.width * 6, crop.height * 6), Image.NEAREST)
crop.save("/home/z/my-project/scripts/atlas_probe2.png")
print("saved probes")
