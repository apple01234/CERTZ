#!/usr/bin/env python3
"""v3.0.23 (#55) — 던전 벽 텍스처 교체.
문제: x2_bricks(어두운 벽돌+검은 가시 실루엣)를 44~54% 명도로 틴트하면
      유저 표현 그대로 "이상한 검은색 카펫"처럼 보임.
해결: 밝은 회색 석벽(블록+줄눈+균열+노이즈)을 새로 생성 — 챕터 틴트가 색을 입히고
      베이스 명도를 0.62~0.74로 올려 암벽으로 읽히게 만든다.
출력: public/assets/wall_rock.png (96x96, 타일링 대응)"""
from PIL import Image, ImageDraw
import random

W = H = 96
BRICK_H = 24          # 벽돌 높이
BRICK_W = 48          # 벽돌 폭 (엇갈림)
MORTAR = 3            # 줄눈 두께

random.seed(20250903)

img = Image.new("RGB", (W, H))
dr = ImageDraw.Draw(img)

BASE = (158, 156, 150)      # 밝은 회색 석재
MORTAR_C = (108, 105, 100)  # 줄눈(어두운 회색) — 바닥과 확실히 다른 질감

# 1) 줄눈 배경
dr.rectangle([0, 0, W, H], fill=MORTAR_C)

# 2) 벽돌 (엇갈린 레이아웃, 시드 기반 명도 변주)
y = 0
row = 0
while y < H:
    x = -(BRICK_W // 2) if row % 2 else 0
    bx = x
    while bx < W:
        v = random.uniform(0.9, 1.08)
        c = tuple(min(255, int(ch * v)) for ch in BASE)
        x0, y0 = bx + MORTAR, y + MORTAR
        x1, y1 = min(bx + BRICK_W, W + BRICK_W), min(y + BRICK_H, H)
        if x1 > x0 and y1 > y0:
            dr.rectangle([x0, y0, x1 - 1, y1 - 1], fill=c)
            # 상단 하이라이트 / 하단 그림자 — 블록 입체감
            hi = tuple(min(255, int(ch * 1.14)) for ch in c)
            lo = tuple(int(ch * 0.78) for ch in c)
            dr.line([x0, y0, x1 - 1, y0], fill=hi)
            dr.line([x0, y1 - 2, x1 - 1, y1 - 2], fill=lo)
        bx += BRICK_W
    y += BRICK_H
    row += 1

# 3) 균열 + 스페클 노이즈 (돌 질감)
for _ in range(10):
    x0 = random.randint(4, W - 4)
    y0 = random.randint(4, H - 4)
    pts = [(x0, y0)]
    for _ in range(random.randint(3, 6)):
        dx, dy = random.randint(-9, 9), random.randint(-6, 6)
        px, py = pts[-1]
        pts.append((max(0, min(W - 1, px + dx)), max(0, min(H - 1, py + dy))))
    dr.line(pts, fill=tuple(int(ch * 0.7) for ch in BASE), width=1)
for _ in range(220):
    px, py = random.randint(0, W - 1), random.randint(0, H - 1)
    g = random.randint(-16, 16)
    r0, g0, b0 = img.getpixel((px, py))
    img.putpixel((px, py), (max(0, min(255, r0 + g)), max(0, min(255, g0 + g)), max(0, min(255, b0 + g))))

# 4) 타일링 봉합: 좌우/상하 경계가 줄눈에 걸치도록 시프트 검증은 생략(레이아웃이 격자 정렬)
img.save("/home/z/my-project/public/assets/wall_rock.png")
print("wall_rock.png", img.size)
