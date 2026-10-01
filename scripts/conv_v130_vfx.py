#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.3.0 (#8 에셋 활용 강화) — 유저 지시 "에셋 ㅈㄴㅈㄴㅈㄴ 많이 추가했으니 최대한 활용해서
게임 디자인 및 기능 강화해": 구글드라이브로 받은 3대 VFX 팩(Vefects·Hovl·GameVFX·
PixelFX·Cainos·Petal Particles·UNI VFX)에서 게임에 바로 쓸 텍스처를 선별·웹용 변환.

통합 대상 기능:
  A. 마을 벚꽃 연출    — petal0 (Cherry Petals 4x4 시트 중 1프레임 크롭)
  B. 크리티컬 임팩트   — vfx3_impact_star(별) + vfx3_ring(링)
  C. 레벨업/보상 링    — vfx3_ring
  D. 회복 하트         — vfx3_heart (물약/GM 엘릭서)
  E. 모닥불 화염 교체  — px_fire0..4 (PixelFX idlefire 5프레임 시트)
  F. 분수 물 튀김      — cainos_water0..3 (Cainos Water Splash Small 4프레임)
  G. 마법 투사체 코어  — vfx3_flare (발사체 글로우)
"""
import os
from PIL import Image

SRC = "upload/vfx_extract"
OUT = "public/assets"

def conv(src, dst, resize=None, crop=None):
    im = Image.open(os.path.join(SRC, src)).convert("RGBA")
    if crop:
        im = im.crop(crop)
    if resize:
        im = im.resize(resize, Image.LANCZOS)
    im.save(os.path.join(OUT, dst))
    print(f"{dst}: {im.size}")

# A. 벚꽃잎 — 4x4 시트 (0,0) 셀 중 알파 bbox 크롭 → 64px
conv("file3__Petal_Particles_-_Cherry_Petals_Particle_Textures_CherryPetal.png",
     "petal0.webp", resize=(64, 64), crop=(90, 0, 420, 512))

# B/C. 임팩트·링
conv("file2__Vefects_Anime_Stylized_VFX_Shared_Textures_T_VFX_Impact_01.png", "vfx3_impact.webp", (96, 96))
conv("file2__Vefects_Anime_Stylized_VFX_Shared_Textures_T_VFX_Ring_02.png", "vfx3_ring.webp", (96, 96))
conv("file2__Vefects_Anime_Stylized_VFX_Shared_Textures_T_VFX_Slash_01.png", "vfx3_slash.webp", (96, 96))

# D. 하트/꽃 (힐 연출)
conv("file3__Hovl_Studio_Magic_effects_pack_Textures_Heart.png", "vfx3_heart.webp", (64, 64))
conv("file2__Vefects_Anime_Stylized_VFX_Shared_Textures_T_VFX_Flower_01.png", "vfx3_flower.webp", (64, 64))

# E. 모닥불 화염 — idlefire 시트(1920x64 = 30프레임 64px)에서 5프레임만
for i in range(5):
    conv("file1__PixelFX_vol1_Sprite_Fire_Idle_idlefire1.png", f"px_fire{i}.webp",
         resize=(64, 64), crop=(i * 64, 0, (i + 1) * 64, 64))

# F. 물 튀김 — Cainos Small_L 시트: 그리드 분석 후 4프레임
water = Image.open(os.path.join(SRC, "file1__Cainos_Interactive_Pixel_Water_Texture_TX_FX_Water_Splash_-_Small_L.png")).convert("RGBA")
print("water sheet:", water.size)

# G. 발사체 글로우
conv("file3__Hovl_Studio_Magic_effects_pack_Textures_Flare.png", "vfx3_flare.webp", (64, 64))
