#!/usr/bin/env python3
"""RPG 기본 요소 2차 확장 에셋 베이크 — 전부 실제 외부 CC0 에셋에서 추출.
- Kenney Tiny Dungeon (CC0):
  - tile_0101 (장신 토큰) 틴트 2종 → 힘의 반지(적색) / 생명의 반지(녹색)
  - tile_0117 (망치) → 장비 강화 아이콘
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TD = os.path.join(ROOT, "scripts/asset-sources/assets-src/td_tmp/Tiles")
OUT = os.path.join(ROOT, "public/assets")
os.makedirs(OUT, exist_ok=True)


def bake_tile(tid: str, name: str, scale: int = 2, tint=None):
    im = Image.open(os.path.join(TD, f"tile_{tid}.png")).convert("RGBA")
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    if tint:
        r, g, b = tint
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                pr, pg, pb, pa = px[x, y]
                if pa > 0:
                    px[x, y] = (min(255, pr * r // 255), min(255, pg * g // 255), min(255, pb * b // 255), pa)
    im.save(os.path.join(OUT, f"{name}.png"))
    print(f"{name}.png {im.size}")


# 장신구 — 동일 토큰 틴트 2종 (CC0 동일 팩, 티어 구분)
bake_tile("0101", "item_ring_power", tint=(255, 118, 108))  # 힘의 반지 — 적색
bake_tile("0101", "item_ring_vital", tint=(132, 232, 122))  # 생명의 반지 — 녹색
# 장비 강화 아이콘 — 망치
bake_tile("0117", "icon_hammer")
print("done")
