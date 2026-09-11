#!/usr/bin/env python3
"""원격 공격 시뮬레이션 결과 8배 확대 — remote_r2(우향) vs remote_l(좌향) 활+화살 확인."""
from PIL import Image, ImageDraw

pairs = [
    ("/home/z/my-project/scripts/remote_r2.png", (560, 300, 760, 400), "remote flip=true (RIGHT)"),
    ("/home/z/my-project/scripts/remote_l.png", (560, 300, 760, 400), "remote flip=false (LEFT)"),
]
SCALE = 7
PAD = 16
LABEL_H = 26
imgs = []
for path, box, label in pairs:
    im = Image.open(path).crop(box)
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
canvas.save("/home/z/my-project/scripts/remote_zoom.png")
print("saved", canvas.size)
