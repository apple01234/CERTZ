#!/usr/bin/env python3
"""Gigapack symbol 시트 → UI 아이콘(단일 프레임 PNG) 추출.

배경: 랭킹/업적 UI 는 React DOM 이라 Phaser 아틀라스를 못 쓴다. 80x80 시트에서
가장 내용이 많은 프레임을 골라 1장으로 굽는다. 애니메이션 낭비 없이 <img> 로 쓴다.

출력: CERTZ/public/assets/ui_sym/<key>.png  (알파 유지, NEAREST 업스케일 없음)

사용:
  python3 tools/bake_symbol_icons.py --all
  python3 tools/bake_symbol_icons.py --list
"""
import argparse
import glob
import json
import os

from PIL import Image

FX = "/root/workspace/CERTZ/public/assets/fx"
OUT = "/root/workspace/CERTZ/public/assets/ui_sym"


def best_frame(png: str, doc: dict) -> Image.Image:
    """알파 면적이 최대인 프레임을 고른다 — 팝인 애니메이션의 완성 상태."""
    im = Image.open(png).convert("RGBA")
    best, best_area = None, -1
    for f in doc["frames"]:
        fr = f["frame"]
        crop = im.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))
        bb = crop.getchannel("A").getbbox()
        area = (bb[2] - bb[0]) * (bb[3] - bb[1]) if bb else 0
        if area > best_area:
            best, best_area = crop, area
    return best


def trim(im: Image.Image, pad: int = 1) -> Image.Image:
    bb = im.getchannel("A").getbbox()
    if not bb:
        return im
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad),
          min(im.width, bb[2] + pad), min(im.height, bb[3] + pad))
    return im.crop(bb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    sheets = sorted(glob.glob(os.path.join(FX, "symbol-*.json")))
    if args.list:
        for s in sheets:
            print(os.path.basename(s)[:-5])
        return
    if not args.all:
        print("--all 또는 --list")
        return

    os.makedirs(OUT, exist_ok=True)
    n = 0
    for s in sheets:
        key = os.path.basename(s)[:-5]
        png = s[:-5] + ".png"
        doc = json.load(open(s))
        im = trim(best_frame(png, doc))
        # 아이콘 용도라 large/small 중 large만 남긴다
        if "-small-" in key:
            continue
        im.save(os.path.join(OUT, f"{key}.png"))
        n += 1
    print(f"구움 {n}개 → {OUT}")


if __name__ == "__main__":
    main()
