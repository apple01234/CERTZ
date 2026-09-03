#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.20 #1 — 스카이로드(궁수 4차·윈드러너 계열) 전용 구름색(하늘색) 화살
데드아이 초록 화살(make_green_arrow.py)과 동일 구조 — 구름 블루 팔레트만 교체.
(28x9, 촉 오른쪽)"""
from PIL import Image
import numpy as np

W, H = 28, 9
im = np.zeros((H, W, 4), dtype=np.uint8)

DARK = (10, 34, 58, 255)          # 외곽선 (짙은 남색)
SHAFT = (64, 158, 224, 255)       # 샥 진한 하늘색 (구름 블루)
SHAFT_L = (150, 214, 250, 255)    # 샥 하이라이트 (밝은 하늘)
FEATHER = (222, 242, 255, 255)    # 깃털 구름 화이트
FEATHER2 = (120, 188, 240, 255)   # 깃털 미드 스카이
TIP = (198, 236, 255, 255)        # 촉 (발광 구름 화이트 블루)

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

Image.fromarray(im).save("public/assets/x2_arrow_sky.png")
Image.fromarray(im).resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_x2_arrow_sky.png")
print("sky arrow", im.shape, "opaque px:", int(a.sum()))
