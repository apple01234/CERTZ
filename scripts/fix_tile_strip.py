#!/usr/bin/env python3
"""v3.0.13 — 결함 타일 복구
v3.0.8 에셋 교체 때 시트 추출 오류로 4종 타일의 오른쪽 가장자리(약 x44~64)에
인접 타일 조각(잔디 띠/결정 띠)이 구워짐 → 64px 간격으로 반복되어
"길 위에 이상한 타일이 줄지어 배치"된 것으로 보임.

복구: 오른쪽 20px를 같은 타일의 x24~44 영역을 좌우 반전해 덮어씀
(타일 경계 시임이 자연스럽고 자갈/노이즈 패턴 보존).
"""
from PIL import Image
import os

FILES = [
    "public/assets/tile_path.png",
    "public/assets/tile_path_dark.png",
    "public/assets/tile_magma_path.png",
    "public/assets/tile_ice.png",
]
T = 64
STRIP_START = 44          # 이 컬럼부터 오른쪽이 오염 영역
SRC_A, SRC_B = 24, 44     # 반전 소스 구간 [24, 44) → 폭 20px

for path in FILES:
    im = Image.open(path).convert("RGBA")
    assert im.size == (T, T), f"{path}: {im.size} — 64x64 아님"
    px = im.load()
    for k in range(T - STRIP_START):          # k = 0..19
        src_x = SRC_B - 1 - k                 # 43,42,...,24 (반전)
        dst_x = STRIP_START + k               # 44,45,...,63
        for y in range(T):
            px[dst_x, y] = px[src_x, y]
    im.save(path)
    print(f"OK: {path} — x{STRIP_START}~{T} 오염 띠 제거 (미러 패치)")
print("4종 타일 복구 완료")
