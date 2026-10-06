#!/usr/bin/env python3
"""보스 스프라이트 시트 그리드 정밀 분석 — 알파 셀 검출로 행/열/프레임 bbox 산출"""
from PIL import Image
import numpy as np
import sys

UP = "/home/z/my-project/upload"

def analyze(path, name):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[:, :, 3]
    H, W = a.shape
    print(f"\n=== {name} {W}x{H} ===")
    # 행 프로파일: 각 행의 알파 총량
    rowsum = a.sum(axis=1) / 255.0
    colsum = a.sum(axis=0) / 255.0
    # 빈 행/열(완전 투명) 경계 검출
    empty_rows = rowsum < 2
    empty_cols = colsum < 2
    # 행 밴드 검출
    bands = []
    in_band = False
    for y in range(H):
        if not empty_rows[y] and not in_band:
            start = y; in_band = True
        elif empty_rows[y] and in_band:
            bands.append((start, y)); in_band = False
    if in_band: bands.append((start, H))
    print(f"row bands ({len(bands)}): {bands}")
    # 각 밴드 내 열 세그먼트
    for bi, (y0, y1) in enumerate(bands):
        sub = a[y0:y1, :]
        csum = sub.sum(axis=0) / 255.0
        segs = []
        inseg = False
        for x in range(W):
            if csum[x] >= 2 and not inseg:
                xs = x; inseg = True
            elif csum[x] < 2 and inseg:
                segs.append((xs, x)); inseg = False
        if inseg: segs.append((xs, W))
        # 너무 가까운 세그(노이즈) 병합: 간격 < 8px
        merged = []
        for s in segs:
            if merged and s[0] - merged[-1][1] < 8:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(list(s))
        print(f"  band{bi} y[{y0}:{y1}] h={y1-y0}: {len(merged)} segs -> {merged}")

analyze(f"{UP}/file_00000000dbf88206abc6be51bc743b76.png", "GOLEM (muspelheim)")
analyze(f"{UP}/file_000000003b688206be0cc7248e5d9eb9.png", "WOLF/YETI (sniftheim)")
analyze(f"{UP}/file_000000004a5482069531efe87ab73ca2.png", "DRAGON-A (alfheim)")
analyze(f"{UP}/file_000000006604820983e9f96db34595a9.png", "DRAGON-B (detailed)")
