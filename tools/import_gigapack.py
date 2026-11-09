#!/usr/bin/env python3
"""Super Pixel Effects Gigapack → SERTZ fx atlas 변환기.

입력: assets_drop/drop.bin (zip)
출력: CERTZ/public/assets/fx/<key>.png + <key>.json

Gigapack spritesheet.txt 는 `PNG/.../frameNNNN.png = x y w h` 형식의 단순 아틀라스다.
SERTZ 는 pixelfx 스타일 atlas JSON (meta.pixelfx 포함) 을 기대하므로 그 형태로 재작성한다.

사용:
  python3 tools/import_gigapack.py --list
  python3 tools/import_gigapack.py --all
  python3 tools/import_gigapack.py explosions/impact fantasy_spells
"""
import argparse
import io
import json
import os
import re
import sys
import zipfile

SRC = "/root/workspace/assets_drop/drop.bin"
PACK = "Assets/Super Pixel Effects Gigapack (Free Version) v3.2.0/Super Pixel Effects Gigapack (Free Version)/spritesheet/"
OUT = "/root/workspace/CERTZ/public/assets/fx"

LINE_RE = re.compile(r"^(?P<path>.+?)\s*=\s*(?P<x>\d+)\s+(?P<y>\d+)\s+(?P<w>\d+)\s+(?P<h>\d+)\s*$")


def upper_dir_cat(rel: str) -> str:
    """spritesheet/Explosions/epic_explosion_001/... → 카테고리명 소문자."""
    return rel.split("/")[1] if rel.count("/") > 1 else "misc"


def parse_sheet(txt: str):
    frames = []
    for line in txt.splitlines():
        m = LINE_RE.match(line.strip())
        if not m:
            continue
        frames.append(
            (m.group("path"), int(m.group("x")), int(m.group("y")), int(m.group("w")), int(m.group("h")))
        )
    return frames


def discover(z: zipfile.ZipFile):
    """(key, png_member, txt_member, nframes) 목록."""
    txts = [n for n in z.namelist() if n.startswith(PACK) and n.endswith("spritesheet.txt")]
    out = []
    for t in txts:
        leaf = t.split("/")[-2]  # 애니메이션 폴더명
        png = t.replace("spritesheet.txt", "spritesheet.png")
        if png not in z.namelist():
            print(f"  ! png 없음: {t}", file=sys.stderr)
            continue
        out.append((leaf, png, t))
    return out


def key_of(leaf: str) -> str:
    """spell_heal_001_large_red → spell-heal-001-large-red"""
    return re.sub(r"[_\s]+", "-", leaf.strip().lower())


def convert(z: zipfile.ZipFile, leaf: str, png: str, txt: str, dry: bool = False):
    raw = z.read(txt).decode("utf-8", "replace")
    frames = parse_sheet(raw)
    if not frames:
        return None, "프레임 0"

    key = key_of(leaf)
    # 프레임 크기는 첫 프레임 기준. 시트가 균일 격자다.
    fw, fh = frames[0][3], frames[0][4]
    dur = frames[0][4]  # unused
    fps = 15  # guide.txt: 모든 애니메이션 15 FPS

    # 실제 PNG 치수
    import struct

    png_bytes = z.read(png)
    w = h = 0
    if png_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", png_bytes[16:24])

    cols = max(1, w // fw) if fw else 1

    jframes = []
    for i, (path, x, y, fw_i, fh_i) in enumerate(frames):
        jframes.append(
            {
                "filename": f"{key} {i}",
                "frame": {"x": x, "y": y, "w": fw_i, "h": fh_i},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": fw_i, "h": fh_i},
                "sourceSize": {"w": fw_i, "h": fh_i},
                "duration": round(1000 / fps),
            }
        )

    # loop 여부: 폴더명에 looping 이 들어가면 루프
    loop = "looping" in leaf.lower()

    meta = {
        "app": "Super Pixel Effects Gigapack (Will Tice / unTied Games)",
        "version": "1",
        "image": f"{key}.png",
        "format": "RGBA8888",
        "size": {"w": w, "h": h},
        "scale": "1",
        "frameTags": [{"name": key, "from": 0, "to": len(jframes) - 1, "direction": "forward"}],
        "pixelfx": {
            "id": f"gigapack/{leaf}",
            "name": leaf,
            "fps": fps,
            "loop": loop,
            "frames": len(jframes),
            "frameSize": [fw, fh],
            # 가운데-하단 기준: 이펙트가 지면에서 터지도록
            "pivot": [fw // 2, fh - max(1, fh // 8)],
            "columns": cols,
        },
    }

    doc = {"frames": jframes, "meta": meta}
    if dry:
        return key, f"{len(jframes)}f {fw}x{fh} {w}x{h} cols={cols}"
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, f"{key}.png"), "wb") as f:
        f.write(png_bytes)
    return key, f"{len(jframes)}f {fw}x{fh}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("filters", nargs="*")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    z = zipfile.ZipFile(SRC)
    items = discover(z)
    print(f"발견: {len(items)} 애니메이션", file=sys.stderr)

    if args.list:
        cats = {}
        for leaf, _, _ in items:
            cat = leaf.split("_")[0]
            cats[cat] = cats.get(cat, 0) + 1
        for k, v in sorted(cats.items(), key=lambda a: -a[1]):
            print(f"{v:5d}  {k}")
        return

    sel = items
    if not args.all:
        if not args.filters:
            print("필터를 주거나 --all 을 쓰세요", file=sys.stderr)
            return
        sel = [it for it in items if any(f.lower() in it[0].lower() for f in args.filters)]

    ok = skip = 0
    for leaf, png, txt in sel:
        key, info = convert(z, leaf, png, txt, dry=args.dry)
        if key is None:
            skip += 1
            print(f"  skip {leaf}: {info}", file=sys.stderr)
            continue
        ok += 1
        if args.dry:
            print(f"{key:44s} {info}")
    print(f"\n변환 {ok} / 건너뜀 {skip}", file=sys.stderr)


if __name__ == "__main__":
    main()
