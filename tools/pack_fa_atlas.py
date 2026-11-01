#!/usr/bin/env python3
"""
vc226 — FA 개별 PNG 268장 → 아틀라스 1장 + JSON.

## 왜

부팅 요청이 약 1,032개인데 그중 268개(26%)가 FA 프레임이었다.
개별 `load.image` 는 파일당 **HTTP 요청 1개**다:
  - 모바일에서 요청 268개는 커넥션 큐잉·TLS 재사용·프리로드 낭비를 만든다
  - 각 요청이 200ms 걸리면 이론상 53초(브라우저가 6~8 병렬이라 실제로는 수 초)

아틀라스로 묶으면 **파일 1개**가 된다. 프레임 좌표는 JSON 으로 넘긴다.

## 크기 — 손실 없이 줄인다

FA 프레임은 내용이 캔버스의 11%뿐이라 **여백이 대부분**이다.
앵커 정렬을 유지해야 하므로 여백을 잘라내면 안 되지만, 여백은 투명이라
**PNG 로 저장하면 압축된다**. 아틀라스 한 장에 모으면 반복되는 투명 영역이
한 번만 저장되어 원본 합계보다 작아진다.

색 손실은 없다 — 리샘플·양자화를 하지 않고 픽셀을 그대로 옮긴다.

## 출력

  public/assets/fa/p1.png   아틀라스 (격자 배치)
  public/assets/fa/p1.json  프레임 좌표 (Phaser atlas 형식)

사용:
  python3 tools/pack_fa_atlas.py
"""
from __future__ import annotations

import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FA_DIR = os.path.join(ROOT, "public", "assets", "fa")
CHAR = "p1"
COLS = 16  # 16열 격자 — 268 프레임이 17행에 들어간다


def main() -> int:
    src = os.path.join(FA_DIR, CHAR)
    if not os.path.isdir(src):
        print(f"!! 원본 폴더 없음: {src}")
        return 1

    files = sorted(os.listdir(src))
    files = [f for f in files if f.endswith(".png")]
    if not files:
        print("!! PNG 없음")
        return 1

    # 모든 프레임의 캔버스 크기가 같은지 확인 — 다르면 격자 배치가 깨진다
    sizes = set()
    for f in files:
        sizes.add(Image.open(os.path.join(src, f)).size)
    if len(sizes) != 1:
        print(f"!! 캔버스 크기가 여러 종류다: {sizes} — import 스크립트를 먼저 실행할 것")
        return 1
    cw, ch = sizes.pop()

    rows = (len(files) + COLS - 1) // COLS
    atlas = Image.new("RGBA", (cw * COLS, ch * rows), (0, 0, 0, 0))

    frames = {}
    for i, f in enumerate(files):
        cx, cy = (i % COLS) * cw, (i // COLS) * ch
        atlas.paste(Image.open(os.path.join(src, f)).convert("RGBA"), (cx, cy))
        # Phaser atlas 형식: 프레임 이름 = 파일명(확장자 제외)
        frames[f[:-4]] = {
            "frame": {"x": cx, "y": cy, "w": cw, "h": ch},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": cw, "h": ch},
            "sourceSize": {"w": cw, "h": ch},
        }

    png_path = os.path.join(FA_DIR, f"{CHAR}.png")
    json_path = os.path.join(FA_DIR, f"{CHAR}.json")
    atlas.save(png_path, optimize=True)

    meta = {
        "frames": frames,
        "meta": {
            "app": "pack_fa_atlas.py",
            "version": "1.0",
            "image": f"{CHAR}.png",
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
        },
    }
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, separators=(",", ":"))

    # 원본 개별 PNG 는 지운다 — 남겨두면 빌드 산출물에 중복 포함된다.
    #  되돌리려면 `python3 tools/import_fantasy_adventure.py` 로 재생성하면 된다.
    for f in files:
        os.remove(os.path.join(src, f))
    try:
        os.rmdir(src)
    except OSError:
        pass

    orig = sum(1 for _ in files)
    print(f"아틀라스 {atlas.width}x{atlas.height} · {orig}프레임 · 열{COLS} 행{rows}")
    print(f"  {CHAR}.png  {os.path.getsize(png_path):,} bytes")
    print(f"  {CHAR}.json {os.path.getsize(json_path):,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
