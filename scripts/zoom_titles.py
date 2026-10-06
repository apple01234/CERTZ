#!/usr/bin/env python3
"""설계도 8칸 타이틀 영역 고배율 크롭 — 라벨 재독출"""
from PIL import Image
import os

SRC = "/home/z/my-project/upload/file_000000007f2482099efd40a6479d4f0e.png"
OUT = "/tmp/designcheck"
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC)
W, H = im.size  # 1536x1024
print("size:", W, H)

# 4열 x 2행 그리드, 좌상단 1/9 결측 가정 → 칸 폭 = W/4, 높이 = H/2
cw, ch = W // 4, H // 2
for r in range(2):
    for c in range(4):
        idx = r * 4 + c + 1  # 1/9~8/9 순서 가정
        x0, y0 = c * cw, r * ch
        # 타이틀 = 칸 상단 ~28% 영역
        crop = im.crop((x0, y0, x0 + cw, y0 + int(ch * 0.30)))
        crop = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
        p = f"{OUT}/title_zoom_s{idx}_r{r}c{c}.png"
        crop.save(p)
        print("saved", p, crop.size)
