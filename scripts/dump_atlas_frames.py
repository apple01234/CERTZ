#!/usr/bin/env python3
"""vc140 — 현재 아틀라스 프레임 품질 확인: 9종 frame 0 연접 시트 생성"""
import json, sys
from PIL import Image

ROOT = "/home/z/my-project"
man = json.load(open(f"{ROOT}/scripts/atlas_manifest.json"))
tiles = []
maxh = 0
for key in ["atl_boss", "atl_boss2", "atl_boss3", "atl_boss_nidhog", "atl_boss_surt",
            "atl_boss_fenrir", "atl_boss_skoll", "atl_boss_nagr", "atl_boss_hati"]:
    info = man[key]
    fw, fh = info["fw"], info["fh"]
    im = Image.open(f"{ROOT}/public/assets/{key}.webp").convert("RGBA")
    # frame 0 = (0,0) 셀
    cell = im.crop((0, 0, fw, fh))
    tiles.append((key, cell, fw, fh))
    maxh = max(maxh, fh)

W = sum(t[2] for t in tiles) + 10 * (len(tiles) + 1)
H = maxh + 20
sheet = Image.new("RGBA", (W, H), (24, 28, 36, 255))
x = 10
for key, cell, fw, fh in tiles:
    sheet.paste(cell, (x, 10), cell)
    x += fw + 10
sheet.save(f"{ROOT}/scripts/atlas_preview/vc140_frame0_contact.png")
print("saved", W, "x", H)
for key, _, fw, fh in tiles:
    kb = __import__("os").path.getsize(f"{ROOT}/public/assets/{key}.webp") // 1024
    print(f"{key}: {fw}x{fh} {kb}KB")
