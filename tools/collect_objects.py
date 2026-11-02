#!/usr/bin/env python3
"""
_assets_in → CERTZ 오브젝트 수집 (최종)

[원칙]
 1. **미리 잘린 오브젝트를 최우선**한다 (`sliced-objects/`, 낱개 PNG).
    제작자가 나눠둔 단위가 정확하고, 타일셋에서 좌표로 자르면 캐노피만
    남거나 지형 타일이 섞이는 사고가 난다(실측으로 확인됨).
 2. 낱개가 없을 때만 타일셋 좌표로 자른다.
 3. 16px 계열은 4배 업스케일해 게임 캐릭터(64px)와 해상도를 맞춘다.
    원본이 이미 큰 것(67x80 등)은 **그대로 둔다** — 확대는 화질만 나빠진다.

[사용]
  python3 tools/collect_objects.py --build
  python3 tools/collect_objects.py --report
"""
from __future__ import annotations

import argparse
import json
import os

from PIL import Image

SRC = "/root/workspace/_assets_in"
OUT = "/root/workspace/CERTZ/public/assets/objects"
TILE = 16
SCALE = 4          # 16px → 64px
MIN_UPSCALE = 32   # 이보다 작은 것만 업스케일 (그 이상은 원본 유지)

# ── 1) 미리 잘린 낱개 오브젝트 ─────────────────────────────────────────
SLICED = {
    "forest": {
        "dir": "x2/Tiny RPG Forest/Artwork/Environment/sliced-objects",
        "map": {
            "tree-orange": ("tree_orange", "big"),
            "tree-pink": ("tree_pink", "big"),
            "tree-dried": ("tree_dried", "big"),
            "rock-monument": ("rock_monument", "big"),
            "rock": ("rock", "small"),
            "bush": ("bush", "small"),
            "bush-tall": ("bush_tall", "small"),
            "sign": ("sign", "wall"),
            "trunk": ("trunk", "small"),
        },
    },
}

# ── 2) 타일셋 좌표 (낱개가 없는 것만) ──────────────────────────────────
TILESETS = {
    "dungeon": ("x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png", 16),
    "town": ("x2/Gutty Kreum/Free Japanese City Game Assets/Tilemap/Tilemap.png", 16),
}

# (이름, 열, 행, 가로, 세로, 태그)
ATLAS_OBJECTS = {
    "dungeon": [
        ("throne",      25, 24, 4, 3, "big"),
        ("bookshelf",   10,  8, 2, 2, "wall"),
        ("table",       20, 27, 2, 2, "floor"),
        ("chest",       12,  6, 1, 1, "small"),
        ("barrel",      23, 25, 1, 3, "small"),
        ("jar",         21, 28, 1, 2, "small"),
        ("anvil",       14,  6, 1, 1, "small"),
        ("torch",       18, 28, 1, 1, "wall"),
        ("candle",      19, 28, 1, 1, "small"),
        ("carpet_v",    24, 13, 3, 9, "floor"),
        ("tree_dead",   20,  7, 4, 3, "big"),
        ("stump",       12, 22, 1, 1, "small"),
        ("rock_small",   9, 16, 1, 1, "small"),
        ("pentagram",   34, 15, 3, 3, "floor"),
        ("grave",        3,  6, 2, 1, "small"),
        ("fence",        9,  6, 3, 1, "wall"),
        ("sign",         7,  6, 1, 1, "wall"),
    ],
    "town": [
        # 점유맵 실측: 건물은 행0~6 까지 이어진다. 행을 5로 잡으면 아래층이 잘린다.
        ("house_blue",   2,  0, 10, 7, "big"),
        ("shop_black",  24,  0, 14, 7, "big"),
        ("stall_stripe",24,  4,  8, 4, "big"),
        ("vending",     26,  6,  2, 2, "wall"),
        ("bench",       24,  8,  2, 2, "small"),
        ("crate",       26, 10,  2, 2, "small"),
        ("barrel",      28,  8,  2, 2, "small"),
        ("planter",     34,  6,  2, 2, "small"),
        ("waterfall",   36, 10,  2, 4, "wall"),
    ],
}


def save(cut: Image.Image, dst: str, name: str, tag: str, entry: dict) -> dict:
    """트리밍 + 조건부 업스케일 후 저장."""
    bb = cut.getchannel("A").getbbox()
    if bb:
        cut = cut.crop(bb)
    if max(cut.size) <= MIN_UPSCALE:
        cut = cut.resize((cut.width * SCALE, cut.height * SCALE), Image.NEAREST)
        entry["scaled"] = SCALE
    else:
        entry["scaled"] = 1
    fname = f"{name}.png"
    cut.save(os.path.join(dst, fname), optimize=True)
    entry.update({"name": name, "file": fname, "tag": tag, "w": cut.width, "h": cut.height})
    return entry


def build_set(setname: str) -> dict:
    dst = os.path.join(OUT, setname)
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        if f.endswith(".png"):
            os.remove(os.path.join(dst, f))

    entries = []

    # 1) 미리 잘린 낱개
    if setname in SLICED:
        info = SLICED[setname]
        base = os.path.join(SRC, info["dir"])
        for srcname, (name, tag) in info["map"].items():
            p = os.path.join(base, f"{srcname}.png")
            if not os.path.exists(p):
                print(f"  ! {name}: {p} 없음")
                continue
            img = Image.open(p).convert("RGBA")
            entries.append(save(img, dst, name, tag, {"src": f"sliced/{srcname}"}))

    # 2) 타일셋 좌표
    if setname in ATLAS_OBJECTS:
        rel, tile = TILESETS[setname]
        sheet = Image.open(os.path.join(SRC, rel)).convert("RGBA")
        for oname, c, r, w, h, tag in ATLAS_OBJECTS[setname]:
            box = (c * tile, r * tile, (c + w) * tile, (r + h) * tile)
            if box[2] > sheet.width or box[3] > sheet.height:
                print(f"  ! {oname}: 시트 밖")
                continue
            cut = sheet.crop(box)
            if cut.getchannel("A").getbbox() is None:
                print(f"  ! {oname}: 빈 칸")
                continue
            entries.append(save(cut, dst, oname, tag, {"src": [c, r, w, h]}))

    with open(os.path.join(dst, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)

    total = sum(os.path.getsize(os.path.join(dst, e["file"])) for e in entries)
    print(f"{setname}: {len(entries)}개 ({total // 1024}KB)")
    return {"set": setname, "count": len(entries), "bytes": total, "entries": entries}


def report(sums):
    print(f"\n{'세트':10} {'개수':>5} {'용량':>8}")
    print("-" * 26)
    for s in sums:
        print(f"{s['set']:10} {s['count']:>5} {s['bytes'] // 1024:>6}KB")
    print("-" * 26)
    print(f"{'합계':10} {sum(s['count'] for s in sums):>5} {sum(s['bytes'] for s in sums) // 1024:>6}KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    if a.build:
        sets = sorted(set(SLICED) | set(ATLAS_OBJECTS))
        sums = [build_set(s) for s in sets]
        report(sums)
    elif a.report:
        sums = []
        for s in sorted(set(SLICED) | set(ATLAS_OBJECTS)):
            p = os.path.join(OUT, s, "catalog.json")
            if os.path.exists(p):
                e = json.load(open(p))
                b = sum(os.path.getsize(os.path.join(OUT, s, x["file"])) for x in e)
                sums.append({"set": s, "count": len(e), "bytes": b})
        report(sums)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
