#!/usr/bin/env python3
"""공격 중 캐릭터 스프라이트 8배 확대 — r2b(우향 발사) vs l4b(좌향 발사) 비교 몽타주."""
from PIL import Image, ImageDraw, ImageFont

pairs = [
    ("/home/z/my-project/scripts/flip_r2b.png", (185, 320, 260, 400), "r2b: RIGHT attack"),
    ("/home/z/my-project/scripts/flip_l4b.png", (185, 320, 260, 400), "l4b: LEFT attack"),
    ("/home/z/my-project/scripts/flip_l4c.png", (185, 320, 260, 400), "l4c: LEFT attack +130ms"),
]
SCALE = 8
PAD = 24
LABEL_H = 30
imgs = []
for path, box, label in pairs:
    im = Image.open(path).crop(box)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    imgs.append((im, label))

W = max(im.width for im, _ in imgs) + PAD * 2
H = sum(im.height for im, _ in imgs) + LABEL_H * len(imgs) + PAD * (len(imgs) + 1)
canvas = Image.new("RGBA", (W, H), (18, 18, 28, 255))
draw = ImageDraw.Draw(canvas)
y = PAD
for im, label in imgs:
    draw.text((PAD, y), label, fill=(255, 220, 120, 255))
    y += LABEL_H
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    canvas.paste(im, (PAD, y), im)
    y += im.height + PAD
canvas.save("/home/z/my-project/scripts/flip_char_zoom.png")
print("saved", canvas.size)
