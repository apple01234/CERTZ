"""v1.0.11 — Gameworks Unity pack (Hovl Studio / Matthew Guz / Petal Particles / Toon Shaders Pro)
선별 텍스처 → public/assets/gw_*.webp 변환 (512 캡, q82 — vf_* 파이프라인과 동일 규격)

원본: research/gameworks/ (upload/drive/file3_real.bin 에서 재추출 가능 — 리셋 대비 보존 규약)
"""
from PIL import Image
import os

BASE = "research/gameworks"
OUT = "public/assets"

# (소경로, 출력키, 캡크기, RGB→ADD전용) — RGB 검정배경 텍스처는 ADD 블렌드에서 그대로 사용
PLAN = [
    ("Hovl Studio/Magic effects pack/Textures/MagicCircle2.png", "gw_magic", 512, False),
    ("Hovl Studio/Magic effects pack/Textures/MagicCircle.png", "gw_rune", 512, True),
    ("Hovl Studio/Magic effects pack/Textures/TechCircle2.png", "gw_tech", 512, False),
    ("Hovl Studio/Magic effects pack/Textures/Electro.png", "gw_electro", 254, False),
    ("Hovl Studio/Magic effects pack/Textures/Flare.png", "gw_flare", 256, False),
    ("Hovl Studio/Magic effects pack/Textures/Flash.png", "gw_flash", 254, False),
    ("Hovl Studio/Magic effects pack/Textures/GlowFree1.png", "gw_glow", 256, False),
    ("Hovl Studio/Magic effects pack/Textures/Slash.png", "gw_arc", 254, False),
    ("Hovl Studio/Magic effects pack/Textures/Crack.png", "gw_crack", 384, False),
    ("Hovl Studio/Magic effects pack/Textures/Trail67.png", "gw_trail", 256, False),
    ("Hovl Studio/Magic effects pack/Textures/Arrow1.png", "gw_arrow", 256, False),
    ("Hovl Studio/Magic effects pack/Textures/ProjectileFree1.png", "gw_proj", 384, False),
    ("Hovl Studio/Magic effects pack/Textures/CrystalFree1.png", "gw_crystal", 512, False),
    ("Hovl Studio/Magic effects pack/Textures/CraterFree1.png", "gw_crater", 384, True),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash.png", "gw_slash_a", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash M.png", "gw_slash_b", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash S.png", "gw_slash_c", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Slash 1.png", "gw_dash", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Shockwave 2.png", "gw_shock", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-explosión.png", "gw_boom", 512, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Spark.png", "gw_spark", 256, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Crit_2.png", "gw_crit", 512, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Fire_.png", "gw_fire", 384, False),
    ("Matthew Guz/Slash Effects FREE/Textures/5-Light_Point.png", "gw_dot", 256, False),
]


def crop_petal_cell(im: Image.Image) -> Image.Image:
    """CherryPetal.png는 4×4 그리드(2048) — 좌상단 512×512 셀 1장만 크롭"""
    return im.crop((0, 0, im.width // 4, im.height // 4))


total = 0
for rel, key, cap, rgb_add in PLAN:
    p = os.path.join(BASE, rel)
    im = Image.open(p)
    if key == "gw_petal":
        im = crop_petal_cell(im.convert("RGBA"))
    elif rgb_add:
        im = im.convert("RGBA")  # ADD 블렌드 전용 — 알파 유지(불투명) 그대로
    else:
        im = im.convert("RGBA")
    if max(im.size) > cap:
        im.thumbnail((cap, cap), Image.LANCZOS)
    out = os.path.join(OUT, f"{key}.webp")
    im.save(out, "WEBP", quality=82, method=4)
    sz = os.path.getsize(out)
    total += sz
    print(f"{key:14s} {im.size[0]}x{im.size[1]}  {sz/1024:7.1f}K  <- {rel}")

# 벚꽃잎 단품 (그리드 셀 크롭)
im = Image.open(os.path.join(BASE, "Petal Particles - Cherry Petals/Particle/Textures/CherryPetal.png")).convert("RGBA")
im = crop_petal_cell(im)
im.thumbnail((256, 256), Image.LANCZOS)
out = os.path.join(OUT, "gw_petal.webp")
im.save(out, "WEBP", quality=82, method=4)
total += os.path.getsize(out)
print(f"gw_petal       {im.size[0]}x{im.size[1]}  {os.path.getsize(out)/1024:7.1f}K  <- CherryPetal cell")

print(f"--- TOTAL: {total/1024:.0f}K / 25 textures")
