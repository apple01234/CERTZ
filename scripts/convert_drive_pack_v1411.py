#!/usr/bin/env python3
# v1.4.11 — Google Drive 신규 에셋 팩 (128MB) → 게임용 webp 변환
# 출처: Hovl Studio Magic effects / Matthew Guz Slash Effects / Petal Particles / Toon Shaders Pro
# 3D 셰이딩 맵(Normal/Height/Roughness/Metallic/PerlinNoise/Lightmap 9종) 제외 전량 변환
import os
from PIL import Image

SRC = "/home/z/my-project/download/drive_in/pack"
OUT = "/home/z/my-project/public/assets"
os.makedirs(OUT, exist_ok=True)

# (원본경로, 출력키, 타깃최대폭, 크롭(x,y,w,h 비율=None))
JOBS = [
    # --- Hovl Studio: 마법진/테크링/번개/크레이터/결정/플래시/연기/투사체 ---
    ("Hovl Studio/Magic effects pack/Textures/MagicCircle.png",      "hv2_magiccircle", 512, None),
    ("Hovl Studio/Magic effects pack/Textures/MagicCircle2.png",     "hv2_magiccircle2", 512, None),
    ("Hovl Studio/Magic effects pack/Textures/TechCircle.png",       "hv2_techcircle", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/TechCircle2.png",      "hv2_techcircle2", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/Electro.png",          "hv2_electro", 256, (0.0, 0.0, 1.0, 0.5)),  # 위쪽 번개만
    ("Hovl Studio/Magic effects pack/Textures/CraterFree1.png",      "hv2_crater", 384, None),
    ("Hovl Studio/Magic effects pack/Textures/Crack.png",            "hv2_crack", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/CrystalFree1.png",     "hv2_crystal", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/FlashFree1.png",       "hv2_flash1", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/FlashFree2.png",       "hv2_flash2", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/FlashFree3.png",       "hv2_flash3", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/GlowFree1.png",        "hv2_glow", 192, None),
    ("Hovl Studio/Magic effects pack/Textures/ProjectileFree1.png",  "hv2_projectile", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/SmokeFree1.png",       "hv2_smoke", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/Smoke26.png",          "hv2_smoke26", 256, None),
    ("Hovl Studio/Magic effects pack/Textures/Star.png",             "hv2_star", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Snowflake.png",        "hv2_snow", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Splat.png",            "hv2_splat", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Stone.png",            "hv2_stone", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Heart.png",            "hv2_heart", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Circle.png",           "hv2_circle", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Circle2.png",          "hv2_circle2", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Flare.png",            "hv2_flare", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Flash.png",            "hv2_flash0", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Trail67.png",          "hv2_trail", 192, None),
    ("Hovl Studio/Magic effects pack/Textures/Arrow1.png",           "hv2_arrow", 192, None),
    ("Hovl Studio/Magic effects pack/Textures/Gradient2.png",        "hv2_gradient", 128, None),
    ("Hovl Studio/Magic effects pack/Textures/Point1.png",           "hv2_point", 32, None),
    ("Hovl Studio/Magic effects pack/Textures/Mask1.png",            "hv2_mask", 256, None),
    # --- Matthew Guz: 참격 6종/충격파/폭발/크리/스파크/화염/광점 ---
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash.png",          "mg_slash0", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash 1.png",        "mg_slash1", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash turn.png",     "mg_slash2", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash M.png",        "mg_slash3", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash S.png",        "mg_slash4", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash S turn.png",    "mg_slash5", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Shockwave 2.png",    "mg_shock0", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Shockwave.png",      "mg_shock1", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-explosión.png",      "mg_explode", 512, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Crit_2.png",         "mg_crit", 384, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Spark.png",          "mg_spark", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Fire_.png",          "mg_fire", 256, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Light_Point.png",    "mg_light", 192, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-point.png",          "mg_point", 128, None),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Particle 2.png",     "mg_particles", 512, None),
    ("Matthew Guz/Slash Effects FREE/Materials/Floor/Texture/Albedo.png", "tn_floor", 512, None),
    # --- Toon Shaders Pro: 먼지/바닥 텍스처 ---
    ("Toon Shaders Pro/Textures/Particles/dirt_02.png",              "tn_dirt0", 192, None),
    ("Toon Shaders Pro/Textures/Particles/dirt_03.png",              "tn_dirt1", 192, None),
    ("Toon Shaders Pro/Textures/Rock/Rock028_1K-PNG_Color.png",      "tn_rock", 512, None),
    ("Toon Shaders Pro/Textures/Sand/Ground033_1K-PNG_Color.png",    "tn_sand", 512, None),
    ("Toon Shaders Pro/Demo/Materials/slab.png" if os.path.exists(f"{SRC}/Toon Shaders Pro/Demo/Materials/slab.png") else "Hovl Studio/Magic effects pack/Textures/Concrete slab.png", "tn_concrete", 512, None),
]

def to_webp(im: Image.Image, maxw: int) -> Image.Image:
    if im.width > maxw:
        h = int(round(im.height * maxw / im.width))
        im = im.resize((maxw, h), Image.LANCZOS)
    return im

ok, fail = 0, []
for rel, key, maxw, crop in JOBS:
    src = os.path.join(SRC, rel)
    if not os.path.exists(src):
        fail.append((key, "missing src"))
        continue
    im = Image.open(src)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    if crop:
        w, h = im.size
        im = im.crop((int(w*crop[0]), int(h*crop[1]), int(w*crop[2]), int(h*crop[3])))
    im = to_webp(im, maxw)
    # 완전 투명 프레임 제거 (잔여 여백 트리밍 — 투명이 대부분이면 건너뜀)
    bbox = im.getbbox()
    if bbox:
        im2 = im.crop(bbox)
        if im2.width >= 8 and im2.height >= 8:
            im = im2
    im.save(f"{OUT}/{key}.webp", "WEBP", quality=88)
    ok += 1
print(f"변환 완료 {ok}/{len(JOBS)}")
for k, r in fail:
    print("FAIL", k, r)

# --- CherryPetal 4x4 시트 → 16프레임 스프라이트시트 (cp_petal.webp, 1024², 256px 셀) ---
petal_src = os.path.join(SRC, "Petal Particles - Cherry Petals/Particle/Textures/CherryPetal.png")
if os.path.exists(petal_src):
    im = Image.open(petal_src).convert("RGBA")
    # 2048 → 1024, 4x4 그리드 가정 → 셀 256px. 각 셀을 알파 트리밍해 개별 꽃잎으로 재포장
    im = im.resize((1024, 1024), Image.LANCZOS)
    cell = 256
    petals = []
    for gy in range(4):
        for gx in range(4):
            c = im.crop((gx*cell, gy*cell, (gx+1)*cell, (gy+1)*cell))
            b = c.getbbox()
            if b and (b[2]-b[0]) > 12:
                petals.append(c.crop(b))
    if petals:
        pad = 8
        n = len(petals)
        cols = 4
        rows = (n + cols - 1) // cols
        # 균일 셀 크기 = 최대 꽃잎 크기 + 패딩
        cw = max(p.width for p in petals) + pad*2
        ch = max(p.height for p in petals) + pad*2
        sheet = Image.new("RGBA", (cw*cols, ch*rows), (0,0,0,0))
        for i, p in enumerate(petals):
            x = (i % cols) * cw + (cw - p.width)//2
            y = (i // cols) * ch + (ch - p.height)//2
            sheet.paste(p, (x, y), p)
        sheet.save(f"{OUT}/cp_petal.webp", "WEBP", quality=90)
        print(f"cp_petal.webp: {n}프레임, 셀 {cw}x{ch}, 시트 {sheet.size}")
else:
    print("FAIL cp_petal missing")

# 타이틀 배경용 벚꽃 언덕
bg_src = os.path.join(SRC, "Petal Particles - Cherry Petals/Demo Scene/Background/1.png")
if os.path.exists(bg_src):
    bim = Image.open(bg_src).convert("RGB")
    bim = to_webp(bim, 960)
    bim.save(f"{OUT}/cp_bg.webp", "WEBP", quality=82)
    print("cp_bg.webp:", bim.size)
