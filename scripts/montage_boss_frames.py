#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""슬라이스된 보스 프레임 검증 몽타주 — 12종 × idle/walk/atk/die 첫프레임 + idle 전체 시퀀스"""
from PIL import Image, ImageDraw

PUB = "/home/z/my-project/public/assets"
SPECS = [
    ("boss", "guardian 화룡"), ("boss2", "behemoth 유령선"), ("boss3", "abysslord 암흑골렘"),
    ("boss_nidhog", "nidhog 녹룡"), ("boss_surt", "surt 골렘"), ("boss_fenrir", "fenrir 서리늑대"),
    ("boss_skoll", "skoll 금늑대"), ("boss_gram", "gram 핏빛늑대"), ("boss_abudditos", "abudditos 마룡"),
    ("boss_vord", "vord 성황룡"), ("boss_jorm", "jorm 해룡"), ("boss_nagr", "nagr 진홍룡"),
]
COLS, TILE_W, TILE_H = 4, 300, 220
rows = (len(SPECS) + COLS - 1) // COLS
canvas = Image.new("RGB", (TILE_W * COLS, TILE_H * rows), (16, 16, 26))
d = ImageDraw.Draw(canvas)
for i, (prefix, label) in enumerate(SPECS):
    x, y = (i % COLS) * TILE_W, (i // COLS) * TILE_H
    # idle 시퀀스 6프레임 가로 나열 (작게) — 애니 무결성 확인
    seq = Image.new("RGBA", (220 * 6, 147 if "220" else 171), (0, 0, 0, 0))
    try:
        f0 = Image.open(f"{PUB}/{prefix}_idle0.webp")
        fw, fh = f0.size
        seq = Image.new("RGBA", (fw * 6, fh), (0, 0, 0, 0))
        for k in range(6):
            fr_im = Image.open(f"{PUB}/{prefix}_idle{k}.webp").convert("RGBA")
            seq.alpha_composite(fr_im, (k * fw, 0))
    except Exception as e:
        print(f"{prefix}: {e}")
    seq.thumbnail((TILE_W - 10, TILE_H - 46), Image.LANCZOS)
    bg = Image.new("RGBA", (TILE_W - 10, TILE_H - 46), (30, 30, 44, 255))
    bg.alpha_composite(seq)
    canvas.paste(bg.convert("RGB"), (x + 5, y + 34))
    # walk/atk/die 첫프레임 3종 미니 표시
    for j, st in enumerate(["walk0", "atk0", "die0"]):
        try:
            im = Image.open(f"{PUB}/{prefix}_{st}.webp").convert("RGBA")
            im.thumbnail((60, 60), Image.LANCZOS)
            bgj = Image.new("RGBA", (62, 62), (44, 44, 60, 255))
            bgj.alpha_composite(im)
            canvas.paste(bgj.convert("RGB"), (x + 8 + j * 66, y + TILE_H - 66))
        except Exception:
            pass
    d.text((x + 6, y + 6), f"{i+1}. {label}", fill=(255, 220, 130))
    d.text((x + 6, y + 20), f"{prefix} idle 0-5 | walk/atk/die", fill=(150, 150, 170))
canvas.save("/tmp/designcheck/frames_montage.jpg", quality=88)
print("montage saved")
