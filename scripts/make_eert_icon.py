#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.15 #13 — eert 큐브 아이콘 (tree를 거꾸로 한 eert 시스템)
24x24 픽셀아트: 뿌리가 위로 향한 나무(거꾸로)가 담긴 마법 큐브"""
from PIL import Image
import numpy as np

W = H = 24
im = np.zeros((H, W, 4), dtype=np.uint8)

# 큐브 몸체 (보라빛 마법 큐브, 베벨)
CUBE = (74, 46, 130, 255)
CUBE_L = (116, 76, 196, 255)
CUBE_D = (46, 28, 84, 255)
im[2:22, 2:22] = CUBE
im[2:6, 2:22] = CUBE_L      # 상단 하이라이트
im[2:22, 2:6] = CUBE_L      # 좌측
im[18:22, 2:22] = CUBE_D    # 하단 그림자
im[2:22, 18:22] = CUBE_D    # 우측
# 외곽선
im[1, 1:23] = (20, 12, 40, 255); im[22, 1:23] = (20, 12, 40, 255)
im[1:23, 1] = (20, 12, 40, 255); im[1:23, 22] = (20, 12, 40, 255)

# 거꾸로 나무: 잎(뿌리)이 위, 줄기가 아래→위로 향함
# 뿌리(위) — 밝은 녹색 갈래
ROOT = (150, 240, 120, 255)
im[5, 9] = ROOT; im[5, 14] = ROOT
im[6, 8] = ROOT; im[6, 10] = ROOT; im[6, 13] = ROOT; im[6, 15] = ROOT
im[7, 9] = ROOT; im[7, 14] = ROOT

# 캐노피(거꾸로 삼각) — 아래가 넓은 게 아니라 위가 넓은(뒤집힌) 형태
CANOPY = (62, 163, 68, 255)
CANOPY_D = (45, 122, 52, 255)
# y=8(넓음 16px) → y=13(좁음 6px)
for y in range(8, 14):
    half = max(1, (13 - y) + 2)  # 위일수록 넓음
    x0 = 12 - half
    x1 = 12 + half - 1
    color = CANOPY if (y - 8) % 2 == 0 else CANOPY_D
    im[y, x0:x1 + 1] = color

# 줄기(아래에서 위로) — 밑바닥에서 캐노피로 연결
TRUNK = (107, 74, 42, 255)
im[13:20, 11:13] = TRUNK
# 지면 반사 느낌 (아래에 잔뿌리)
im[20, 9] = ROOT; im[20, 14] = ROOT

# 반짝임 (마법 기운)
im[4, 5] = (255, 240, 170, 255)
im[17, 18] = (255, 240, 170, 255)
im[9, 19] = (200, 170, 255, 255)

Image.fromarray(im).save("public/assets/item_eert_cube.png")
Image.fromarray(im).resize((192, 192), Image.NEAREST).save("scripts/preview_eert.png")
print("eert cube icon saved 24x24")
