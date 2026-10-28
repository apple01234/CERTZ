#!/usr/bin/env python3
"""타일셋에서 '반복 가능한 지면 타일'을 자동 추출한다.

기준
----
1) 완전 불투명 (알파 > 16 비율 98.5% 이상) — 지면을 빈틈없이 채울 수 있어야 한다
2) 이음매 무결 (seamless) — 좌/우 끝 열, 상/하 끝 행이 자연스럽게 이어져야 한다
3) 단색 반복이 아니라 미세 변이가 있어야 한다 (표준편차 > 3)

seamless 판정은 타일을 2x2 로 이어붙였을 때 경계 픽셀 차이가 타일 내부
인접 픽셀 차이와 비슷한지로 본다. 경계에서만 튀면 이음새가 보인다.

사용
----
  python3 tools/extract_seamless_tiles.py                  # 후보 리포트
  python3 tools/extract_seamless_tiles.py --save out/      # PNG 저장
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tile_stats(cell_rgb: np.ndarray, alpha: np.ndarray):
    """타일 하나의 지면 적합도 지표."""
    op = alpha > 16
    opaque_ratio = op.mean()
    if opaque_ratio < 0.985:
        return None

    rgb = cell_rgb.astype(np.float32)
    # 내부 인접 픽셀 차이의 평균 (기준선)
    inner_dx = np.abs(np.diff(rgb, axis=1))[op[:, 1:] & op[:, :-1]].mean()
    inner_dy = np.abs(np.diff(rgb, axis=0))[op[1:, :] & op[:-1, :]].mean()
    inner = (inner_dx + inner_dy) / 2

    # 좌우/상하 경계 차이
    edge_lr = np.abs(rgb[:, 0] - rgb[:, -1]).mean()
    edge_tb = np.abs(rgb[0, :] - rgb[-1, :]).mean()

    # 경계가 내부보다 과하게 튀면 이음새가 보인다
    seam_ratio = max(edge_lr, edge_tb) / (inner + 1e-6)

    # 단색 판별
    std = rgb[op].std()

    return {
        "opaque": float(opaque_ratio),
        "inner": float(inner),
        "edge": float(max(edge_lr, edge_tb)),
        "seam_ratio": float(seam_ratio),
        "std": float(std),
    }


def scan_sheet(path, tile):
    im = Image.open(path).convert("RGBA")
    a = np.array(im.getchannel("A"))
    rgb = np.array(im.convert("RGB"))
    H, W = a.shape
    found = []
    for r in range(H // tile):
        for c in range(W // tile):
            y0, x0 = r * tile, c * tile
            cell_a = a[y0:y0 + tile, x0:x0 + tile]
            cell_rgb = rgb[y0:y0 + tile, x0:x0 + tile]
            if cell_a.shape != (tile, tile):
                continue
            st = tile_stats(cell_rgb, cell_a)
            if st is None:
                continue
            if st["seam_ratio"] > 2.2:      # 경계가 내부의 2.2배 넘게 튀면 탈락
                continue
            if st["std"] < 3.0:             # 완전 단색은 지면이 밋밋해진다
                continue
            found.append({"r": r, "c": c, **st,
                          "mean": tuple(np.array(cell_rgb)[cell_a > 16].mean(axis=0).round(0).astype(int))})
    return found, im


SHEETS = [
    ("FAP1", "x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset1.png", 16),
    ("FAP2", "x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset2.png", 16),
    ("TF",   "x2/Tiny RPG Forest/Artwork/Environment/tileset-sliced.png", 32),
    ("DT",   "x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png", 16),
    ("CAINOS_GRASS", "x2/Cainos/Pixel Art Top Down - Basic/Texture/TX Tileset Grass.png", 16),
    ("CAINOS_STONE", "x2/Cainos/Pixel Art Top Down - Basic/Texture/TX Tileset Stone Ground.png", 16),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/root/workspace/_assets_in")
    ap.add_argument("--save")
    args = ap.parse_args()

    os.chdir(args.src)
    total = 0
    for name, rel, T in SHEETS:
        if not os.path.exists(rel):
            print(f"[{name}] 없음: {rel}")
            continue
        found, im = scan_sheet(rel, T)
        total += len(found)
        print(f"\n[{name}] {T}px  반복가능 지면타일 {len(found)}개")
        for f in found[:10]:
            print(f"   ({f['r']},{f['c']}) RGB={f['mean']} seam={f['seam_ratio']:.2f} std={f['std']:.1f}")
        if args.save and found:
            d = os.path.join(args.save, name)
            os.makedirs(d, exist_ok=True)
            for f in found:
                im.crop((f["c"] * T, f["r"] * T, (f["c"] + 1) * T, (f["r"] + 1) * T)).save(
                    os.path.join(d, f"r{f['r']}_c{f['c']}.png"))
            print(f"   → {d} 저장")
    print(f"\n총 {total}개")


if __name__ == "__main__":
    sys.exit(main())
