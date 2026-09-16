#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.1.1 성별 치장 분리 + 포니테일 재탄생 (유저 지시 #4/#7)
- ⑦ 남/여 치장 분리: 코스튬 10종을 "여성형(cost_*)/남성형(costm_*)" 두 베이스로 전부 재생성
  · 기존 cost_6종(royal/shadow/navy/abyss/nightmare/gilded)은 남성 실루엣이었음 → 여성형으로 재생성
  · costm_* 10종 = 남성 실루엣 (여성 변형 없이 팔레트만 교체)
- ④ 포니테일: 정적 1프레임(묶음=캐릭터 중앙에 꽂혀 얼굴/몸통 앞에 처지던 구조)을
  방향별 3종(정면 f/측면 s/뒷면 b)으로 재생성 — 묶음 위치를 머리 꼭대기/뒤통수에 고정
- ⑤ 무지개 오라 전용 아이콘(i_cos_rainbow) 생성 — 날개 아이콘 재활용 해소
"""
import os, sys
sys.path.insert(0, "/home/z/my-project/scripts")
import gen_char_system as G
from PIL import Image, ImageDraw

OUT = G.OUT

# ---------- ⑦ 코스튬 남/여 두 베이스 ----------
def gen_costumes():
    made = 0
    for key, cfg in G.COSTUMES.items():
        for fr in G.FRAMES:
            im = G.load_frame(fr)
            px = G.colors_of(im)
            # 여성형 cost_* — 6종(남성형이었던 것)도 여성 실루엣으로 재탄생
            im_f = G.make_longhair(im, px)
            px_f = G.colors_of(im_f)
            im_f = G.make_skirt(im_f, px_f)
            im_f = G.remap(im_f, G.costume_mapping(cfg["p"]))
            im_f.save(f"{OUT}/cost_{key}_{fr}.webp", lossless=True)
            # 남성형 costm_* — 실루엣 변형 없이 팔레트만
            im_m = G.remap(im.copy(), G.costume_mapping(cfg["p"]))
            im_m.save(f"{OUT}/costm_{key}_{fr}.webp", lossless=True)
            made += 2
    print("costume frames (f+m):", made)

# ---------- ④ 포니테일 3방향 ----------
# 기존 hair_ponytail.webp에서 팔레트 샘플링
def sample_palette():
    im = Image.open(f"{OUT}/hair_ponytail.webp").convert("RGBA")
    counts = {}
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3] > 0:
                counts[p] = counts.get(p, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])
    cols = [c for c, _ in ranked]
    # 밝기 순 정렬 — [0]=메인, 어두운 톤/밝은 톤 추출
    def lum(c):
        return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    reds = [c for c in cols if c[3] == 255 and c[0] > 150 and c[1] < 110 and c[2] < 110]
    tie = reds[0] if reds else (214, 60, 64, 255)
    # 갈색 계열 = R>B 차이가 나지만 빨강(타이)은 제외 — G가 R의 35% 이상(붉은 단독 우세 제외)
    browns = [c for c in cols if c[3] == 255 and c not in reds and c[0] > c[2] and c[1] >= c[0] * 0.3]
    browns.sort(key=lum)
    dark = browns[0] if browns else (100, 66, 38, 255)
    main = browns[len(browns) // 2] if browns else (139, 93, 52, 255)
    lite = browns[-1] if browns else (176, 128, 76, 255)
    return main, dark, lite, tie

def stamp(im, grid, x0, y0, cmap):
    for dy, row in enumerate(grid):
        for dx, ch in enumerate(row):
            if ch == "." or ch == " ":
                continue
            px, py = x0 + dx, y0 + dy
            if 0 <= px < im.width and 0 <= py < im.height:
                im.putpixel((px, py), cmap[ch])

def flip_grid(grid):
    return [r[::-1] for r in grid]

def gen_ponytail():
    main, dark, lite, tie = sample_palette()
    print("ponytail palette:", main, dark, lite, tie)

    def spine_pts(p0, p1, n):
        """p0→p2 베지어 — pts 리스트"""
        (x0, y0), (x1, y1) = p0, p1
        return [(round(x0 + (x1 - x0) * t / (n - 1)), round(y0 + (y1 - y0) * t / (n - 1))) for t in range(n)]

    def draw_tail(pts, thick0, thick1, sway=0.0):
        """스파인 따라 굵기 선형 감소 + 우측 sway 사인 곡선"""
        im = Image.new("RGBA", (96, 64), (0, 0, 0, 0))
        n = len(pts)
        for i, (cx, cy) in enumerate(pts):
            t = i / (n - 1)
            th = max(2, round(thick0 + (thick1 - thick0) * t))
            sx = round(sway * 2.2 * (1 - abs(0.5 - t) * 2))  # 중간에 최대 휨
            for dx in range(-(th // 2), th // 2 + 1):
                x, y = cx + sx + dx, cy
                if 0 <= x < 96 and 0 <= y < 64:
                    edge = abs(dx) >= th // 2
                    c = dark if (edge or t > 0.82) else (lite if dx < 0 and t < 0.55 else main)
                    im.putpixel((x, y), c)
        return im

    def add_tie(im, cx, cy):
        for dx in range(-2, 3):
            for dy in range(-1, 2):
                x, y = cx + dx, cy + dy
                if 0 <= x < 96 and 0 <= y < 64:
                    im.putpixel((x, y), tie if abs(dx) + abs(dy) < 3 else dark)
        return im

    # (1) 정면 f — 머리 꼭대기(y18)에서 우상향으로 솟은 하이 포니테일 (끝 y≈4)
    pts = spine_pts((50, 18), (56, 4), 16)
    im = draw_tail(pts, thick0=6, thick1=3, sway=0.5)
    add_tie(im, 50, 18)
    im.save(f"{OUT}/hair_ponytail_f.webp", lossless=True)

    # (2) 측면 s — 뒤통수(38,15)에서 목덜미 뒤(31,44)로 S커브 (오른쪽 향함 기준)
    pts = spine_pts((38, 15), (31, 44), 24)
    im = draw_tail(pts, thick0=7, thick1=4, sway=-0.6)
    add_tie(im, 38, 15)
    im.save(f"{OUT}/hair_ponytail_s.webp", lossless=True)

    # (3) 뒷면 b — 머리 중앙(48,16)에서 등 중앙(48,52)로 곧게
    pts = spine_pts((48, 16), (48, 52), 26)
    im = draw_tail(pts, thick0=8, thick1=4, sway=0.0)
    add_tie(im, 48, 16)
    im.save(f"{OUT}/hair_ponytail_b.webp", lossless=True)
    print("ponytail 3 directions done")

# ---------- ⑤ 무지개 오라 아이콘 ----------
def gen_rainbow_icon():
    S = 48
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    cx = cy = S / 2
    rings = [
        (22, (255, 68, 68, 255)),   # 빨
        (19, (255, 158, 40, 255)),  # 주
        (16, (255, 226, 60, 255)),  # 노
        (13, (88, 220, 90, 255)),   # 초
        (10, (70, 160, 255, 255)),  # 파
        (7, (150, 90, 240, 255)),   # 남
    ]
    for r, col in rings:
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=3)
    # 중심 하이라이트
    dr.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255, 235))
    # 부드러운 외곽 글로우
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([2, 2, S - 2, S - 2], outline=(255, 255, 255, 90), width=2)
    im = Image.alpha_composite(glow, im)
    im.save(f"{OUT}/i_cos_rainbow.webp", lossless=True)
    print("rainbow icon done")

if __name__ == "__main__":
    gen_costumes()
    gen_ponytail()
    gen_rainbow_icon()
    print("v1.1.1 gender assets done")
