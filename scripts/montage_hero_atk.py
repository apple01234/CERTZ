#!/usr/bin/env python3
"""hero_atk 프레임을 8배 nearest-neighbor 확대해 walkside(좌향 확정)와 몽타주 비교 PNG 생성."""
from PIL import Image
import os

frames = [
    ("public/assets/hero_walkside0.webp", "walkside0(L-native?)"),
    ("public/assets/hero_walkside1.webp", "walkside1"),
    ("public/assets/hero_atk0.webp", "atk0"),
    ("public/assets/hero_atk1.webp", "atk1"),
    ("public/assets/hero_atk2.webp", "atk2"),
    ("public/assets/hero_atk3.webp", "atk3"),
]
SCALE = 8
PAD = 12
imgs = []
for path, label in frames:
    im = Image.open(path).convert("RGBA")
    # 투명 여백 크롭 (콘텐츠 bbox 기준)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    imgs.append((im, label))

W = sum(im.width for im, _ in imgs) + PAD * (len(imgs) + 1)
H = max(im.height for im, _ in imgs) + PAD * 2 + 24
canvas = Image.new("RGBA", (W, H), (30, 30, 46, 255))
x = PAD
for im, label in imgs:
    canvas.paste(im, (x, PAD), im)
    x += im.width + PAD

canvas.save("/home/z/my-project/scripts/hero_atk_montage.png")
print("saved:", canvas.size)
