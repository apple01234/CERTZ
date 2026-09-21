#!/usr/bin/env python3
"""유니티 팩 VFX 텍스처 컨택트시트 — 품질 육안 검증용"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = "/home/z/my-project/scripts/_unity_extract"
CFXR = f"{BASE}/SPUM/JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics"
FW = f"{BASE}/CartoonVFX9X/CartoonVFX9X/FireworksEffect2D/Textures"

cands = [
    ("cfxr hit triangle.png", CFXR),
    ("cfxr hit triangle dissolve.png", CFXR),
    ("cfxr magic star.png", CFXR),
    ("cfxr flare.png", CFXR),
    ("cfxr ring arc.png", CFXR),
    ("cfxr ring electric.png", CFXR),
    ("cfxr ring ice.png", CFXR),
    ("cfxr ring spikes revert.png", CFXR),
    ("cfxr aura rays.png", CFXR),
    ("cfxr aura runic.png", CFXR),
    ("cfxr electric spark.png", CFXR),
    ("cfxr electric arcs x4.png", CFXR),
    ("cfxr fire circle crisp.png", CFXR),
    ("cfxr flamme crisp.png", CFXR),
    ("cfxr ember blur.png", CFXR),
    ("cfxr skull.png", CFXR),
    ("cfxr skull 2.png", CFXR),
    ("cfxr star.png", CFXR),
    ("cfxr spikes impact.png", CFXR),
    ("cfxr sword trail mask plain.png", CFXR),
    ("Star_Blue.png", FW),
    ("Star_Yellow.png", FW),
    ("Spark_Yellow.png", FW),
    ("Spark_Blue.png", FW),
    ("Heart.png", FW),
    ("Moon.png", FW),
    ("Triangle.png", FW),
    ("Smile_Face.png", FW),
]

COLS, CELL, LABEL_H = 6, 190, 22
rows = (len(cands) + COLS - 1) // COLS
sheet = Image.new("RGBA", (COLS * CELL, rows * (CELL + LABEL_H)), (24, 26, 34, 255))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception:
    font = ImageFont.load_default()

for i, (name, base) in enumerate(cands):
    p = os.path.join(base, name)
    x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL_H)
    try:
        im = Image.open(p).convert("RGBA")
        im.thumbnail((CELL - 10, CELL - 10), Image.LANCZOS)
        # 체커보드 배경(투명도 가시화)
        bg = Image.new("RGBA", (CELL - 10, CELL - 10), (60, 60, 70, 255))
        sheet.paste(bg, (x + 5, y + 3))
        sheet.alpha_composite(im, (x + 5 + (CELL - 10 - im.width) // 2, y + 3 + (CELL - 10 - im.height) // 2))
        draw.text((x + 6, y + CELL + 2), name[:30], fill=(230, 230, 230, 255), font=font)
    except Exception as e:
        draw.text((x + 6, y + 40), f"ERR {e}", fill=(255, 80, 80, 255), font=font)

out = "/home/z/my-project/scripts/_unity_extract/vfx_contact_sheet.png"
sheet.convert("RGB").save(out, quality=92)
print("saved:", out, sheet.size)
