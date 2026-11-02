#!/usr/bin/env python3
"""타일셋 좌표 확인용 그리드 이미지 — 어떤 칸이 오브젝트인지 눈으로 고르기 위해."""
import os
import sys

from PIL import Image, ImageDraw

SRC = "/root/workspace/_assets_in"
OUT = "/root/workspace/CERTZ/public/assets/tilesets/_grid"

SETS = {
    "dungeon": ("x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png", 16),
    "forest": ("x2/Tiny RPG Forest/Artwork/Environment/tileset.png", 16),
    "town": ("x2/Gutty Kreum/Free Japanese City Game Assets/Tilemap/Tilemap.png", 16),
}


def build(key, scale=3):
    rel, tile = SETS[key]
    img = Image.open(os.path.join(SRC, rel)).convert("RGBA")
    w, h = img.size
    cols, rows = w // tile, h // tile
    t = tile * scale
    # 좌표 라벨 공간
    pad = 34
    canvas = Image.new("RGB", (cols * t + pad, rows * t + pad), (30, 30, 40))
    big = img.resize((cols * t, rows * t), Image.NEAREST)
    canvas.paste(big, (pad, pad), big)

    d = ImageDraw.Draw(canvas)
    for c in range(cols + 1):
        x = pad + c * t
        d.line([(x, pad), (x, pad + rows * t)], fill=(255, 80, 80, 120) if c % 8 else (255, 220, 0), width=1 if c % 8 else 2)
        if c % 8 == 0:
            d.text((x + 1, 6), str(c), fill=(255, 255, 120))
    for r in range(rows + 1):
        y = pad + r * t
        d.line([(pad, y), (pad + cols * t, y)], fill=(255, 80, 80, 120) if r % 8 else (255, 220, 0), width=1 if r % 8 else 2)
        if r % 8 == 0:
            d.text((4, y + 2), str(r), fill=(255, 255, 120))

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{key}.png")
    canvas.save(p)
    print(f"{key}: {cols}x{rows} 타일 → {p} ({canvas.size[0]}x{canvas.size[1]})")


if __name__ == "__main__":
    keys = sys.argv[1:] or list(SETS)
    for k in keys:
        build(k)
