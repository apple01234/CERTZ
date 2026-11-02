#!/usr/bin/env python3
"""
타일셋에서 **장식 오브젝트**를 자동 검출해 개별 PNG 로 뽑는다.

[문제]
  타일셋 한 장에는 지면 타일·벽·오브젝트·몬스터·아이템이 뒤섞여 있다. 손으로
  좌표를 적으면 수백 개를 다 못 채우고, 비전 판독은 ±1타일 오차가 난다.
  그런데 **오브젝트는 지면 타일과 통계적으로 구분된다**:
   · 지면 타일: 알파가 거의 100% (사각형을 꽉 채움)
   · 오브젝트 : 알파 비율이 훨씬 낮고(모양이 불규칙) 투명 여백이 있다

[방법]
  1) 타일 격자로 자른다
  2) 알파 비율로 지면(fill>=0.97) / 후보(fill<0.90) 를 나눈다
  3) 후보 중 **여러 타일에 걸친 것**(멀티타일 오브젝트)은 따로 처리 —
     인접 후보끼리 연결 요소로 묶어 덩어리로 자른다
  4) 덩어리를 개별 PNG 로 저장 + JSON 목록

[사용]
  python3 tools/extract_objects.py --scan            # 후보 통계
  python3 tools/extract_objects.py --build dungeon   # 오브젝트 PNG 추출
"""
import argparse
import json
import os
import sys
from collections import deque

from PIL import Image

SRC = "/root/workspace/_assets_in"
OUT = "/root/workspace/CERTZ/public/assets/objects"

SETS = {
    "dungeon": ("x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png", 16),
    "forest": ("x2/Tiny RPG Forest/Artwork/Environment/tileset.png", 16),
    "town": ("x2/Gutty Kreum/Free Japanese City Game Assets/Tilemap/Tilemap.png", 16),
}


def load(key):
    rel, tile = SETS[key]
    p = os.path.join(SRC, rel)
    if not os.path.exists(p):
        sys.exit(f"원본 없음: {p}")
    return Image.open(p).convert("RGBA"), tile


def opaque_ratio(cell):
    a = cell.getchannel("A")
    data = a.getdata()
    return sum(1 for v in data if v > 32) / len(data)


def scan(key):
    img, tile = load(key)
    w, h = img.size
    cols, rows = w // tile, h // tile
    ground = obj = empty = 0
    for r in range(rows):
        for c in range(cols):
            cell = img.crop((c * tile, r * tile, (c + 1) * tile, (r + 1) * tile))
            ext = cell.getchannel("A").getextrema()[1]
            if ext < 8:
                empty += 1
                continue
            f = opaque_ratio(cell)
            if f >= 0.97:
                ground += 1
            else:
                obj += 1
    print(f"{key}: {cols}x{rows}={cols*rows}"
          f"  지면(>=97%)={ground}  오브젝트후보={obj}  빈칸={empty}")


def build(key, min_tiles=1, max_tiles=24):
    """후보 타일을 연결 요소로 묶어 덩어리(오브젝트) PNG 로 저장한다."""
    img, tile = load(key)
    w, h = img.size
    cols, rows = w // tile, h // tile

    # 후보 마스크
    cand = [[False] * cols for _ in range(rows)]
    fills = [[0.0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            cell = img.crop((c * tile, r * tile, (c + 1) * tile, (r + 1) * tile))
            if cell.getchannel("A").getextrema()[1] < 8:
                continue
            f = opaque_ratio(cell)
            fills[r][c] = f
            if 0.02 < f < 0.97:      # 투명 여백이 있는 것만 오브젝트
                cand[r][c] = True

    # 연결 요소 (4-이웃)
    seen = [[False] * cols for _ in range(rows)]
    blobs = []
    for r0 in range(rows):
        for c0 in range(cols):
            if not cand[r0][c0] or seen[r0][c0]:
                continue
            q = deque([(c0, r0)])
            seen[r0][c0] = True
            cells = []
            while q:
                c, r = q.popleft()
                cells.append((c, r))
                for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nc, nr = c + dc, r + dr
                    if 0 <= nc < cols and 0 <= nr < rows and cand[nr][nc] and not seen[nr][nc]:
                        seen[nr][nc] = True
                        q.append((nc, nr))
            if not (min_tiles <= len(cells) <= max_tiles):
                continue
            xs = [c for c, _ in cells]
            ys = [r for _, r in cells]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            blobs.append({
                "x": x0, "y": y0, "w": x1 - x0 + 1, "h": y1 - y0 + 1,
                "tiles": len(cells),
            })

    # 넓은 것부터 (큰 장식이 화면에서 중요하다)
    blobs.sort(key=lambda b: -(b["w"] * b["h"]))
    blobs = blobs[:400]

    dst = os.path.join(OUT, key)
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        if f.endswith(".png"):
            os.remove(os.path.join(dst, f))

    index = []
    for i, b in enumerate(blobs):
        px0, py0 = b["x"] * tile, b["y"] * tile
        px1, py1 = (b["x"] + b["w"]) * tile, (b["y"] + b["h"]) * tile
        cut = img.crop((px0, py0, px1, py1))
        # 완전 투명 여백 트리밍 — 충돌 판정과 배치가 정확해진다
        bb = cut.getchannel("A").getbbox()
        if bb:
            cut = cut.crop(bb)
        name = f"{key}_{i:03d}_{b['w']}x{b['h']}.png"
        cut.save(os.path.join(dst, name))
        index.append({
            "file": name, "src": [b["x"], b["y"]],
            "tiles": [b["w"], b["h"]],
            "px": list(cut.size),
        })

    with open(os.path.join(dst, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    total = sum(os.path.getsize(os.path.join(dst, e["file"])) for e in index)
    print(f"{key}: 오브젝트 {len(index)}개 → {dst}  ({total//1024}KB)")
    # 크기 분포 요약
    for lo, hi, label in ((1, 1, "1타일"), (2, 4, "2~4타일"), (5, 9, "5~9타일"), (10, 99, "10타일+")):
        n = sum(1 for e in index if lo <= e["tiles"][0] * e["tiles"][1] <= hi)
        print(f"   {label:8}: {n}개")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", action="store_true")
    ap.add_argument("--build")
    a = ap.parse_args()
    if a.scan:
        for k in SETS:
            scan(k)
    elif a.build:
        keys = list(SETS) if a.build == "all" else [a.build]
        for k in keys:
            build(k)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
