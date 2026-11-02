#!/usr/bin/env python3
"""
_assets_in 타일셋 → CERTZ 타일 아틀라스 추출기

[왜 필요한가]
  _assets_in 에는 탑다운 RPG 타일셋이 여러 개 있는데, 전부 원본 픽셀(16px)이거나
  Unity 메타데이터에 묶여 있어 게임에서 바로 못 쓴다. 이 스크립트가
  · 16px 타일을 4배 nearest 업스케일해 게임의 64px 격자에 맞추고
  · 투명 타일을 걸러내고
  · Phaser spritesheet 한 장 + JSON 인덱스로 굽는다.

[사용]
  python3 tools/extract_tilesets.py --list          # 어떤 타일셋이 있는지
  python3 tools/extract_tilesets.py --preview       # 후보 미리보기 시트 생성
  python3 tools/extract_tilesets.py --build dungeon # 실제 설치
"""
import argparse
import json
import os
import sys

from PIL import Image

SRC = "/root/workspace/_assets_in"
OUT = "/root/workspace/CERTZ/public/assets/tilesets"

# ── 후보 타일셋 ─────────────────────────────────────────────────────────
# (키, 원본 경로, 타일 px, 설명)
SETS = {
    "dungeon": (
        "x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png",
        16,
        "Dungeon Tale — 16px 탑다운 던전 (벽/바닥/가구/오브젝트)",
    ),
    "forest": (
        "x2/Tiny RPG Forest/Artwork/Environment/tileset.png",
        16,
        "Tiny RPG Forest — 16px 탑다운 숲 (나무/풀/길/폭포)",
    ),
    "town": (
        "x2/Gutty Kreum/Free Japanese City Game Assets/Tilemap/Tilemap.png",
        16,
        "Gutty Kreum — 16px 탑다운 마을/상점가 (건물/노점/도로)",
    ),
}


def load(key):
    rel, tile, desc = SETS[key]
    p = os.path.join(SRC, rel)
    if not os.path.exists(p):
        sys.exit(f"원본 없음: {p}")
    return Image.open(p).convert("RGBA"), tile, desc


def grid(img, tile):
    """타일 격자 순회 — 완전 투명 타일은 건너뛴다."""
    w, h = img.size
    cols, rows = w // tile, h // tile
    for r in range(rows):
        for c in range(cols):
            box = (c * tile, r * tile, (c + 1) * tile, (r + 1) * tile)
            cell = img.crop(box)
            # 알파 최대값이 임계 이하면 빈 칸
            if cell.getchannel("A").getextrema()[1] < 8:
                continue
            yield c, r, cell


def cmd_list():
    print(f"{'키':10} {'원본':10} {'타일':6} {'유효타일':>8}  설명")
    print("-" * 78)
    for key in SETS:
        img, tile, desc = load(key)
        n = sum(1 for _ in grid(img, tile))
        w, h = img.size
        print(f"{key:10} {w}x{h:<7} {tile:>4}px {n:>8}  {desc[:34]}")


def cmd_preview(scale=3):
    """모든 후보를 한 장에 이어붙여 눈으로 비교할 수 있게 한다."""
    os.makedirs(OUT, exist_ok=True)
    tiles_all = []
    for key in SETS:
        img, tile, _ = load(key)
        tiles_all.append((key, img, tile))

    pad = 8
    # 각 세트를 가로로 나열
    widths = [im.size[0] * scale for _, im, _ in tiles_all]
    heights = [im.size[1] * scale for _, im, _ in tiles_all]
    W = max(widths) + pad * 2
    H = sum(heights) + pad * (len(tiles_all) + 1)

    canvas = Image.new("RGBA", (W, H), (24, 24, 32, 255))
    y = pad
    for (key, im, tile), w, h in zip(tiles_all, widths, heights):
        big = im.resize((w, h), Image.NEAREST)
        canvas.paste(big, (pad, y), big)
        y += h + pad
    out = os.path.join(OUT, "_preview_all.png")
    canvas.save(out)
    print(f"미리보기: {out} ({W}x{H})")


def cmd_build(key, scale=4):
    img, tile, desc = load(key)
    t = tile * scale
    dst = os.path.join(OUT, key)
    os.makedirs(dst, exist_ok=True)

    tiles = list(grid(img, tile))
    if not tiles:
        sys.exit("유효 타일이 없습니다")

    # 정사각 아틀라스로 재배치 — 빈 칸 없이 compact
    n = len(tiles)
    cols = int(n ** 0.5)
    while cols * cols < n:
        cols += 1
    rows = (n + cols - 1) // cols

    atlas = Image.new("RGBA", (cols * t, rows * t), (0, 0, 0, 0))
    index = []
    for i, (c, r, cell) in enumerate(tiles):
        big = cell.resize((t, t), Image.NEAREST)
        ax, ay = (i % cols) * t, (i // cols) * t
        atlas.paste(big, (ax, ay), big)
        index.append({
            "i": i, "src": [c, r], "atlas": [i % cols, i // cols],
            # 원본 픽셀에서 불투명 비율 — 지면 후보인지 판별하는 데 쓴다
            "fill": round(_opaque_ratio(cell), 3),
        })

    atlas_path = os.path.join(dst, "atlas.png")
    atlas.save(atlas_path, optimize=True)

    meta = {
        "key": key, "desc": desc,
        "source": SETS[key][0], "srcTile": tile, "scale": scale,
        "tileSize": t, "cols": cols, "rows": rows, "count": n,
        "tiles": index,
    }
    with open(os.path.join(dst, "atlas.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    sz = os.path.getsize(atlas_path) // 1024
    print(f"{key}: {n} 타일 → {cols}x{rows} 아틀라스 {atlas.size[0]}x{atlas.size[1]} ({sz}KB)")
    print(f"  {atlas_path}")
    print(f"  타일 {t}px (원본 {tile}px x{scale})")


def _opaque_ratio(cell):
    a = cell.getchannel("A")
    px = a.getdata()
    return sum(1 for v in px if v > 200) / len(px)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--build")
    a = ap.parse_args()
    if a.list:
        cmd_list()
    elif a.preview:
        cmd_preview()
    elif a.build:
        if a.build == "all":
            for k in SETS:
                cmd_build(k)
        else:
            cmd_build(a.build)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
