#!/usr/bin/env python3
"""투사체 텍스처 네이티브 방향 분석 — 화살촉(두꺼운 쪽)이 좌/우 어느 쪽인지 픽셀 밀도로 판정.
x2_arrow 계열 + fx 볼트 애니 첫 프레임까지 전수 검사."""
import struct, sys, os
from PIL import Image
import numpy as np

FILES = [
    "public/assets/x2_arrow.webp",
    "public/assets/x2_arrow_green.webp",
    "public/assets/x2_arrow_sky.webp",
    "public/assets/x3_shuriken.webp",
]

def analyze(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[:, :, 3]  # alpha
    h, w = a.shape
    # 컬럼별 불투명 픽셀 폭 (수직 두께)
    colwidth = (a > 40).sum(axis=0)
    # 컬럼 질량 중심 x
    cols = np.arange(w)
    total = colwidth.sum()
    if total == 0:
        return f"{path}: 완전 투명"
    com = float((colwidth * cols).sum() / total)
    # 좌 1/3 vs 우 1/3 두께 비교 (화살촉 쪽이 두껍다)
    left = colwidth[: w // 3].mean()
    right = colwidth[2 * w // 3 :].mean()
    # 좌우 끝에서의 두께
    tip_left = colwidth[0]
    tip_right = colwidth[-1]
    # 컬럼 프로파일 8구간 요약
    segs = [round(float(colwidth[i*w//8:(i+1)*w//8].mean()), 1) for i in range(8)]
    verdict = "촉=오른쪽(→ 우향 네이티브)" if right > left else "촉=왼쪽(← 좌향 네이티브)"
    if abs(right - left) < 0.8:
        verdict = "좌우 대칭(방향성 없음 — 회전 무의미)"
    return (f"{os.path.basename(path)}: {w}x{h} 질량중심x={com:.1f}(중앙={w/2:.1f}) "
            f"좌1/3두께={left:.1f} 우1/3두께={right:.1f} 끝픽셀[좌={tip_left},우={tip_right}] "
            f"8구간두께={segs} → {verdict}")

for f in FILES:
    if os.path.exists(f):
        print(analyze(f))
    else:
        print(f"{f}: 파일 없음")

# fx 볼트/아케인 애니 시트도 확인 (프레임 단위)
FX_CANDIDATES = []
for root, _, files in os.walk("public/assets"):
    for fn in files:
        if any(k in fn for k in ("fx2-bolt", "fx-darkbolt", "fx-arcane", "fx_bolt", "fx_arcane", "darkbolt")):
            FX_CANDIDATES.append(os.path.join(root, fn))
print("\n--- fx 애니 시트 후보 ---")
for f in sorted(set(FX_CANDIDATES)):
    print(analyze(f))
