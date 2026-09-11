#!/usr/bin/env python3
"""flip_r2b 스크린샷에서 화살 4발 부분을 6배 확대 크롭."""
from PIL import Image

im = Image.open("/home/z/my-project/scripts/flip_r2b.png")
# 화살들이 흩어진 영역: (600,130)-(830,530)
crops = [
    (740, 130, 850, 190),   # 위쪽 화살
    (700, 260, 810, 320),   # 두번째
    (670, 380, 780, 435),   # 세번째
    (610, 465, 720, 520),   # 아래쪽
]
SCALE = 6
W = sum((c[2]-c[0]) * SCALE for c in crops) + 20 * (len(crops)+1)
H = max((c[3]-c[1]) * SCALE for c in crops) + 40
canvas = Image.new("RGBA", (W, H), (20, 20, 30, 255))
x = 20
for c in crops:
    part = im.crop(c)
    part = part.resize((part.width * SCALE, part.height * SCALE), Image.NEAREST)
    canvas.paste(part, (x, 20))
    x += part.width + 20
canvas.save("/home/z/my-project/scripts/flip_r2b_arrows_zoom.png")
print("saved", canvas.size)
