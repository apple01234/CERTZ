#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""원본 시트 리뷰 몽타주 — 7x6 격자 가이드 오버레이"""
from PIL import Image, ImageDraw
import os, sys

RAW = "/home/z/my-project/scripts/boss_raw3"
OUT = "/tmp/bossreview"
os.makedirs(OUT, exist_ok=True)

keys = sys.argv[1:] or ["nidhog","jorm","fenrir","behemoth","surt","skoll","gram","nagr","guardian","abysslord","abudditos","vord"]
for k in keys:
    p = f"{RAW}/{k}_raw.png"
    if not os.path.exists(p):
        print("!! 없음", k); continue
    im = Image.open(p).convert("RGB")
    W, H = im.size
    cw, ch = W / 7, H / 7  # 7행 가정 — 열도 7로 그려지는 AI 실수 감지용
    d = ImageDraw.Draw(im)
    for r in range(1, 7):
        y = int(r * H / 7); d.line([(0, y), (W, y)], fill=(255, 0, 255), width=2)
    for c in range(1, 7):
        x = int(c * W / 7); d.line([(x, 0), (x, H)], fill=(0, 255, 255), width=2)
    im.save(f"{OUT}/{k}_grid.jpg", quality=90)
    print("saved", f"{OUT}/{k}_grid.jpg", im.size)
