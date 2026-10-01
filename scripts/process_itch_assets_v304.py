#!/usr/bin/env python3
"""
v3.0.4 — itch.io 0x72 DungeonTilesetII (CC0) 신규 몬스터 6종 추가 (사용자 지시 #8:
"Kenny에셋도 좋지만 itch.io에셋이 훨씬좋음" — itch.io 비중 확대).
 - masked_orc / orc_warrior / orc_shaman / wogol / goblin / zombie
 - 16px 프레임 → nearest-neighbor 4배 업스케일 → {key}_idle0..3 / _run0..3 / _atk1프레임
"""
import os
from PIL import Image

SRC = "/tmp/itch/frames/dungeon2/0x72_DungeonTilesetII_v1.7/frames"
DST = "/home/z/my-project/public/assets"
os.makedirs(DST, exist_ok=True)

MONSTERS = [
    ("x3_maskedorc",  "masked_orc_idle_anim_f",  "masked_orc_run_anim_f",  4),
    ("x3_orcwarrior", "orc_warrior_idle_anim_f", "orc_warrior_run_anim_f", 4),
    ("x3_orcshaman",  "orc_shaman_idle_anim_f",  "orc_shaman_run_anim_f",  4),
    ("x3_wogol",      "wogol_idle_anim_f",       "wogol_run_anim_f",       4),
    ("x3_goblin",     "goblin_idle_anim_f",      "goblin_run_anim_f",      4),
    ("x3_bigzombie",  "big_zombie_idle_anim_f",  "big_zombie_run_anim_f",  3),
]

def load(prefix: str, i: int) -> Image.Image:
    return Image.open(os.path.join(SRC, f"{prefix}{i}.png")).convert("RGBA")

def upscale(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.NEAREST)

for key, idle_prefix, run_prefix, k in MONSTERS:
    for i in range(4):
        upscale(load(idle_prefix, i), k).save(f"{DST}/{key}_idle{i}.png")
    for i in range(4):
        upscale(load(run_prefix, i), k).save(f"{DST}/{key}_run{i}.png")
    atk = upscale(load(run_prefix, 1), k)
    atk.save(f"{DST}/{key}_atk0.png")
    print(f"{key}: idle4+run4+atk1 (x{k}) {atk.size}")

print("DONE — v3.0.4 itch.io monsters")
