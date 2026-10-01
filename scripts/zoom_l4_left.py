#!/usr/bin/env python3
"""flip_l4a/b/c 플레이어 왼쪽 공역 확인 — 화살이 왼쪽으로 나갔는지."""
from PIL import Image, ImageDraw

tests = [
    ("/home/z/my-project/scripts/flip_l4a.png", "l4a +120ms"),
    ("/home/z/my-project/scripts/flip_l4b.png", "l4b +260ms"),
]
SCALE = 4
PAD = 16
LABEL_H = 26
imgs = []
for path, label in tests:
    im = Image.open(path).crop((0, 295, 230, 400))
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST).convert("RGBA")
    imgs.append((im, label))

W = max(im.width for im, _ in imgs) + PAD * 2
H = sum(im.height for im, _ in imgs) + LABEL_H * len(imgs) + PAD * (len(imgs) + 1)
canvas = Image.new("RGBA", (W, H), (18, 18, 28, 255))
draw = ImageDraw.Draw(canvas)
y = PAD
for im, label in imgs:
    draw.text((PAD, y), label, fill=(120, 220, 255, 255))
    y += LABEL_H
    canvas.paste(im, (PAD, y))
    y += im.height + PAD
canvas.save("/home/z/my-project/scripts/flip_l4_leftzone.png")
print("saved", canvas.size)
