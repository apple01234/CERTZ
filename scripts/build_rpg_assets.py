#!/usr/bin/env python3
"""RPG 기본 요소 에셋 베이크 — 전부 실제 외부 CC0 에셋에서 추출.
- Kenney Tiny Dungeon (CC0): 포션(0115/0116), 무기(0103/0104/0106), 방패(0102, 티어 틴트), 상인(0100)
- Kenney Roguelike/RPG pack (CC0): 금화 코인 (53,27)
12px/16px 타일을 2배 NEAREST 업스케일해 게임 해상도로 베이크.
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TD = os.path.join(ROOT, "scripts/asset-sources/assets-src/td_tmp/Tiles")
RG = os.path.join(ROOT, "scripts/asset-sources/assets-src/rg_tmp/Spritesheet/roguelikeSheet_transparent.png")
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


def bake_roguelike(tx: int, ty: int, name: str, scale: int = 2):
    sheet = Image.open(RG).convert("RGBA")
    t = sheet.crop((tx * 17, ty * 17, tx * 17 + 16, ty * 17 + 16))
    t = t.resize((t.width * scale, t.height * scale), Image.NEAREST)
    t.save(os.path.join(OUT, f"{name}.png"))
    print(f"{name}.png {t.size}")


# 소비 아이템
bake_tile("0115", "item_potion_hp")   # 빨간 물약
bake_tile("0116", "item_potion_mp")   # 파란 물약
# 무기 3티어
bake_tile("0103", "item_weapon_1")    # 낡은 단검
bake_tile("0104", "item_weapon_2")    # 강철 검
bake_tile("0106", "item_weapon_3")    # 기사단 대검
# 방어구 3티어 — 동일 방패 티어 틴트 (브론즈/스틸/골드)
bake_tile("0102", "item_armor_1", tint=(200, 168, 120))
bake_tile("0102", "item_armor_2", tint=(216, 224, 234))
bake_tile("0102", "item_armor_3", tint=(255, 215, 106))
# 상점 NPC (회색 머리 장로 상인)
bake_tile("0100", "npc_merchant", scale=2)
# 금화
bake_roguelike(53, 27, "item_coin")
print("done")
