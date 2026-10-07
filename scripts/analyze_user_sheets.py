#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
유저 제공 보스 시트 5장 분석 — 검은배경→알파, y/x 투영으로 행·프레임 검출
출력: /tmp/usheet/<name>_rows.png (행 경계 시각화) + 행별 프레임 수 리포트
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

UP = "/home/z/my-project/upload"
OUT = "/tmp/usheet"
os.makedirs(OUT, exist_ok=True)

SHEETS = {
    "vfx":    "file_00000000de4c8209a4b9813a66ae04c4.png",
    "drak_a": "file_000000006604820983e9f96db34595a9.png",   # 녹룡 A (8열)
    "drak_b": "file_000000004a5482069531efe87ab73ca2.png",   # 녹룡 B (6열)
    "wolf":   "file_000000003b688206be0cc7248e5d9eb9.png",   # 설인
    "golem":  "file_00000000dbf88206abc6be51bc743b76.png",   # 골렘
}

def black_to_alpha(im, thr=40):
    """가장자리 연결 근검정 플러드필 → 알파화 (캐릭터 내부 검정 보존)"""
    rgba = np.array(im.convert("RGBA"), dtype=np.uint8)
    a = rgba[..., 3]
    rgb = rgba[..., :3]
    dark = (rgb.max(axis=2) < thr)
    # 배경은 원래 불투명 검정이라 알파 255 → 플러드필로만 제거
    lab, n = ndimage.label(dark)
    edge_labels = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    edge_labels.discard(0)
    mask = np.isin(lab, list(edge_labels))
    a2 = a.copy()
    a2[mask] = 0
    rgba[..., 3] = a2
    return rgba

for name, fn in SHEETS.items():
    im = Image.open(os.path.join(UP, fn))
    rgba = black_to_alpha(im)
    H, W = rgba.shape[:2]
    alpha = rgba[..., 3].astype(np.float32) / 255.0

    # y 투영 → 행 경계
    yproj = alpha.mean(axis=1)
    rows = yproj > 0.01
    # 연속 구간 검출
    segs = []
    in_seg = False
    for y, v in enumerate(rows):
        if v and not in_seg:
            s = y; in_seg = True
        elif not v and in_seg:
            segs.append((s, y)); in_seg = False
    if in_seg:
        segs.append((s, H))
    # 노이즈(2px 미만) 제거 + 인접 병합(간격 6px 미만)
    segs = [s for s in segs if s[1] - s[0] >= 8]
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 6:
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(list(s))
    print(f"\n=== {name} {W}x{H} — {len(merged)}행 ===")
    for i, (y0, y1) in enumerate(merged):
        band = alpha[y0:y1]
        xproj = band.mean(axis=0)
        cols = xproj > 0.01
        csegs = []
        in_seg = False
        for x, v in enumerate(cols):
            if v and not in_seg:
                s = x; in_seg = True
            elif not v and in_seg:
                csegs.append((s, x)); in_seg = False
        if in_seg:
            csegs.append((s, W))
        csegs = [c for c in csegs if c[1] - c[0] >= 8]
        cmerged = []
        for c in csegs:
            if cmerged and c[0] - cmerged[-1][1] < 4:
                cmerged[-1] = (cmerged[-1][0], c[1])
            else:
                cmerged.append(list(c))
        print(f"  행{i}: y={y0}~{y1} (h={y1-y0}) 프레임 {len(cmerged)}개: {[ (c[0],c[1]) for c in cmerged[:10] ]}")
    # 행 경계 시각화 저장
    vis = im.convert("RGB").copy()
    px = vis.load()
    for (y0, y1) in merged:
        for x in range(W):
            px[x, max(0, y0)] = (255, 0, 0)
            px[x, min(H - 1, y1 - 1)] = (255, 0, 0)
    vis.save(os.path.join(OUT, f"{name}_rows.png"))
print("\n완료 → /tmp/usheet/")
