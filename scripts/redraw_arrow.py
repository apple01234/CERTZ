#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.15 #15 — 궁수 화살 가시성 개선
16x5 → 28x9 확대, 보호색 문제 해소: 밝은 골드 샥 + 흰 깃털 + 다크 외곽선
(방향은 기존과 동일: 머리/촉 오른쪽)"""
from PIL import Image
import numpy as np

W, H = 28, 9
im = np.zeros((H, W, 4), dtype=np.uint8)

DARK = (43, 32, 22, 255)       # 외곽선
WOOD = (222, 160, 91, 255)     # 샥 밝은 나무
WOOD_L = (255, 233, 176, 255)  # 샥 하이라이트
FEATHER = (245, 248, 255, 255) # 깃털 흰색
FEATHER2 = (170, 200, 235, 255) # 깃털 파란 기운
TIP = (255, 240, 170, 255)     # 촉 (골드 강조)

cy = 4  # 중앙선

# 몸통 (x6~20)
im[cy - 1:cy + 2, 6:21] = WOOD
im[cy, 6:21] = WOOD_L

# 깃털 (x0~7): 위아래 지그재그
im[cy - 3:cy, 2:8] = FEATHER
im[cy + 1:cy + 4, 0:6] = FEATHER2
im[cy, 0:8] = FEATHER

# 촉 (x20~27): 화살촉 삼각형
yy, xx = np.mgrid[0:H, 0:W]
m = (xx >= 20) & (xx <= 27) & (np.abs(yy - cy) <= (27 - xx) // 2 + 1)
im[m] = TIP

# 외곽선: alpha dilate - alpha
a = im[:, :, 3] > 0
d = a.copy()
d[1:, :] |= a[:-1, :]
d[:-1, :] |= a[1:, :]
d[:, 1:] |= a[:, :-1]
d[:, :-1] |= a[:, 1:]
border = d & ~a
im[border] = DARK

Image.fromarray(im).save("public/assets/x2_arrow.png")
im2 = Image.fromarray(im)
im2.resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_x2_arrow.png")
print("arrow", im.shape, "opaque px:", int(a.sum()))
