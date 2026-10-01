#!/usr/bin/env python3
"""v1.0.10 — Vefects 3D VFX 텍스처 컨택트시트 (스킬 강화 선별용 육안 검수)"""
from PIL import Image, ImageDraw
import os

ROOT = "research/vefects/Vefects"
CANDIDATES = [
    # (label, path) — 4/5차 스킬 강화 후보
    ("penta_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Pentacle.png"),
    ("penta_elec",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Pentacle.png"),
    ("penta_dark",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Dark/Textures/T_VFX_Dark_Magic_Pentacle.png"),
    ("penta_ice",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Ice/Textures/T_VFX_Ice_Magic_Pentacle.png"),
    ("penta_water",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Water/Textures/T_VFX_Water_Magic_Pentacle.png"),
    ("penta_nature", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Nature/Textures/T_VFX_NatureMagic_Pentacle.png"),
    ("penta_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Pentacle.png"),
    ("penta_earth",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Earth/Textures/T_VFX_Earth_Magic_Pentacle.png"),
    ("penta_sound",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Sound/Textures/T_VFX_Sound_Magic_Pentacle.png"),
    ("slash_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Fire/Textures/T_VFX_Slash_Fire.png"),
    ("slash_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Void/Textures/T_VFX_Slash_Void.png"),
    ("slash_elec",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Electric/Textures/T_VFX_Slash_Electric.png"),
    ("slash_ice",    "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Ice/Textures/T_VFX_Slash_Ice.png"),
    ("slash_dark",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Dark/Textures/T_VFX_Slash_Dark.png"),
    ("pierc_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Fire/Textures/T_VFX_Piercing_Fire.png"),
    ("pierc_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Slashes Piercing/Void/Textures/T_VFX_Piercing_Void.png"),
    ("flare_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Magic_Flare.png"),
    ("flare_elec",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Flare.png"),
    ("flare_dark",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Dark/Textures/T_VFX_Dark_Magic_Flare.png"),
    ("flare_ice",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Ice/Textures/T_VFX_Ice_Magic_Flare_01.png"),
    ("flare_water",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Water/Textures/T_VFX_Water_Magic_Flare_01.png"),
    ("flare_nature", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Nature/Textures/T_VFX_NatureMagic_Flare.png"),
    ("flare_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Flare.png"),
    ("flare_earth",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Earth/Textures/T_VFX_Earth_Magic_Flare.png"),
    ("emb_fire",     "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Magic_Emblem.png"),
    ("emb_void",     "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Emblem.png"),
    ("emb_nature",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Nature/Textures/T_VFX_NatureMagic_Emblem.png"),
    ("emb_sound",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Sound/Textures/T_VFX_Sound_Magic_Emblem.png"),
    ("ltn_FB",       "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Lightning_FB.png"),
    ("ltnE_FB",      "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Lightning_Energy_FB.png"),
    ("ring_void",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Ring.png"),
    ("circ_void",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Circle.png"),
    ("flare_ring",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_FlareRing.png"),
    # 공용(Anime Stylized)
    ("an_slash1",    "Anime Stylized VFX/Shared/Textures/T_VFX_Slash_01.png"),
    ("an_slash2",    "Anime Stylized VFX/Shared/Textures/T_VFX_Slash_02.png"),
    ("an_impact1",   "Anime Stylized VFX/Shared/Textures/T_VFX_Impact_01.png"),
    ("an_impact2",   "Anime Stylized VFX/Shared/Textures/T_VFX_Impact_02.png"),
    ("an_ring1",     "Anime Stylized VFX/Shared/Textures/T_VFX_Ring_01.png"),
    ("an_ring3",     "Anime Stylized VFX/Shared/Textures/T_VFX_Ring_03.png"),
    ("an_ring4",     "Anime Stylized VFX/Shared/Textures/T_VFX_Ring_04.png"),
    ("an_light1",    "Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_01.png"),
    ("an_light2",    "Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_02.png"),
    ("an_arrow",     "Anime Stylized VFX/Shared/Textures/T_VFX_Arrow_01.png"),
    ("an_star1",     "Anime Stylized VFX/Shared/Textures/T_VFX_Star_01.png"),
    ("an_wind1",     "Anime Stylized VFX/Shared/Textures/T_VFX_Wind_01.png"),
    ("an_wind2",     "Anime Stylized VFX/Shared/Textures/T_VFX_Wind_02.png"),
    ("an_flower",    "Anime Stylized VFX/Shared/Textures/T_VFX_Flower_01.png"),
    ("an_spike",     "Anime Stylized VFX/Shared/Textures/T_VFX_Spike_01.png"),
    ("an_trail",     "Anime Stylized VFX/Shared/Textures/T_VFX_Trail_01.png"),
]

COLS, CELL, PAD = 7, 150, 22
rows = (len(CANDIDATES) + COLS - 1) // COLS
sheet = Image.new("RGBA", (COLS * (CELL + PAD) + PAD, rows * (CELL + 30) + PAD), (24, 26, 40, 255))
d = ImageDraw.Draw(sheet)
for i, (label, rel) in enumerate(CANDIDATES):
    p = os.path.join(ROOT, rel)
    x = PAD + (i % COLS) * (CELL + PAD)
    y = PAD + (i // COLS) * (CELL + 30)
    try:
        im = Image.open(p).convert("RGBA")
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        sheet.alpha_composite(im, (x + (CELL - im.width) // 2, y + (CELL - im.height) // 2))
        d.text((x + 2, y + CELL + 2), f"{label}", fill=(160, 220, 255, 255))
    except Exception as e:
        d.text((x + 2, y + 2), f"FAIL {label}", fill=(255, 120, 120, 255))
# 어두운 배경 위 가시성용 배경 사각형은 스킵(ADD 블렌드 전제 — 원본 알파 확인)
sheet.save("scripts/v1010_contact.png")
print("saved scripts/v1010_contact.png", sheet.size)
