#!/usr/bin/env python3
"""시작 마을 에셋 베이크 — 전부 실제 외부 CC0/CC-BY 에셋에서 추출.
- ArMM1998 Zelda-like (CC0) Overworld.png: 집 2채, 우물
- Kenney Tiny Dungeon (CC0): 마을 주민 2인
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OW = os.path.join(ROOT, "scripts/asset-sources/assets-src/zelda_gfx/gfx/Overworld.png")
TD = os.path.join(ROOT, "scripts/asset-sources/assets-src/td_tmp/Tiles")
OUT = os.path.join(ROOT, "public/assets")
os.makedirs(OUT, exist_ok=True)


def bbox_crop(im, region):
    """영역 내 불투명 픽셀의 실제 bbox로 잘라내기"""
    c = im.crop(region)
    bb = c.getbbox()
    return c.crop(bb) if bb else c


def save_baked(im, name, scale=2):
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(OUT, f"{name}.png"))
    print(f"{name}.png {im.size}")


ow = Image.open(OW).convert("RGBA")
# 집 A — 문+창문 있는 주택 (좌상단)
save_baked(bbox_crop(ow, (100, 0, 178, 84)), "house_a")
# 집 B — 2층 창 있는 큰 집/회관 (하단 잔디 조각 y>=79 제외)
save_baked(bbox_crop(ow, (182, 0, 254, 79)), "house_b")
# 우물 — 원형 석재 (3개가 붙어있어 첫 번째 것만, 48px 단위)
save_baked(bbox_crop(ow, (352, 152, 400, 200)), "well", scale=2)
# 마을 주민 (Kenney Tiny Dungeon 16px → 2배)
for tid, name in [("0085", "npc_villager1"), ("0088", "npc_villager2")]:
    im = Image.open(os.path.join(TD, f"tile_{tid}.png")).convert("RGBA")
    save_baked(im, name, scale=2)
print("done")
