#!/usr/bin/env python3
"""
v3.0.3 — itch.io 0x72 DungeonTilesetII (CC0) 신규 몬스터 7종 + 무기 4종 + GM NPC 가공.
 - 몬스터: 16px 프레임 → nearest-neighbor 정수 배율 업스케일 → {key}_idle0..3 / _run0..3 / _atk0
 - 무기: 2배 업스케일 (런타임에서 setScale 조절)
 - GM NPC: knight_m 프레임에 금색 디테일 오버레이
"""
import os
from PIL import Image

SRC = "/tmp/itch/frames/dungeon2/0x72_DungeonTilesetII_v1.7/frames"
DST = "/home/z/my-project/public/assets"
os.makedirs(DST, exist_ok=True)

# (키, idle 프레임 접두사, run 프레임 접두사, 배율, 캔버스 h 여유) — None이면 idle과 동일 접두사(단일 애니몬)
MONSTERS = [
    ("x3_imp",        "imp_idle_anim_f",   "imp_run_anim_f",    4),
    ("x3_swampy",     "swampy_anim_f",     "swampy_anim_f",     4),
    ("x3_tinyzombie", "tiny_zombie_idle_anim_f", "tiny_zombie_run_anim_f", 4),
    ("x3_chort",      "chort_idle_anim_f", "chort_run_anim_f",  4),
    ("x3_necromancer","necromancer_anim_f","necromancer_anim_f", 4),
    ("x3_ogre",       "ogre_idle_anim_f",  "ogre_run_anim_f",   2),
    ("x3_icezombie",  "ice_zombie_anim_f", "ice_zombie_anim_f", 4),
]

def load(prefix: str, i: int) -> Image.Image:
    return Image.open(os.path.join(SRC, f"{prefix}{i}.png")).convert("RGBA")

def upscale(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.NEAREST)

def export_monster(key, idle_prefix, run_prefix, k):
    for i in range(4):
        idle = upscale(load(idle_prefix, i), k)
        idle.save(f"{DST}/{key}_idle{i}.png")
    for i in range(4):
        run = upscale(load(run_prefix, i), k)
        run.save(f"{DST}/{key}_run{i}.png")
    atk = upscale(load(run_prefix, 1), k)
    atk.save(f"{DST}/{key}_atk0.png")
    print(f"{key}: idle4+run4+atk1 (x{k}) {idle.size}")

for m in MONSTERS:
    export_monster(*m)

# ---- 무기 (2배 업스케일) ----
WEAPONS = [
    ("x3_bow",    "weapon_bow_2.png",           2),
    ("x3_staff",  "weapon_red_magic_staff.png", 2),
    ("x3_dagger", "weapon_knife.png",           2),
]
for out, src, k in WEAPONS:
    img = Image.open(os.path.join(SRC, src)).convert("RGBA")
    upscale(img, k).save(f"{DST}/{out}.png")
    print(out, img.size, "->", (img.width*k, img.height*k))

# ---- 표창(shuriken) — PIL 픽셀 아트 12x12 → 24x24 ----
S = 12
sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
px = sh.load()
steel = (200, 208, 224, 255); dark = (110, 118, 140, 255); hole = (30, 30, 40, 255)
# 십자 날 + 대각 블레이드
for i in range(5):
    px[6 - 2 + i, 0] = steel; px[6 - 2 + i, 11] = steel
    px[0, 6 - 2 + i] = steel; px[11, 6 - 2 + i] = steel
for c in (1, 2, 9, 10):
    px[c, c] = dark; px[11 - c, c] = dark; px[c, 11 - c] = dark; px[11 - c, 11 - c] = dark
# 중심 축
px[6, 6] = hole; px[5, 5] = steel; px[6, 5] = steel; px[5, 6] = steel
sh.resize((24, 24), Image.NEAREST).save(f"{DST}/x3_shuriken.png")
print("x3_shuriken 24x24")

# ---- GM NPC — knight_m에 금빛 갑옷 재조색 + 캔버스 32x56 ----
km = Image.open(os.path.join(SRC, "knight_m_idle_anim_f0.png")).convert("RGBA")
gm = km.copy()
p = gm.load()
for y in range(gm.height):
    for x in range(gm.width):
        r, g, b, a = p[x, y]
        if a == 0:
            continue
        # 갑옷 회색톤 → 금색, 망토 → 보라
        if r > 90 and g > 90 and b > 90 and abs(r-g) < 30 and abs(g-b) < 30:
            p[x, y] = (255, 214, 106, a) if (x + y) % 3 else (232, 184, 80, a)
        elif r > 120 and g < 90 and b < 90:
            p[x, y] = (168, 106, 255, a)
canvas = Image.new("RGBA", (32, 56), (0, 0, 0, 0))
canvas.paste(upscale(gm, 2), (0, 0))
canvas.save(f"{DST}/npc_gm.png")
print("npc_gm 32x56")
print("DONE")
