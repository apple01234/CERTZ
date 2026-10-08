#!/usr/bin/env python3
"""보스 아틀라스 마스터 시트 구조 정밀 측정 — 체커보드 배경 색/격자 주기·블록 경계 측정"""
from PIL import Image
import numpy as np

SRC = "/home/z/my-project/upload/file_0000000091d48206b677615d0d54e2ba.png"
img = Image.open(SRC).convert("RGBA")
W, H = img.size
print(f"master: {W}x{H}")

a = np.array(img)
rgb = a[..., :3].astype(int)
alpha = a[..., 3]

# 1) 알파 분포
print("alpha uniq(sample):", np.unique(alpha)[:10], "..." if len(np.unique(alpha)) > 10 else "")
opaque = alpha > 200
print(f"opaque ratio: {opaque.mean():.3f}")

# 2) 가장자리 색 샘플 (체커보드 톤 후보)
corners = [rgb[0, 0], rgb[0, W-1], rgb[H-1, 0], rgb[H-1, W-1]]
print("corners:", [tuple(c) for c in corners])

# 3) 상단 20행의 색 히스토그램 상위 8개
top = rgb[:20].reshape(-1, 3)
colors, counts = np.unique(top, axis=0, return_counts=True)
order = np.argsort(-counts)[:8]
print("top-row colors:")
for i in order:
    print(f"  {tuple(colors[i])} x{counts[i]}")

# 4) 체커 격자 주기 측정: 첫 행에서 색 반전 지점 찾기
row0 = rgb[2, :, 0]  # R 채널
flips = np.where(np.abs(np.diff(row0.astype(int))) > 8)[0]
print("row2 R-flip positions (first 30):", flips[:30].tolist())

# 5) 세로 블록 경계 추정: 각 행의 불투명/투명 비율 프로파일
row_opaque = opaque.mean(axis=1)
# 3등분 경계 근처의 비율 확인
for frac in (1/3, 2/3):
    y = int(H * frac)
    band = row_opaque[max(0, y-4):y+4]
    print(f"row-opaque around y={y}: {np.round(band, 3).tolist()}")

# 6) 블록별 12×7 등분 셀 안 불투명 비율 (니드호그 블록 = 좌상단) — 셀 경계 정확성 검증
bw, bh = W / 3, H / 3
print(f"block size: {bw:.2f} x {bh:.2f}")
blk = opaque[:int(bh), :int(bw)]
cell_h, cell_w = bh / 7, bw / 12
print(f"cell size: {cell_w:.2f} x {cell_h:.2f}")
grid = np.zeros((7, 12))
for r in range(7):
    for c in range(12):
        y0, y1 = int(r * cell_h), int((r + 1) * cell_h)
        x0, x1 = int(c * cell_w), int((c + 1) * cell_w)
        grid[r, c] = blk[y0:y1, x0:x1].mean()
print("block0 cell opaque-ratio grid:")
for r in range(7):
    print("  ", " ".join(f"{v:.2f}" for v in grid[r]))
