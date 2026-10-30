#!/usr/bin/env python3
"""tile_preview.py — 타일을 실제로 3×3 타일링해 시임과 지형감을 눈으로 판정 (vc206, 지시 #11)

단일 열 비교(px[63] vs px[0])는 표본 1개라 노이즈가 크다. 생성이 wrap 기반이라
원리상 주기적이므로, **실제로 이어붙인 화면**에서 경계가 보이는지가 유일한 판정이다.
"""
import glob, os, sys
from PIL import Image, ImageDraw

OUT = "/root/workspace/CERTZ/public/assets"
SETS = [
    ("A 지형", ["grass", "forest", "dirt", "sand", "stone", "cobble", "brick", "snow"]),
    ("B 지형", ["magma", "lava", "water", "deep", "cave", "ash", "bone", "ice"]),
]


def build(name, tiles, path):
    S = 96          # 표시 크기
    PAD = 6
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    cell_w = S * 3 + PAD * 2
    cell_h = S * 3 + PAD * 2 + 13
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (16, 16, 20))
    d = ImageDraw.Draw(sheet)
    missing = []
    for i, t in enumerate(tiles):
        f = os.path.join(OUT, f"tile_{t}.webp")
        if not os.path.exists(f):
            missing.append(t)
            continue
        im = Image.open(f).convert("RGB").resize((S, S), Image.NEAREST)
        # 3×3 타일링 — 내부 경계가 보이면 시임
        block = Image.new("RGB", (S * 3, S * 3))
        for bx in range(3):
            for by in range(3):
                block.paste(im, (bx * S, by * S))
        cx = (i % cols) * cell_w + PAD
        cy = (i // cols) * cell_h + PAD
        sheet.paste(block, (cx, cy))
        # 타일 경계에 얇은 안내선(시임 판정용 — 실제 이음선 위치)
        for k in range(1, 3):
            d.line([(cx + k * S, cy), (cx + k * S, cy + S * 3)], fill=(255, 60, 60), width=1)
            d.line([(cx, cy + k * S), (cx + S * 3, cy + k * S)], fill=(255, 60, 60), width=1)
        d.text((cx + 2, cy + S * 3 + 1), t, fill=(235, 225, 180))
    sheet.save(path)
    print(f"{name}: {path} {sheet.size} 누락={missing}")
    return sheet


if __name__ == "__main__":
    os.makedirs("/root/.hermes/cache/scratch", exist_ok=True)
    for nm, tiles in SETS:
        build(nm, tiles, f"/root/.hermes/cache/scratch/tile3x3_{nm[0]}.png")
