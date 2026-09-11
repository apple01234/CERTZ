#!/usr/bin/env python3
"""모든 방향성 투사체 시트를 프레임 단위로 분할해 8배 확대 몽타주 — 네이티브 방향 눈 확인."""
from PIL import Image, ImageDraw
import os

SHEETS = [
    ("public/assets/vfx2_bolt.webp", 4, "fx2-bolt (마법사 기본볼트)"),
    ("public/assets/x2_sp_darkbolt.webp", 6, "fx-darkbolt (유도뢰)"),
    ("public/assets/x2_sp_arcane.webp", 6, "fx-arcane (아케인볼트)"),
    ("public/assets/x2_sp_icelance.webp", 4, "fx-icelance (아이스랜스)"),
    ("public/assets/x2_sp_fireball.webp", 6, "fx-fireball (파이어볼)"),
]
SCALE = 7
PAD = 10
rows = []
for path, nf, label in SHEETS:
    if not os.path.exists(path):
        rows.append((None, label + " (파일없음)", None))
        continue
    im = Image.open(path).convert("RGBA")
    fw = im.width // nf
    frames = []
    for i in range(nf):
        f = im.crop((i * fw, 0, (i + 1) * fw, im.height))
        bbox = f.getbbox()
        if bbox:
            f = f.crop(bbox)
        f = f.resize((max(1, f.width) * SCALE, max(1, f.height) * SCALE), Image.NEAREST)
        frames.append(f)
    rows.append((frames, label, (fw, im.height)))

W = max(sum(f.width for f in frames) + PAD * (len(frames) + 1) if frames else 300 for frames, _, _ in rows) + PAD * 2
LABEL_H = 24
H = sum((max(f.height for f in frames) if frames else 20) + LABEL_H + PAD for frames, _, _ in rows) + PAD
canvas = Image.new("RGBA", (W, H), (16, 16, 24, 255))
draw = ImageDraw.Draw(canvas)
y = PAD
for frames, label, dims in rows:
    draw.text((PAD, y), f"{label} {dims if dims else ''}", fill=(140, 220, 255, 255))
    y += LABEL_H
    if frames:
        x = PAD
        for f in frames:
            canvas.paste(f, (x, y), f)
            x += f.width + PAD
    y += (max(f.height for f in frames) if frames else 20) + PAD
canvas.save("/home/z/my-project/scripts/proj_tex_montage.png")
print("saved", canvas.size)
