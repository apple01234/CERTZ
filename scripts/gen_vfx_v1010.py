#!/usr/bin/env python3
"""v1.0.10 — Vefects(Unity 3D VFX 팩) 프리렌더 텍스처 → 게임용 webp 변환
 · 4차/5차 스킬 이펙트 강화 + 전투 연출 고도화용 (유저 지시 "3D 에셋 왜 적용 안함??" / "스킬 효과 강화")
 · 출처: research/vefects (upload/drive/file2_real.bin = Vefects.7z 재추출분 — 유료 라이선스 에셋)
 · 화이트 텍스처는 setTint로 전 원소 대응, 컬러 텍스처는 베이크드 컬러 그대로 사용
"""
from PIL import Image
import os

ROOT = "research/vefects/Vefects"
OUT = "public/assets"
os.makedirs(OUT, exist_ok=True)

# (out_name, src_rel, max_side)
PLAN = [
    # 펜타클 — 5차 궁극기 인트로 마법진 (화이트 계열은 setTint 대응)
    ("vf_pentacle",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Pentacle.png", 512),
    ("vf_penta_fire", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Pentacle.png", 512),
    ("vf_penta_elec", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Pentacle.png", 512),
    ("vf_penta_dark", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Dark/Textures/T_VFX_Dark_Magic_Pentacle.png", 512),
    ("vf_penta_ice",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Ice/Textures/T_VFX_Ice_Magic_Pentacle.png", 512),
    # 원소 플레어 — 스킬 타격 코어 (베이크드 컬러)
    ("vf_flare_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Magic_Flare.png", 384),
    ("vf_flare_elec",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Electric/Textures/T_VFX_Electric_Magic_Flare.png", 384),
    ("vf_flare_dark",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Dark/Textures/T_VFX_Dark_Magic_Flare.png", 384),
    ("vf_flare_ice",    "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Ice/Textures/T_VFX_Ice_Magic_Flare_01.png", 384),
    ("vf_flare_nature", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Nature/Textures/T_VFX_NatureMagic_Flare.png", 384),
    ("vf_flare_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Flare.png", 384),
    ("vf_flare_water",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Water/Textures/T_VFX_Water_Magic_Flare_01.png", 384),
    ("vf_flare_earth",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Earth/Textures/T_VFX_Earth_Magic_Flare.png", 384),
    # 링/엠블럼 — AoE·직업 시그니처
    ("vf_ring_void",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Ring.png", 384),
    ("vf_ring_fire",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_FlareRing.png", 384),
    ("vf_emb_fire",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Fire/Textures/T_VFX_Fire_Magic_Emblem.png", 384),
    ("vf_emb_void",   "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Void/Textures/T_VFX_Void_Magic_Emblem.png", 384),
    ("vf_emb_nature", "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Nature/Textures/T_VFX_NatureMagic_Emblem.png", 384),
    ("vf_emb_sound",  "Stylized VFX/Stylized VFX Shuriken/Skills/Magic Attacks/Sound/Textures/T_VFX_Sound_Magic_Emblem.png", 384),
    # 화이트 제네릭 — setTint로 전 색 대응 (참격/충격/링/번개/별/화살)
    ("vf_slash",      "Anime Stylized VFX/Shared/Textures/T_VFX_Slash_01.png", 384),
    ("vf_impact",     "Anime Stylized VFX/Shared/Textures/T_VFX_Impact_01.png", 384),
    ("vf_ring",       "Anime Stylized VFX/Shared/Textures/T_VFX_Ring_01.png", 384),
    ("vf_lightning",  "Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_01.png", 384),
    ("vf_star",       "Anime Stylized VFX/Shared/Textures/T_VFX_Star_01.png", 256),
    ("vf_arrow",      "Anime Stylized VFX/Shared/Textures/T_VFX_Arrow_01.png", 256),
]

ok = 0
for name, rel, side in PLAN:
    src = os.path.join(ROOT, rel)
    if not os.path.exists(src):
        print("MISS", name, rel)
        continue
    im = Image.open(src).convert("RGBA")
    if max(im.size) > side:
        im.thumbnail((side, side), Image.LANCZOS)
    dst = os.path.join(OUT, f"{name}.webp")
    im.save(dst, "WEBP", lossless=False, quality=82, method=6)
    kb = os.path.getsize(dst) // 1024
    ok += 1
    print(f"OK {name}.webp {im.size[0]}x{im.size[1]} {kb}KB")
print(f"\nconverted {ok}/{len(PLAN)}")
