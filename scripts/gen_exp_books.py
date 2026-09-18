#!/usr/bin/env python3
"""v1.2.0 (#15 경험치책 비약 3종) — i_exp_book 아이콘 3색 변형 생성.
고급(청록)=지혜/태풍(보라)=폭풍/극한(황금)=극한의 빛 — 팔레트 회전 + 광택 강조."""
from PIL import Image
import os

ROOT = "/home/z/my-project/public/assets"
SRC = os.path.join(ROOT, "i_exp_book.webp")
base = Image.open(SRC).convert("RGBA")
px = base.load()
w, h = base.size


def hue_shift(img, deg: float, sat: float = 1.0, val: float = 1.0) -> Image.Image:
    out = img.copy()
    po = out.load()
    import colorsys
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = (hh + deg / 360.0) % 1.0
            ss = min(1.0, ss * sat)
            vv = min(1.0, vv * val)
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            po[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def add_star(img, color, alpha=230):
    """극한용 — 모서리에 4갹 별 추가(강조)."""
    out = img.copy()
    po = out.load()
    cx, cy, R = 8, 8, 5
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            x, y = cx + dx, cy + dy
            if 0 <= x < w and 0 <= y < h:
                d = abs(dx) + abs(dy)
                if d <= R:
                    r0, g0, b0, a0 = out.getpixel((x, y))
                    na = max(a0, alpha) if d <= 2 else (alpha if d <= R - 1 else a0)
                    po[x, y] = (color[0], color[1], color[2], na)
    return out


# 고급 성장의 비약 — 청록(Teal)
hue_shift(base, 0.47, 1.15, 1.05).save(os.path.join(ROOT, "i_exp_book_s.webp"))
# 태풍 성장의 비약 — 보라(Purple)
hue_shift(base, 0.72, 1.2, 1.0).save(os.path.join(ROOT, "i_exp_book_m.webp"))
# 극한 성장의 비약 — 황금(Gold) + 별
gold = add_star(hue_shift(base, 0.13, 1.25, 1.15), (255, 235, 140))
gold.save(os.path.join(ROOT, "i_exp_book_l.webp"))
print("saved: i_exp_book_s/m/l.webp")
