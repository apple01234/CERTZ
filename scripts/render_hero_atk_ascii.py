#!/usr/bin/env python3
"""hero_atk 프레임 방향 실측 — walkside(좌향 확정)와 나란히 ASCII 렌더 비교.
휴머노이드 16x16이라 알파만으론 모호할 수 있어 RGB 밝기도 결합 렌더."""
from PIL import Image
import numpy as np, os

def render(path, label):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    alpha = a[:, :, 3]
    rgb = a[:, :, :3].astype(int)
    lum = rgb.mean(axis=2)
    h, w = alpha.shape
    print(f"\n=== {label} ({w}x{h}) ===")
    for y in range(h):
        line = ""
        for x in range(w):
            if alpha[y, x] < 40:
                line += " "
            elif lum[y, x] > 170:
                line += "@"   # 밝음 (피부/금속/무기 하이라이트)
            elif lum[y, x] > 90:
                line += "#"   # 중간 (옷/몸)
            else:
                line += "."   # 어두움 (윤곽/그림자)
        print(line)

for i in range(4):
    render(f"public/assets/hero_atk{i}.webp", f"hero_atk{i}")
for i in range(4):
    render(f"public/assets/hero_walkside{i}.webp", f"hero_walkside{i} (좌향 확정 기준)")
