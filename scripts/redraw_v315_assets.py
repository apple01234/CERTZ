#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.15 에셋 재생성
#17 바닥: 모든 지상 타일에 규칙적 정사각 베벨+경계 라인 -> 64px 격자가 눈에 보이게
#14 나무: tree/pine/pine_snow/pine_dark 좌우 클립(60px) 문제 -> 64x96 캔버스에 여백 확보해 리드로잉
        (충돌바디 setSize(24,20).setOffset(20,74) 유지: 줄기 중심 x=32, y=74~94)
"""
from PIL import Image
import numpy as np

A = "public/assets"

# ---------- 1) 타일 베벨 ----------
TILES = ["tile_grass", "tile_dark", "tile_magma", "tile_snow", "tile_cave",
         "tile_abyss", "tile_hel", "tile_ice", "tile_stone"]

def bevel(path: str):
    im = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    h, w = im.shape[:2]
    # 상/좌 밝게 (8px 페이드)
    for i in range(8):
        f = 1.0 + 0.10 * (1 - i / 8)
        im[i, :, :] = np.clip(im[i, :, :] * f, 0, 255)
        im[:, i, :] = np.clip(im[:, i, :] * f, 0, 255)
    # 하/우 어둡게 (8px 페이드)
    for i in range(8):
        f = 1.0 - 0.11 * (1 - i / 8)
        im[h - 1 - i, :, :] = np.clip(im[h - 1 - i, :, :] * f, 0, 255)
        im[:, w - 1 - i, :] = np.clip(im[:, w - 1 - i, :] * f, 0, 255)
    # 2px 타일 틈 라인 (하단/우측) — 규칙적 정사각 격자의 핵심
    im[h - 2:, :, :] *= 0.80
    im[:, w - 2:, :] *= 0.80
    Image.fromarray(im.astype(np.uint8)).save(path)
    print("beveled", path)

for t in TILES:
    bevel(f"{A}/{t}.png")

# ---------- 2) 나무 리드로잉 ----------
W, H = 64, 96
OUT_Y = 94  # 줄기 바닥 (캔버스 y=94)

def canvas():
    return np.zeros((H, W, 4), dtype=np.uint8)

def ellipse(im, cx, cy, rx, ry, color):
    yy, xx = np.mgrid[0:H, 0:W]
    m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) <= 1.0
    im[m] = color
    return m

def tri(im, pts, color):
    yy, xx = np.mgrid[0:H, 0:W]
    (x1, y1), (x2, y2), (x3, y3) = pts
    d1 = (xx - x2) * (y1 - y2) - (x1 - x2) * (yy - y2)
    d2 = (xx - x3) * (y2 - y3) - (x2 - x3) * (yy - y3)
    d3 = (xx - x1) * (y3 - y1) - (x3 - x1) * (yy - y1)
    neg = (d1 < 0) | (d2 < 0) | (d3 < 0)
    pos = (d1 > 0) | (d2 > 0) | (d3 > 0)
    m = ~(neg & pos)
    im[m] = color
    return m

def outline(im, color):
    """alpha 실루엣 1px 외곽선"""
    a = im[:, :, 3] > 0
    er = a.copy()
    er[1:, :] &= a[:-1, :]
    er[:-1, :] &= a[1:, :]
    er[:, 1:] &= a[:, :-1]
    er[:, :-1] &= a[:, 1:]
    border = a & ~er
    im[border] = color

def speckle(im, color, rng_seed, n=26, y_min=8, y_max=60):
    rng = np.random.default_rng(rng_seed)
    for _ in range(n):
        x = int(rng.integers(8, W - 8))
        y = int(rng.integers(y_min, y_max))
        if im[y, x, 3] > 0:
            im[y, x] = color
            if rng.random() < 0.4 and y + 1 < H:
                im[y + 1, x] = color

def trunk(im, x0, x1, c1, c2):
    yy, xx = np.mgrid[0:H, 0:W]
    m = (xx >= x0) & (xx <= x1) & (yy >= 64) & (yy <= OUT_Y)
    im[m] = c1
    m2 = (xx >= x1 - 2) & (xx <= x1) & (yy >= 64) & (yy <= OUT_Y)
    im[m2] = c2

def save(im, path):
    Image.fromarray(im).save(path)
    a = im[:, :, 3]
    ys, xs = np.where(a > 8)
    print("drew", path, "bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())

# --- tree: 둥근 캐노피 ---
im = canvas()
trunk(im, 28, 36, (107, 74, 42, 255), (80, 53, 32, 255))
c_dark, c_mid, c_lit, c_hi, c_out = (45, 122, 52, 255), (62, 163, 68, 255), (82, 194, 87, 255), (125, 219, 127, 255), (28, 77, 36, 255)
ellipse(im, 32, 52, 22, 17, c_dark)
ellipse(im, 32, 40, 19, 15, c_mid)
ellipse(im, 32, 27, 14, 12, c_lit)
ellipse(im, 27, 24, 7, 5, c_hi)
speckle(im, c_hi, 42, n=30, y_min=10, y_max=62)
outline(im, c_out)
save(im, f"{A}/tree.png")

# --- pine: 뾰족 소나무 ---
im = canvas()
trunk(im, 29, 35, (96, 66, 40, 255), (70, 48, 30, 255))
p_dark, p_mid, p_lit = (38, 100, 56, 255), (54, 140, 70, 255), (72, 168, 84, 255)
tri(im, [(10, 74), (54, 74), (32, 50)], p_dark)
tri(im, [(14, 58), (50, 58), (32, 34)], p_mid)
tri(im, [(18, 42), (46, 42), (32, 13)], p_lit)
speckle(im, (110, 210, 120, 255), 7, n=22, y_min=14, y_max=72)
outline(im, (17, 54, 28, 255))
save(im, f"{A}/pine.png")

# --- pine_snow: 설목 ---
im = canvas()
trunk(im, 29, 35, (88, 62, 46, 255), (64, 45, 34, 255))
s_dark, s_mid, s_lit, snow = (58, 106, 84, 255), (78, 140, 104, 255), (96, 160, 120, 255), (238, 246, 255, 255)
pts_layers = [([(10, 74), (54, 74), (32, 50)], s_dark), ([(14, 58), (50, 58), (32, 34)], s_mid), ([(18, 42), (46, 42), (32, 13)], s_lit)]
for pts, c in pts_layers:
    m = tri(im, pts, c)
# 눈 덮임: 각 층 상단 사면
tri(im, [(14, 66), (46, 60), (32, 52)], snow)
tri(im, [(19, 50), (45, 44), (32, 36)], snow)
tri(im, [(23, 34), (41, 30), (32, 18)], snow)
speckle(im, (255, 255, 255, 255), 11, n=16, y_min=16, y_max=70)
outline(im, (22, 44, 40, 255))
save(im, f"{A}/pine_snow.png")

# --- pine_dark: 시든/어두운 소나무 (심연·지옥) ---
im = canvas()
trunk(im, 29, 35, (70, 52, 44, 255), (50, 38, 32, 255))
d_dark, d_mid, d_lit = (52, 74, 62, 255), (70, 96, 78, 255), (92, 118, 96, 255)
tri(im, [(10, 74), (54, 74), (32, 50)], d_dark)
tri(im, [(14, 58), (50, 58), (32, 34)], d_mid)
tri(im, [(18, 42), (46, 42), (32, 13)], d_lit)
speckle(im, (118, 132, 116, 255), 23, n=20, y_min=14, y_max=72)
outline(im, (16, 24, 20, 255))
save(im, f"{A}/pine_dark.png")

print("done")
