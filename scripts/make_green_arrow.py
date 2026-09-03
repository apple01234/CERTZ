#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.16 #3 — 데드아이(궁수 4차) 기본공격 전용 초록 화살
기존 골드 화살에 연두 틴트(0x9dffc4)를 씌운 건 ADD 블렌드에서 하얗게 씻겨
"초록색"으로 안 보였다 → 처음부터 에메랄드 그린으로 그린 전용 텍스처.
(28x9, 방향 동일: 촉 오른쪽)"""
from PIL import Image
import numpy as np

W, H = 28, 9
im = np.zeros((H, W, 4), dtype=np.uint8)

DARK = (8, 40, 22, 255)         # 외곽선 (짙은 초록 검정)
SHAFT = (18, 178, 82, 255)      # 샥 진한 에메랄드 (채도 상향 — 밝은 배경에서도 초록으로 읽히게)
SHAFT_L = (96, 232, 148, 255)   # 샥 하이라이트 (연민트→그린 강화)
FEATHER = (150, 250, 190, 255)  # 깃털 그린 화이트
FEATHER2 = (60, 205, 120, 255)  # 깃털 에메랄드
TIP = (120, 255, 175, 255)      # 촉 (발광 민트 그린)

cy = 4

# 몸통 (x6~20)
im[cy - 1:cy + 2, 6:21] = SHAFT
im[cy, 6:21] = SHAFT_L

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

Image.fromarray(im).save("public/assets/x2_arrow_green.png")
Image.fromarray(im).resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_x2_arrow_green.png")
print("green arrow", im.shape, "opaque px:", int(a.sum()))
